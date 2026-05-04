package com.melodypenero.coffeefarm.ml

import android.content.Context
import android.graphics.Bitmap
import com.melodypenero.coffeefarm.domain.TreeRipeness
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

data class CoffeeSpeciesPrediction(
    val speciesDisplay: String,
    val confidence: Float,
    val confidenceText: String,
)

/**
 * Species head: Liberica vs Robusta (`species_leaf` in train_thesis_models.py).
 * ImageFolder order: liberica, robusta (alphabetical).
 */
class CoffeeSpeciesTfliteClassifier(context: Context) {

    private val appContext = context.applicationContext
    private val interpreter: Interpreter? = runCatching {
        val options = Interpreter.Options().apply { setNumThreads(4) }
        Interpreter(loadModelBuffer(), options)
    }.getOrNull()

    fun isReady(): Boolean = interpreter != null

    @Synchronized
    fun classify(bitmap: Bitmap): Result<CoffeeSpeciesPrediction> {
        val interp = interpreter
            ?: return Result.failure(
                IllegalStateException("Species model not loaded. Add coffee_species_model.tflite to assets.")
            )

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
                IllegalStateException("Unexpected species model input: ${inputShape.contentToString()}. " +
                    "Expected NHWC [1,H,W,3] or NCHW [1,3,H,W].")
            )
        }
        val width = layout.width
        val height = layout.height

        val outputShape = interp.getOutputTensor(0).shape()
        val numClasses = outputShape.getOrNull(1) ?: outputShape.lastOrNull() ?: SPECIES_FOLDER_ORDER.size
        if (numClasses != SPECIES_FOLDER_ORDER.size) {
            converted?.recycle()
            return Result.failure(
                IllegalStateException("Species model has $numClasses outputs; expected ${SPECIES_FOLDER_ORDER.size}.")
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
            val raw = output[0]
            val probs = probabilitiesFromModelOutput(raw, numClasses)
            val (top1, top2) = TreeRipeness.topTwoProbabilities(probs, numClasses)
            val bestProb = top1
            var bestIdx = 0
            for (i in 1 until numClasses) {
                if (probs[i] > probs[bestIdx]) bestIdx = i
            }
            val margin = top1 - top2
            val uncertain = bestProb < TreeRipeness.SPECIES_MIN_CONFIDENCE_FOR_DETECTION ||
                margin < TreeRipeness.SPECIES_MIN_TOP1_TOP2_MARGIN
            val folder = SPECIES_FOLDER_ORDER.getOrNull(bestIdx)
                ?: throw IllegalStateException("Invalid species index $bestIdx")
            val bestGuess = folder.replaceFirstChar { it.uppercaseChar() }
            val display = if (uncertain) "Uncertain" else bestGuess
            val pct = (bestProb.coerceIn(0f, 1f) * 100.0).let { "%.1f%%".format(it) }
            val confText = if (uncertain) "$pct (guess: $bestGuess)" else pct
            Result.success(
                CoffeeSpeciesPrediction(
                    speciesDisplay = display,
                    confidence = bestProb,
                    confidenceText = confText,
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
        const val MODEL_ASSET = "coffee_species_model.tflite"
        private val SPECIES_FOLDER_ORDER = listOf("liberica", "robusta")
    }
}
