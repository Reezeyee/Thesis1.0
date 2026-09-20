package com.melodypenero.coffeefarm.ui.screens

import android.graphics.Bitmap
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.melodypenero.coffeefarm.domain.RiderOrder
import com.melodypenero.coffeefarm.domain.RiderOrderItem
import com.melodypenero.coffeefarm.ui.theme.CoffeeFarmTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Renders the real Delivery Rider screen with sample orders (no login, no Firebase, no account data)
 * and drives it the way a rider would. Screenshots go to the app's external files dir for review.
 */
@RunWith(AndroidJUnit4::class)
class RiderDeliveriesScreenTest {
    @get:Rule
    val rule = createComposeRule()

    private var called: String? = null
    private var texted: String? = null
    private var navigated: RiderOrder? = null
    private var started: RiderOrder? = null
    private var delivered: RiderOrder? = null

    private fun order(
        id: String,
        name: String = "Wavo Test",
        payment: String = "cash",
        total: Double = 820.0,
        deliveryStatus: String = "assigned",
        status: String = "pending",
        pin: Boolean = true,
        createdAt: String = "2026-09-20T10:00:00Z"
    ) = RiderOrder(
        orderId = id,
        buyerName = name,
        buyerPhone = "09171234567",
        address = "Purok 3, Brgy. San Jose, Angeles City, Pampanga",
        province = "Pampanga",
        lat = if (pin) 15.1450 else null,
        lng = if (pin) 120.5887 else null,
        paymentMethod = payment,
        totalAmount = total,
        deliveryFee = 100.0,
        items = listOf(RiderOrderItem("Green Beans", 1.0, "kg"), RiderOrderItem("Roasted Beans", 2.0, "kg")),
        status = status,
        deliveryStatus = deliveryStatus,
        createdAt = createdAt
    )

    private var tookPhotoFor: RiderOrder? = null
    private var proofCleared = false

    private fun show(orders: List<RiderOrder>, loading: Boolean = false, error: String? = null, proof: Bitmap? = null) {
        rule.setContent {
            CoffeeFarmTheme {
                RiderDeliveriesContent(
                    riderName = "Rico Rider",
                    orders = orders,
                    loading = loading,
                    error = error,
                    onCall = { called = it },
                    onText = { texted = it },
                    onNavigate = { navigated = it },
                    onStart = { started = it },
                    onDelivered = { delivered = it },
                    proofPhotoFor = { proof },
                    onTakeProofPhoto = { tookPhotoFor = it },
                    onClearProof = { proofCleared = true }
                )
            }
        }
    }

    private fun samplePhoto(): Bitmap = Bitmap.createBitmap(200, 150, Bitmap.Config.ARGB_8888).apply { eraseColor(android.graphics.Color.rgb(90, 140, 60)) }

    private fun screenshot(name: String) {
        val inst = InstrumentationRegistry.getInstrumentation()
        val bmp = inst.uiAutomation.takeScreenshot() ?: return
        val dir = File(inst.targetContext.getExternalFilesDir(null), "rider-test").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    fun showsBuyerContactAddressCashItemsAndMap() {
        show(listOf(order("a1")))
        rule.onNodeWithText("My Deliveries").assertIsDisplayed()
        rule.onNodeWithText("Hi Rico — 1 to deliver").assertIsDisplayed()
        rule.onNodeWithText("Wavo Test").assertIsDisplayed()
        rule.onNodeWithText("09171234567").assertIsDisplayed()
        rule.onNodeWithText("Call").assertIsDisplayed()
        rule.onNodeWithText("Text").assertIsDisplayed()
        rule.onNodeWithText("Purok 3, Brgy. San Jose, Angeles City, Pampanga").assertIsDisplayed()
        rule.onNodeWithText("Collect ₱820.00 cash").assertIsDisplayed()
        rule.onNodeWithText("• Green Beans × 1 kg").assertIsDisplayed()
        // The first delivery opens with its map showing.
        rule.onNodeWithTag("map-a1").assertIsDisplayed()
        rule.onNodeWithText("Hide map").assertIsDisplayed()
        // Give the OpenStreetMap tiles time to load, then capture what the rider sees.
        Thread.sleep(10000)
        screenshot("1-top-with-map")
        rule.onNodeWithText("Start delivery").performScrollTo()
        Thread.sleep(500)
        screenshot("2-actions")
    }

    @Test
    fun startDelivery_reportsTheOrderToStart() {
        show(listOf(order("a1")))
        rule.onNodeWithText("Start delivery").performScrollTo().performClick()
        assertEquals("a1", started?.orderId)
    }

    @Test
    fun markDelivered_askedToConfirmCashFirst_andCancelDoesNothing() {
        show(listOf(order("a2", deliveryStatus = "out_for_delivery")), proof = samplePhoto())
        rule.onNodeWithText("On the way").assertIsDisplayed()
        rule.onNodeWithText("Mark delivered").performScrollTo().performClick()
        rule.onNodeWithText("Delivered to Wavo Test?").assertIsDisplayed()
        rule.onNodeWithText("Make sure you collected ₱820.00 in cash before confirming.").assertIsDisplayed()
        screenshot("3-confirm-dialog")
        rule.onNodeWithText("Not yet").performClick()
        assertNull(delivered)
        assertTrue("cancelling drops the photo", proofCleared)
        rule.onNodeWithText("Mark delivered").performScrollTo().performClick()
        rule.onNodeWithTag("confirm-delivered").performClick()
        assertEquals("a2", delivered?.orderId)
    }

    @Test
    fun deliveredCannotBeConfirmedWithoutAPhoto_andTheCameraButtonAsksForOne() {
        show(listOf(order("p1", deliveryStatus = "out_for_delivery")))
        rule.onNodeWithText("Mark delivered").performScrollTo().performClick()
        rule.onNodeWithText("Take a photo of the delivered order as proof. The farm and the buyer can see it.").assertIsDisplayed()
        rule.onNodeWithTag("confirm-delivered").assertIsNotEnabled()
        rule.onNodeWithText("Take proof photo").assertIsDisplayed()
        rule.onNodeWithTag("take-proof-photo").performClick()
        assertEquals("p1", tookPhotoFor?.orderId)
        assertNull("nothing is delivered without a photo", delivered)
        screenshot("5-proof-required")
    }

    @Test
    fun withAPhoto_previewShowsRetakeIsOffered_andConfirmIsEnabled() {
        show(listOf(order("p2", deliveryStatus = "out_for_delivery")), proof = samplePhoto())
        rule.onNodeWithText("Mark delivered").performScrollTo().performClick()
        rule.onNodeWithTag("proof-preview").assertIsDisplayed()
        rule.onNodeWithText("Retake photo").assertIsDisplayed()
        rule.onNodeWithTag("confirm-delivered").assertIsEnabled().performClick()
        assertEquals("p2", delivered?.orderId)
        screenshot("6-proof-with-photo")
    }

    @Test
    fun completedOrderWithAProof_saysThePhotoWasSent() {
        show(listOf(order("d9", deliveryStatus = "delivered").copy(hasDeliveryProof = true)))
        rule.onNodeWithText("Proof photo sent to the farm and the buyer").assertExists()
    }

    @Test
    fun eWalletOrder_showsNoCashToCollect() {
        show(listOf(order("a3", payment = "e_wallet", deliveryStatus = "out_for_delivery")))
        rule.onNodeWithText("Paid by e-wallet — no cash to collect").assertIsDisplayed()
        rule.onNodeWithText("Mark delivered").performScrollTo().performClick()
        rule.onNodeWithText("This order is paid by e-wallet, so there is no cash to collect.").assertIsDisplayed()
    }

    @Test
    fun callTextAndNavigateButtonsReportTheRightThing() {
        show(listOf(order("a4")))
        rule.onNodeWithText("Call").performClick()
        rule.onNodeWithText("Text").performClick()
        rule.onNodeWithText("Navigate").performScrollTo().performClick()
        assertEquals("09171234567", called)
        assertEquals("09171234567", texted)
        assertEquals("a4", navigated?.orderId)
    }

    @Test
    fun orderWithoutPin_explainsAndStillOffersNavigate() {
        show(listOf(order("a5", pin = false)))
        rule.onNodeWithText("The buyer didn't drop a map pin for this order. Tap Navigate to search their address instead.").assertIsDisplayed()
        rule.onNodeWithText("Navigate").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun activeOrdersListedBeforeCompleted_andCompletedHaveNoActionButtons() {
        show(
            listOf(
                order("act1", name = "Active Buyer"),
                order("done1", name = "Done Buyer", deliveryStatus = "delivered", createdAt = "2026-09-19T10:00:00Z")
            )
        )
        rule.onNodeWithText("To deliver (1)").assertIsDisplayed()
        // The completed section is further down a lazy list, so scroll the list until it is built.
        rule.onNode(hasScrollAction()).performScrollToNode(hasText("Completed (1)"))
        rule.onNodeWithText("Completed (1)").assertIsDisplayed()
        screenshot("4-completed-section")
        rule.onNodeWithText("Done Buyer").assertExists()
        rule.onNodeWithText("Delivered").assertExists()
        // Only the active delivery offers actions; the completed one has none.
        rule.onAllNodesWithText("Start delivery").assertCountEquals(1)
        rule.onAllNodesWithText("Navigate").assertCountEquals(1)
    }

    @Test
    fun emptyLoadingAndErrorStates() {
        show(emptyList())
        rule.onNodeWithText("No deliveries assigned").assertIsDisplayed()
        rule.onNodeWithText("Hi Rico, nothing to deliver right now.").assertIsDisplayed()
    }

    @Test
    fun errorBannerShows() {
        show(emptyList(), error = "Couldn't load your deliveries. Check your connection and try again.")
        rule.onNodeWithText("Couldn't load your deliveries. Check your connection and try again.").assertIsDisplayed()
    }
}
