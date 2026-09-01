package com.melodypenero.coffeefarm.ml

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.RectF
import com.melodypenero.coffeefarm.data.model.BoundingBoxDetection
import com.melodypenero.coffeefarm.data.model.BranchScanSummary
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min

/**
 * On-device YOLOv8 TFLite object detector for coffee cherry maturity grading.
 * Handles tensor shape detection ([1, 9, 8400] and [1, 8400, 9]), coordinate normalization,
 * sigmoid score activation, Non-Maximum Suppression (NMS), and cherry region clustering.
 */
class YoloTfliteDetector(context: Context) {

    private val appContext = context.applicationContext

    private val interpreter: Interpreter? = runCatching {
        val modelBuffer = loadModelBuffer("cherry_grade_model.tflite") ?: loadModelBuffer(MODEL_ASSET)
        modelBuffer?.let {
            val options = Interpreter.Options().apply { setNumThreads(4) }
            Interpreter(it, options)
        }
    }.getOrNull()

    fun isReady(): Boolean = interpreter != null

    @Synchronized
    fun detect(bitmap: Bitmap): Result<BranchScanSummary> {
        val origWidth = bitmap.width
        val origHeight = bitmap.height

        return try {
            val interp = interpreter
                ?: return Result.failure(IllegalStateException("No TFLite model loaded in assets."))

            val detections = mutableListOf<BoundingBoxDetection>()

            val inputTensor = interp.getInputTensor(0)
            val inputShape = inputTensor.shape()
            val outputTensor = interp.getOutputTensor(0)
            val outputShape = outputTensor.shape()

            val isCnnClassifier = outputShape.size == 2 && (outputShape[1] in 2..5)

            if (isCnnClassifier) {
                // CNN Image Classification Model (MobileNetV2 trained on Overripe/Ripe/Unripe)
                val cnnInputSize = if (inputShape.size == 4 && inputShape[1] > 0) inputShape[1] else 224
                val numClasses = outputShape[1]

                // Extract 5 regional crops (Center, Top, Bottom, Left, Right) to focus on coffee cherries
                val patches = listOf(
                    // Center 65% crop (Primary Target)
                    Bitmap.createBitmap(bitmap, (origWidth * 0.175f).toInt(), (origHeight * 0.175f).toInt(), (origWidth * 0.65f).toInt(), (origHeight * 0.65f).toInt()),
                    // Full image
                    bitmap,
                    // Top-center region
                    Bitmap.createBitmap(bitmap, (origWidth * 0.10f).toInt(), 0, (origWidth * 0.80f).toInt(), (origHeight * 0.60f).toInt()),
                    // Bottom-center region
                    Bitmap.createBitmap(bitmap, (origWidth * 0.10f).toInt(), (origHeight * 0.40f).toInt(), (origWidth * 0.80f).toInt(), (origHeight * 0.60f).toInt())
                )

                val aggregatedProbs = FloatArray(numClasses)

                for (patch in patches) {
                    val scaledPatch = Bitmap.createScaledBitmap(patch, cnnInputSize, cnnInputSize, true)
                    val byteBuffer = bitmapToImageNetByteBuffer(scaledPatch, cnnInputSize)
                    val patchOutput = Array(1) { FloatArray(numClasses) }
                    interp.run(byteBuffer, patchOutput)
                    scaledPatch.recycle()
                    if (patch != bitmap) patch.recycle()

                    for (c in 0 until numClasses) {
                        aggregatedProbs[c] += patchOutput[0][c] / patches.size.toFloat()
                    }
                }

                val overripeProb = aggregatedProbs.getOrElse(0) { 0f }
                val ripeProb = aggregatedProbs.getOrElse(1) { 0f }
                val unripeProb = aggregatedProbs.getOrElse(2) { 0f }

                val maxProb = aggregatedProbs.maxOrNull() ?: 0f
                val maxIdx = aggregatedProbs.indices.maxByOrNull { aggregatedProbs[it] } ?: 0

                // Strict confidence check: If model confidence < 60%, no valid cherry in photo
                if (maxProb < 0.60f) {
                    return Result.success(
                        BranchScanSummary(
                            totalCount = 0,
                            classCounts = emptyMap(),
                            ripePercentage = 0f,
                            harvestStatus = "No Cherries Detected",
                            detections = emptyList()
                        )
                    )
                }

                val cnnClassNames = listOf("Overripe", "Ripe", "Unripe", "Ripening", "Dry_Damaged")
                val topClassName = cnnClassNames.getOrElse(maxIdx) { "Ripe" }

                val classCounts = mapOf(
                    "Ripe" to if (topClassName == "Ripe") 1 else 0,
                    "Unripe" to if (topClassName == "Unripe") 1 else 0,
                    "Overripe" to if (topClassName == "Overripe") 1 else 0,
                    "Ripening" to if (topClassName == "Ripening") 1 else 0,
                    "Dry_Damaged" to 0
                )

                // Single center target box for genuine classification result
                val centerBox = RectF(origWidth * 0.25f, origHeight * 0.25f, origWidth * 0.75f, origHeight * 0.75f)
                detections.add(
                    BoundingBoxDetection(
                        rect = centerBox,
                        classIndex = TARGET_CLASSES.indexOf(topClassName).coerceAtLeast(0),
                        className = topClassName,
                        confidence = maxProb,
                        uncertain = maxProb < UNCERTAIN_THRESHOLD
                    )
                )

                val totalCount = detections.size
                val ripeCount = classCounts["Ripe"] ?: 0
                val ripePercentage = if (totalCount > 0) (ripeCount.toFloat() / totalCount * 100.0f) else 0.0f
                val harvestStatus = BranchScanSummary.computeHarvestStatus(ripePercentage)

                return Result.success(
                    BranchScanSummary(
                        totalCount = totalCount,
                        classCounts = classCounts,
                        ripePercentage = ripePercentage,
                        harvestStatus = harvestStatus,
                        detections = detections
                    )
                )

            }
 else {
                // YOLOv8 Object Detection Model
                val scaledBitmap = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true)
                val byteBuffer = bitmapToByteBuffer(scaledBitmap)

                val rawBoxes = mutableListOf<BoundingBoxDetection>()

                // Check shape variations: [1, 9, 8400] vs [1, 8400, 9]
                if (outputShape.size == 3) {
                    val d1 = outputShape[1]
                    val d2 = outputShape[2]

                    if (d1 == OUTPUT_CHANNELS || d1 == 9 || d1 == 5 || d1 == 6) {
                        // Tensor shape: [1, C, N] where C is channels (e.g. 9), N is num boxes (8400)
                        val numChannels = d1
                        val numBoxes = d2
                        val outputArray = Array(1) { Array(numChannels) { FloatArray(numBoxes) } }
                        interp.run(byteBuffer, outputArray)

                        for (b in 0 until numBoxes) {
                            val rawCx = outputArray[0][0][b]
                            val rawCy = outputArray[0][1][b]
                            val rawW = outputArray[0][2][b]
                            val rawH = outputArray[0][3][b]

                            // Normalize coordinates to [0.0, 1.0] if model outputs in 0..640 space
                            val normCx = if (rawCx > 1.0f) rawCx / INPUT_SIZE.toFloat() else rawCx
                            val normCy = if (rawCy > 1.0f) rawCy / INPUT_SIZE.toFloat() else rawCy
                            val normW = if (rawW > 1.0f) rawW / INPUT_SIZE.toFloat() else rawW
                            val normH = if (rawH > 1.0f) rawH / INPUT_SIZE.toFloat() else rawH

                            val cx = normCx * origWidth
                            val cy = normCy * origHeight
                            val w = normW * origWidth
                            val h = normH * origHeight

                            var maxClassId = 0
                            var maxConf = formatConfidence(outputArray[0][4][b])

                            val numClassScoreChannels = numChannels - 4
                            for (c in 1 until numClassScoreChannels.coerceAtMost(NUM_CLASSES)) {
                                val score = formatConfidence(outputArray[0][4 + c][b])
                                if (score > maxConf) {
                                    maxConf = score
                                    maxClassId = c
                                }
                            }

                            if (maxConf >= CONF_THRESHOLD) {
                                val left = max(0f, cx - w / 2f)
                                val top = max(0f, cy - h / 2f)
                                val right = min(origWidth.toFloat(), cx + w / 2f)
                                val bottom = min(origHeight.toFloat(), cy + h / 2f)

                                if (right > left && bottom > top) {
                                    val rect = RectF(left, top, right, bottom)
                                    val className = TARGET_CLASSES.getOrElse(maxClassId) { "Unripe" }
                                    rawBoxes.add(
                                        BoundingBoxDetection(
                                            rect = rect,
                                            classIndex = maxClassId,
                                            className = className,
                                            confidence = maxConf,
                                            uncertain = maxConf < UNCERTAIN_THRESHOLD
                                        )
                                    )
                                }
                            }
                        }
                    } else if (d2 == OUTPUT_CHANNELS || d2 == 9 || d2 == 5 || d2 == 6) {
                        // Tensor shape: [1, N, C] where N is num boxes (8400), C is channels (9)
                        val numBoxes = d1
                        val numChannels = d2
                        val outputArray = Array(1) { Array(numBoxes) { FloatArray(numChannels) } }
                        interp.run(byteBuffer, outputArray)

                        for (b in 0 until numBoxes) {
                            val rawCx = outputArray[0][b][0]
                            val rawCy = outputArray[0][b][1]
                            val rawW = outputArray[0][b][2]
                            val rawH = outputArray[0][b][3]

                            val normCx = if (rawCx > 1.0f) rawCx / INPUT_SIZE.toFloat() else rawCx
                            val normCy = if (rawCy > 1.0f) rawCy / INPUT_SIZE.toFloat() else rawCy
                            val normW = if (rawW > 1.0f) rawW / INPUT_SIZE.toFloat() else rawW
                            val normH = if (rawH > 1.0f) rawH / INPUT_SIZE.toFloat() else rawH

                            val cx = normCx * origWidth
                            val cy = normCy * origHeight
                            val w = normW * origWidth
                            val h = normH * origHeight

                            var maxClassId = 0
                            var maxConf = formatConfidence(outputArray[0][b][4])

                            val numClassScoreChannels = numChannels - 4
                            for (c in 1 until numClassScoreChannels.coerceAtMost(NUM_CLASSES)) {
                                val score = formatConfidence(outputArray[0][b][4 + c])
                                if (score > maxConf) {
                                    maxConf = score
                                    maxClassId = c
                                }
                            }

                            if (maxConf >= CONF_THRESHOLD) {
                                val left = max(0f, cx - w / 2f)
                                val top = max(0f, cy - h / 2f)
                                val right = min(origWidth.toFloat(), cx + w / 2f)
                                val bottom = min(origHeight.toFloat(), cy + h / 2f)

                                if (right > left && bottom > top) {
                                    val rect = RectF(left, top, right, bottom)
                                    val className = TARGET_CLASSES.getOrElse(maxClassId) { "Unripe" }
                                    rawBoxes.add(
                                        BoundingBoxDetection(
                                            rect = rect,
                                            classIndex = maxClassId,
                                            className = className,
                                            confidence = maxConf,
                                            uncertain = maxConf < UNCERTAIN_THRESHOLD
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
                scaledBitmap.recycle()
                detections.addAll(applyNMS(rawBoxes, IOU_THRESHOLD))

                val classCounts = TARGET_CLASSES.associateWith { cls ->
                    detections.count { it.className == cls }
                }
                val totalCount = detections.size
                val ripeCount = classCounts["Ripe"] ?: 0
                val ripePercentage = if (totalCount > 0) (ripeCount.toFloat() / totalCount * 100.0f) else 0.0f
                val harvestStatus = BranchScanSummary.computeHarvestStatus(ripePercentage)

                return Result.success(
                    BranchScanSummary(
                        totalCount = totalCount,
                        classCounts = classCounts,
                        ripePercentage = ripePercentage,
                        harvestStatus = harvestStatus,
                        detections = detections
                    )
                )
            }
        } catch (t: Throwable) {
            Result.failure(t)
        }
    }

    private fun bitmapToImageNetByteBuffer(bitmap: Bitmap, size: Int): ByteBuffer {
        val byteBuffer = ByteBuffer.allocateDirect(4 * size * size * 3)
        byteBuffer.order(ByteOrder.nativeOrder())
        val intValues = IntArray(size * size)
        bitmap.getPixels(intValues, 0, size, 0, 0, size, size)

        var pixel = 0
        for (i in 0 until size) {
            for (j in 0 until size) {
                val valPixel = intValues[pixel++]
                val r = ((valPixel shr 16) and 0xFF) / 255.0f
                val g = ((valPixel shr 8) and 0xFF) / 255.0f
                val b = (valPixel and 0xFF) / 255.0f

                // Preprocess with ImageNet Mean & Std matching train_cherry_model.py
                byteBuffer.putFloat((r - 0.485f) / 0.229f)
                byteBuffer.putFloat((g - 0.456f) / 0.224f)
                byteBuffer.putFloat((b - 0.406f) / 0.225f)
            }
        }
        return byteBuffer
    }


    private fun formatConfidence(x: Float): Float {
        return if (x in 0.0f..1.0f) x else (1.0f / (1.0f + exp(-x.toDouble()).toFloat()))
    }




    private fun bitmapToByteBuffer(bitmap: Bitmap): ByteBuffer {
        val byteBuffer = ByteBuffer.allocateDirect(4 * INPUT_SIZE * INPUT_SIZE * 3)
        byteBuffer.order(ByteOrder.nativeOrder())
        val intValues = IntArray(INPUT_SIZE * INPUT_SIZE)
        bitmap.getPixels(intValues, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)

        var pixel = 0
        for (i in 0 until INPUT_SIZE) {
            for (j in 0 until INPUT_SIZE) {
                val valPixel = intValues[pixel++]
                byteBuffer.putFloat(((valPixel shr 16) and 0xFF) / 255.0f)
                byteBuffer.putFloat(((valPixel shr 8) and 0xFF) / 255.0f)
                byteBuffer.putFloat((valPixel and 0xFF) / 255.0f)
            }
        }
        return byteBuffer
    }

    private fun applyNMS(boxes: List<BoundingBoxDetection>, iouThreshold: Float): List<BoundingBoxDetection> {
        val sorted = boxes.sortedByDescending { it.confidence }.toMutableList()
        val selected = mutableListOf<BoundingBoxDetection>()

        while (sorted.isNotEmpty()) {
            val first = sorted.removeAt(0)
            selected.add(first)

            val iterator = sorted.iterator()
            while (iterator.hasNext()) {
                val next = iterator.next()
                if (calculateIoU(first.rect, next.rect) > iouThreshold) {
                    iterator.remove()
                }
            }
        }
        return selected
    }

    private fun calculateIoU(a: RectF, b: RectF): Float {
        val intersectionLeft = max(a.left, b.left)
        val intersectionTop = max(a.top, b.top)
        val intersectionRight = min(a.right, b.right)
        val intersectionBottom = min(a.bottom, b.bottom)

        val intersectionArea = max(0f, intersectionRight - intersectionLeft) *
                max(0f, intersectionBottom - intersectionTop)

        val areaA = (a.right - a.left) * (a.bottom - a.top)
        val areaB = (b.right - b.left) * (b.bottom - b.top)
        val unionArea = areaA + areaB - intersectionArea

        return if (unionArea > 0) intersectionArea / unionArea else 0f
    }

    private fun loadModelBuffer(assetName: String): MappedByteBuffer? {
        return runCatching {
            appContext.assets.openFd(assetName).use { fd ->
                FileInputStream(fd.fileDescriptor).use { input ->
                    input.channel.use { channel ->
                        channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
                    }
                }
            }
        }.getOrNull()
    }

    fun close() {
        interpreter?.close()
    }

    companion object {
        const val MODEL_ASSET = "yolov8_coffee_detector.tflite"
        const val INPUT_SIZE = 640
        const val NUM_CLASSES = 5
        const val OUTPUT_CHANNELS = 9 // 4 box coords + 5 class probs
        const val CONF_THRESHOLD = 0.15f
        const val UNCERTAIN_THRESHOLD = 0.35f
        const val IOU_THRESHOLD = 0.45f

        val TARGET_CLASSES = listOf("Unripe", "Ripening", "Ripe", "Overripe", "Dry_Damaged")
    }
}

