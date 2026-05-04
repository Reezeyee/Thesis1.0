package com.melodypenero.coffeefarm.ml

import android.content.Context
import android.graphics.Bitmap
import com.melodypenero.coffeefarm.domain.TreeRipeness
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

data class CherryGradePrediction(
    val grade: String,
    val confidence: Float,
    val confidenceText: String,
    /** Low confidence or ambiguous softmax — not reliable as a cherry ripeness label (often wrong objects). */
    val uncertain: Boolean,
)

/**
 * On-device CNN (TFLite) for coffee cherry ripeness grading.
 *
 * **Preprocessing** matches `get_transforms()["eval"]` in `Cnn Training/train_thesis_models.py`:
 * resize to H×W (bilinear, same as torchvision `Resize`), RGB, scale to [0,1], then
 * ImageNet mean/std normalization.
 *
 * **Outputs:** 3 classes = thesis ripeness ImageFolder order (overripe, ripe, unripe).
 * 4 classes = must match `DISPLAY_LABELS_4` order in your export.
 */
class CherryGradeTfliteClassifier(context: Context) {

    private val appContext = context.applicationContext
    private val interpreter: Interpreter? = runCatching {
        val options = Interpreter.Options().apply { setNumThreads(4) }
        Interpreter(loadModelBuffer(), options)
    }.getOrNull()

    fun isReady(): Boolean = interpreter != null

    @Synchronized
    fun classify(bitmap: Bitmap): Result<CherryGradePrediction> {
        val interp = interpreter
            ?: return Result.failure(IllegalStateException("No model loaded. Add cherry_grade_model.tflite to assets."))

        val converted = if (bitmap.config != Bitmap.Config.ARGB_8888) {
            bitmap.copy(Bitmap.Config.ARGB_8888, false)
        } else {
            null
        }
        val working = converted ?: bitmap

        val inputShape = interp.getInputTensor(0).shape()
        val layout = ImageNetInput.parseInputLayout(inputShape)
        if (layout == null || inputShape.getOrNull(0) != 1) {
            converted?.recycle()
            return Result.failure(
                IllegalStateException("Unexpected model input shape: ${inputShape.contentToString()}. " +
                    "Expected NHWC [1,H,W,3] or NCHW [1,3,H,W].")
            )
        }
        val width = layout.width
        val height = layout.height

        val outputShape = interp.getOutputTensor(0).shape()
        val numClasses = outputShape.getOrNull(1) ?: outputShape.lastOrNull() ?: DISPLAY_LABELS_4.size
        if (numClasses != RIPENESS_THESIS_CLASS_COUNT && numClasses != DISPLAY_LABELS_4.size) {
            converted?.recycle()
            return Result.failure(
                IllegalStateException(
                    "Model has $numClasses outputs; expected $RIPENESS_THESIS_CLASS_COUNT (thesis ripeness) " +
                        "or ${DISPLAY_LABELS_4.size} (full app labels)."
                )
            )
        }

        return try {
            val input: Any = if (layout.nchw) {
                ImageNetInput.bitmapToNchwFloat(working, width, height)
            } else {
                ImageNetInput.bitmapToNhwcFloat(working, width, height)
            }
            val output = Array(1) { FloatArray(numClasses) }
            interp.run(input, output)

            // Many TFLite exports are logits, not probabilities; use softmax so confidence matches training.
            val probs = probabilitiesFromModelOutput(output[0], numClasses)
            val (top1, top2) = TreeRipeness.topTwoProbabilities(probs, numClasses)
            val bestProb = top1
            var bestIdx = 0
            for (i in 1 until numClasses) {
                if (probs[i] > probs[bestIdx]) bestIdx = i
            }
            val margin = top1 - top2
            val uncertain = bestProb < TreeRipeness.CHERRY_MIN_CONFIDENCE_FOR_DETECTION ||
                margin < TreeRipeness.CHERRY_MIN_TOP1_TOP2_MARGIN
            val grade = when (numClasses) {
                RIPENESS_THESIS_CLASS_COUNT -> {
                    val raw = RIPENESS_IMAGE_FOLDER_ORDER.getOrNull(bestIdx)
                        ?: throw IllegalStateException("Invalid class index $bestIdx")
                    thesisFolderLabelToDisplay(raw)
                }
                else -> DISPLAY_LABELS_4.getOrNull(bestIdx) ?: "Unknown"
            }
            val pct = (bestProb.coerceIn(0f, 1f) * 100.0).let { "%.1f%%".format(it) }
            val confText = if (uncertain) "$pct (uncertain)" else pct

            Result.success(
                CherryGradePrediction(
                    grade = grade,
                    confidence = bestProb,
                    confidenceText = confText,
                    uncertain = uncertain,
                )
            )
        } catch (t: Throwable) {
            Result.failure(t)
        } finally {
            converted?.recycle()
        }
    }

    fun close() {
        interpreter?.close()
    }

    /**
     * If values already sum to ~1 in [0,1], use as-is; else treat as logits and apply stable softmax.
     */
    private fun probabilitiesFromModelOutput(raw: FloatArray, numClasses: Int): FloatArray {
        if (raw.size < numClasses) return raw.copyOf()
        val slice = raw.copyOfRange(0, numClasses)
        var sum = 0f
        for (p in slice) sum += p
        if (sum in 0.92f..1.08f && slice.all { it in -0.01f..1.01f }) {
            return slice
        }
        var maxV = slice[0]
        for (i in 1 until slice.size) {
            if (slice[i] > maxV) maxV = slice[i]
        }
        val exp = FloatArray(slice.size) { i ->
            kotlin.math.exp((slice[i] - maxV).toDouble()).toFloat()
        }
        var s = 0f
        for (e in exp) s += e
        if (s <= 0f) return slice
        return FloatArray(slice.size) { i -> exp[i] / s }
    }

    private fun loadModelBuffer(): MappedByteBuffer {
        appContext.assets.openFd(MODEL_ASSET).use { fd ->
            FileInputStream(fd.fileDescriptor).use { input ->
                input.channel.use { channel ->
                    return channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
                }
            }
        }
    }

    companion object {
        const val MODEL_ASSET = "cherry_grade_model.tflite"

        /** `torchvision.datasets.ImageFolder` sort order for dataset/ripeness (see metrics.json). */
        private const val RIPENESS_THESIS_CLASS_COUNT = 3
        private val RIPENESS_IMAGE_FOLDER_ORDER = listOf("overripe", "ripe", "unripe")

        /** Four-grade UI labels; export order must match your 4-class TFLite training. */
        val DISPLAY_LABELS_4 = listOf(
            "Green/Unripe",
            "Yellow/Near Ripe",
            "Red/Ripe",
            "Overripe/Defective",
        )

        @Deprecated("Use DISPLAY_LABELS_4", ReplaceWith("CherryGradeTfliteClassifier.DISPLAY_LABELS_4"))
        val LABELS: List<String> get() = DISPLAY_LABELS_4

        private fun thesisFolderLabelToDisplay(folderName: String): String = when (folderName) {
            "unripe" -> "Green/Unripe"
            "ripe" -> "Red/Ripe"
            "overripe" -> "Overripe/Defective"
            else -> folderName
        }
    }
}
