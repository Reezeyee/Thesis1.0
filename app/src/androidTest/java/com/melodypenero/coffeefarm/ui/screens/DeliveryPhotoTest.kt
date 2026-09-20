package com.melodypenero.coffeefarm.ui.screens

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.provider.MediaStore
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.melodypenero.coffeefarm.domain.PROOF_DATA_URL_PREFIX
import com.melodypenero.coffeefarm.domain.PROOF_MAX_JPEG_BYTES
import com.melodypenero.coffeefarm.domain.PROOF_MAX_SIDE_PX
import com.melodypenero.coffeefarm.domain.isValidProofDataUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.Random

/** The real photo pipeline on a real phone: a big, sideways, noisy camera-style JPEG becomes a small valid proof. */
@RunWith(AndroidJUnit4::class)
class DeliveryPhotoTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

    /** A large landscape JPEG full of random noise (the worst case for compression) tagged "rotate 90" like a phone held upright. */
    private fun fakeCameraPhoto(): File {
        val w = 3000
        val h = 2000
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val rnd = Random(42)
        val row = IntArray(w)
        for (y in 0 until h) {
            for (x in 0 until w) row[x] = (0xFF shl 24) or rnd.nextInt(0xFFFFFF)
            bmp.setPixels(row, 0, w, 0, y, w, 1)
        }
        val file = DeliveryPhoto.newCaptureFile(context)
        file.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 92, it) }
        ExifInterface(file.absolutePath).apply {
            setAttribute(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_ROTATE_90.toString())
            saveAttributes()
        }
        bmp.recycle()
        return file
    }

    @Test
    fun aHugeNoisySidewaysPhotoBecomesASmallValidUprightProof() {
        val file = fakeCameraPhoto()
        val originalKb = file.length() / 1024
        val encoded = DeliveryPhoto.encodeBlocking(file)
        file.delete()
        assertNotNull("photo could not be encoded", encoded)
        encoded!!
        assertTrue("prefix", encoded.dataUrl.startsWith(PROOF_DATA_URL_PREFIX))
        assertTrue("within the size firestore.rules accepts", isValidProofDataUrl(encoded.dataUrl))

        val jpeg = Base64.decode(encoded.dataUrl.removePrefix(PROOF_DATA_URL_PREFIX), Base64.DEFAULT)
        assertTrue("jpeg ${jpeg.size} bytes (from a ${originalKb} KB original)", jpeg.size <= PROOF_MAX_JPEG_BYTES)
        val decoded = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size)
        assertNotNull("result must decode as an image", decoded)
        assertTrue("longest side <= $PROOF_MAX_SIDE_PX", maxOf(decoded.width, decoded.height) <= PROOF_MAX_SIDE_PX)
        assertTrue("EXIF rotation applied: a landscape file tagged rotate-90 must come out portrait (${decoded.width}x${decoded.height})", decoded.height > decoded.width)
    }

    @Test
    fun aFileThatIsNotAnImageIsRejectedNotCrashed() {
        val file = DeliveryPhoto.newCaptureFile(context).apply { writeText("this is not a photo") }
        val encoded = DeliveryPhoto.encodeBlocking(file)
        file.delete()
        assertEquals(null, encoded)
    }

    @Test
    fun theCameraCanWriteIntoOurFileProvider_andThisPhoneHasACameraApp() {
        val file = DeliveryPhoto.newCaptureFile(context)
        val uri = DeliveryPhoto.uriFor(context, file)
        assertEquals("content", uri.scheme)
        assertEquals("${context.packageName}.fileprovider", uri.authority)
        val capture = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        assertNotNull("this phone has no camera app to take the proof photo", capture.resolveActivity(context.packageManager))
        file.delete()
    }
}
