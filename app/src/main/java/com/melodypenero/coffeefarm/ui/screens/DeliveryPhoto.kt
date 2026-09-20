package com.melodypenero.coffeefarm.ui.screens

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import com.melodypenero.coffeefarm.domain.PROOF_DATA_URL_PREFIX
import com.melodypenero.coffeefarm.domain.PROOF_MAX_JPEG_BYTES
import com.melodypenero.coffeefarm.domain.PROOF_MAX_SIDE_PX
import com.melodypenero.coffeefarm.domain.fitWithin
import com.melodypenero.coffeefarm.domain.proofFitsLimit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Capture and compression of the rider's proof-of-delivery photo. The camera app saves a full-size photo into
 * this app's cache (through a FileProvider); [encode] then straightens it, shrinks it to a readable-but-small
 * size, and turns it into the JPEG data URL that firestore.rules accepts.
 */
object DeliveryPhoto {
    /** The photo, ready to upload, plus a preview to show the rider before they confirm. */
    data class Encoded(val dataUrl: String, val preview: Bitmap)

    fun newCaptureFile(context: Context): File {
        val dir = File(context.cacheDir, "delivery_proof").apply { mkdirs() }
        return File.createTempFile("proof_", ".jpg", dir)
    }

    fun uriFor(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

    /** Returns null if the file can't be read as an image or can't be made small enough. */
    suspend fun encode(file: File): Encoded? = withContext(Dispatchers.Default) {
        runCatching { encodeBlocking(file) }.getOrNull()
    }

    fun encodeBlocking(file: File): Encoded? {
        val path = file.absolutePath
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        // Decode at a reduced size straight away: a 12 MP camera photo would otherwise need ~48 MB of memory.
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= PROOF_MAX_SIDE_PX) sample *= 2
        val decoded = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null

        var bitmap = scaleToFit(rotateUpright(decoded, exifRotationDegrees(path)), PROOF_MAX_SIDE_PX)
        // Try decreasing JPEG quality, then a smaller picture, until it fits what the rules allow.
        for (attempt in 0 until 4) {
            for (quality in intArrayOf(75, 65, 55, 45)) {
                val bytes = compressJpeg(bitmap, quality)
                if (bytes.size <= PROOF_MAX_JPEG_BYTES && proofFitsLimit(bytes.size)) {
                    return Encoded(PROOF_DATA_URL_PREFIX + Base64.encodeToString(bytes, Base64.NO_WRAP), bitmap)
                }
            }
            bitmap = Bitmap.createScaledBitmap(bitmap, (bitmap.width * 0.8f).toInt().coerceAtLeast(1), (bitmap.height * 0.8f).toInt().coerceAtLeast(1), true)
        }
        return null
    }

    private fun compressJpeg(bitmap: Bitmap, quality: Int): ByteArray =
        ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, quality, it) }.toByteArray()

    private fun scaleToFit(bitmap: Bitmap, maxSide: Int): Bitmap {
        val (w, h) = fitWithin(bitmap.width, bitmap.height, maxSide)
        return if (w == bitmap.width && h == bitmap.height) bitmap else Bitmap.createScaledBitmap(bitmap, w, h, true)
    }

    private fun exifRotationDegrees(path: String): Int =
        when (runCatching { ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90
            ExifInterface.ORIENTATION_ROTATE_180 -> 180
            ExifInterface.ORIENTATION_ROTATE_270 -> 270
            else -> 0
        }

    private fun rotateUpright(bitmap: Bitmap, degrees: Int): Bitmap {
        if (degrees == 0) return bitmap
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees.toFloat()) }, true)
    }
}
