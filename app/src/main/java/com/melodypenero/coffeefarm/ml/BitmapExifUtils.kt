package com.melodypenero.coffeefarm.ml

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface

/**
 * Gallery and camera JPEGs often need EXIF orientation applied so the CNN sees the same
 * upright image the user sees.
 */
object BitmapExifUtils {

    fun loadBitmapWithOrientation(context: Context, uri: Uri): Bitmap? {
        val decoded = context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
            ?: return null
        val fd = context.contentResolver.openFileDescriptor(uri, "r") ?: return decoded
        return fd.use { pfd ->
            runCatching {
                val exif = ExifInterface(pfd.fileDescriptor)
                applyExifRotation(decoded, exif)
            }.getOrElse { decoded }
        }
    }

    fun loadBitmapWithOrientationFromFile(path: String): Bitmap? {
        val decoded = BitmapFactory.decodeFile(path) ?: return null
        return runCatching {
            val exif = ExifInterface(path)
            applyExifRotation(decoded, exif)
        }.getOrElse { decoded }
    }

    private fun applyExifRotation(bitmap: Bitmap, exif: ExifInterface): Bitmap {
        val orientation = exif.getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL
        )
        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90,
            ExifInterface.ORIENTATION_TRANSPOSE,
            ExifInterface.ORIENTATION_TRANSVERSE -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        if (degrees == 0f) return bitmap
        val matrix = Matrix().apply { postRotate(degrees) }
        val out = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (out != bitmap) bitmap.recycle()
        return out
    }
}
