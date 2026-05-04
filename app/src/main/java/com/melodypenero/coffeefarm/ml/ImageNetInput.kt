package com.melodypenero.coffeefarm.ml

import android.graphics.Bitmap

/**
 * Matches `get_transforms()["eval"]` in `Cnn Training/train_thesis_models.py`:
 * bilinear resize, RGB [0,1], then ImageNet normalize.
 *
 * TFLite models may be exported as **NHWC** `[1, H, W, 3]` or **NCHW** `[1, 3, H, W]` (typical PyTorch);
 * [parseInputLayout] and the two [bitmapTo*] builders must match the model.
 */
internal object ImageNetInput {

    const val DEFAULT_SIZE = 224

    private const val MEAN_R = 0.485f
    private const val MEAN_G = 0.456f
    private const val MEAN_B = 0.406f
    private const val STD_R = 0.229f
    private const val STD_G = 0.224f
    private const val STD_B = 0.225f

    data class TfliteInputLayout(
        val nchw: Boolean,
        val height: Int,
        val width: Int,
    )

    /**
     * Returns layout for 4D float input. Supports NCHW [1,3,H,W] and NHWC [1,H,W,3].
     */
    fun parseInputLayout(shape: IntArray): TfliteInputLayout? {
        if (shape.size != 4) return null
        val b = shape[1]
        val c = shape[2]
        val d = shape[3]
        // PyTorch / many converters: NCHW
        if (b == 3 && c >= 8 && d >= 8) return TfliteInputLayout(nchw = true, height = c, width = d)
        // TFLite / mobile: NHWC
        if (d == 3 && b >= 8 && c >= 8) return TfliteInputLayout(nchw = false, height = b, width = c)
        return null
    }

    private fun fillNormalizedFromPixels(
        pixels: IntArray,
        width: Int,
        height: Int,
        putPixel: (y: Int, x: Int, rNorm: Float, gNorm: Float, bNorm: Float) -> Unit
    ) {
        var idx = 0
        for (y in 0 until height) {
            for (x in 0 until width) {
                val p = pixels[idx++]
                val r = ((p shr 16) and 0xFF) / 255f
                val g = ((p shr 8) and 0xFF) / 255f
                val b = (p and 0xFF) / 255f
                putPixel(
                    y, x,
                    (r - MEAN_R) / STD_R,
                    (g - MEAN_G) / STD_G,
                    (b - MEAN_B) / STD_B
                )
            }
        }
    }

    /**
     * NHWC: [1][H][W][3] for [Interpreter.run].
     */
    fun bitmapToNhwcFloat(source: Bitmap, width: Int, height: Int): Array<Array<Array<FloatArray>>> {
        val scaled = if (source.width != width || source.height != height) {
            Bitmap.createScaledBitmap(source, width, height, true)
        } else {
            source
        }
        val input = Array(1) { Array(height) { Array(width) { FloatArray(3) } } }
        val pixels = IntArray(width * height)
        scaled.getPixels(pixels, 0, width, 0, 0, width, height)
        fillNormalizedFromPixels(pixels, width, height) { y, x, rn, gn, bn ->
            input[0][y][x][0] = rn
            input[0][y][x][1] = gn
            input[0][y][x][2] = bn
        }
        if (scaled !== source) scaled.recycle()
        return input
    }

    /**
     * NCHW: [1][3][H][W] for PyTorch-style exports.
     */
    fun bitmapToNchwFloat(source: Bitmap, width: Int, height: Int): Array<Array<Array<FloatArray>>> {
        val scaled = if (source.width != width || source.height != height) {
            Bitmap.createScaledBitmap(source, width, height, true)
        } else {
            source
        }
        // Kotlin nested arrays: [batch][channel][y][x]  — channel-major last dim is W
        val input = Array(1) { Array(3) { Array(height) { FloatArray(width) } } }
        val pixels = IntArray(width * height)
        scaled.getPixels(pixels, 0, width, 0, 0, width, height)
        fillNormalizedFromPixels(pixels, width, height) { y, x, rn, gn, bn ->
            input[0][0][y][x] = rn
            input[0][1][y][x] = gn
            input[0][2][y][x] = bn
        }
        if (scaled !== source) scaled.recycle()
        return input
    }
}
