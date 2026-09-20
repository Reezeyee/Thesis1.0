package com.melodypenero.coffeefarm.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.melodypenero.coffeefarm.domain.PROOF_DATA_URL_PREFIX
import com.melodypenero.coffeefarm.domain.PROOF_MAX_JPEG_BYTES
import com.melodypenero.coffeefarm.domain.PROOF_MAX_SIDE_PX
import com.melodypenero.coffeefarm.domain.RiderOrder
import com.melodypenero.coffeefarm.domain.RiderOrderItem
import com.melodypenero.coffeefarm.domain.isValidProofDataUrl
import com.melodypenero.coffeefarm.ui.theme.CoffeeFarmTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * OPT-IN, needs a person (or adb) to work the real camera app, so it only runs with `-e liveCamera true`.
 * It opens the real Delivered dialog, taps "Take proof photo", waits for a real photo to be taken with the
 * phone's camera, and then checks the photo came back compressed, valid, and ready to confirm the delivery.
 */
@RunWith(AndroidJUnit4::class)
class LiveCameraProofTest {
    @get:Rule
    val rule = createComposeRule()

    @Test
    fun aRealCameraPhotoBecomesAValidProofAndConfirmsTheDelivery() {
        assumeTrue("opt-in: run with -e liveCamera true", InstrumentationRegistry.getArguments().getString("liveCamera") == "true")
        var delivered: RiderOrder? = null
        lateinit var capture: ProofCapture
        val order = RiderOrder(
            orderId = "live1", buyerName = "Camera Test", buyerPhone = "09171234567", address = "Test address", province = "Bataan",
            lat = 14.68, lng = 120.53, paymentMethod = "e_wallet", totalAmount = 100.0, deliveryFee = 0.0,
            items = listOf(RiderOrderItem("Green Beans", 1.0, "kg")), status = "pending", deliveryStatus = "out_for_delivery", createdAt = "2026-09-21T00:00:00Z"
        )
        rule.setContent {
            CoffeeFarmTheme {
                capture = rememberProofCapture()
                RiderDeliveriesContent(
                    riderName = "Riki", orders = listOf(order), loading = false, error = null,
                    onCall = {}, onText = {}, onNavigate = {}, onStart = {}, onDelivered = { delivered = it },
                    proofPhotoFor = capture::previewFor, proofBusy = capture.busy,
                    onTakeProofPhoto = capture::take, onClearProof = capture::clear
                )
            }
        }
        rule.onNodeWithText("Mark delivered").performScrollTo().performClick()
        rule.onNodeWithTag("take-proof-photo").performClick()

        // The real camera app is now in front. Wait (up to 3 minutes) for a photo to come back.
        val deadline = System.currentTimeMillis() + 180_000
        while (capture.proof == null && System.currentTimeMillis() < deadline) Thread.sleep(500)
        val proof = capture.proof
        assertNotNull("no photo came back from the camera within 3 minutes", proof)
        proof!!

        assertTrue(isValidProofDataUrl(proof.dataUrl))
        val jpeg = Base64.decode(proof.dataUrl.removePrefix(PROOF_DATA_URL_PREFIX), Base64.DEFAULT)
        assertTrue("jpeg is ${jpeg.size} bytes", jpeg.size <= PROOF_MAX_JPEG_BYTES)
        val bmp = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size)
        assertNotNull(bmp)
        assertTrue("longest side ${maxOf(bmp.width, bmp.height)}", maxOf(bmp.width, bmp.height) <= PROOF_MAX_SIDE_PX)

        // Save what the farm/buyer would receive so it can be pulled and looked at, plus a screenshot of the dialog.
        val inst = InstrumentationRegistry.getInstrumentation()
        val dir = File(inst.targetContext.getExternalFilesDir(null), "rider-test").apply { mkdirs() }
        File(dir, "live-camera-proof.jpg").writeBytes(jpeg)
        File(dir, "live-camera-result.txt").writeText("size=${jpeg.size} bytes, ${bmp.width}x${bmp.height}")

        rule.onNodeWithTag("proof-preview").assertIsDisplayed()
        inst.uiAutomation.takeScreenshot()?.let { shot ->
            File(dir, "live-camera-dialog.png").outputStream().use { shot.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
        rule.onNodeWithTag("confirm-delivered").assertIsEnabled().performClick()
        assertEquals("live1", delivered?.orderId)
    }
}
