package com.melodypenero.coffeefarm.domain

import com.melodypenero.coffeefarm.data.store.WorkerRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RiderDeliveriesTest {
    private val full = mapOf<String, Any?>(
        "buyerName" to "Wavo Test",
        "buyerPhone" to "09171234567",
        "deliveryAddress" to "Purok 3, Angeles City, Pampanga",
        "deliveryProvince" to "Pampanga",
        "deliveryLat" to 15.1450,
        "deliveryLng" to 120.5887,
        "paymentMethod" to "cash",
        "totalAmount" to 820L,           // Firestore may hand back Long or Double
        "deliveryFee" to 100.0,
        "status" to "pending",
        "deliveryStatus" to "assigned",
        "createdAt" to "2026-09-20T10:00:00Z",
        "items" to listOf(
            mapOf("name" to "Green Beans", "quantity" to 1L, "unit" to "kg"),
            mapOf("name" to "Roasted Beans", "quantity" to 2.5, "unit" to "kg")
        )
    )

    @Test
    fun parse_readsEveryFieldTheRiderNeeds() {
        val o = parseRiderOrder("abc123", full)
        assertEquals("Wavo Test", o.buyerName)
        assertEquals("09171234567", o.buyerPhone)
        assertEquals("Purok 3, Angeles City, Pampanga", o.address)
        assertEquals(15.1450, o.lat!!, 0.0)
        assertEquals(120.5887, o.lng!!, 0.0)
        assertEquals(820.0, o.totalAmount, 0.0)
        assertEquals(2, o.items.size)
        assertEquals(2.5, o.items[1].quantity, 0.0)
        assertTrue(o.hasPin)
    }

    @Test
    fun parse_toleratesOldOrdersWithoutNewFields() {
        val o = parseRiderOrder("old1", mapOf("buyerName" to "Old", "totalAmount" to 120.0))
        assertFalse(o.hasPin)
        assertEquals("pending", o.status)
        assertEquals(DeliveryStatus.ASSIGNED, o.deliveryStatus)
        assertEquals("", o.buyerPhone)
        assertTrue(o.items.isEmpty())
    }

    @Test
    fun cashToCollect_onlyForCashOnDelivery() {
        assertEquals(820.0, parseRiderOrder("a", full).cashToCollect, 0.0)
        val paid = parseRiderOrder("b", full + ("paymentMethod" to "e_wallet"))
        assertEquals(0.0, paid.cashToCollect, 0.0)
        assertFalse(paid.isCashOnDelivery)
    }

    @Test
    fun completed_whenDeliveredOrClosedByAdmin() {
        assertFalse(parseRiderOrder("a", full).isCompleted)
        assertFalse(parseRiderOrder("a", full + ("deliveryStatus" to "out_for_delivery")).isCompleted)
        assertTrue(parseRiderOrder("a", full + ("deliveryStatus" to "delivered")).isCompleted)
        assertTrue(parseRiderOrder("a", full + ("status" to "fulfilled")).isCompleted)
        assertTrue(parseRiderOrder("a", full + ("status" to "cancelled")).isCompleted)
    }

    @Test
    fun sort_activeOldestFirst_thenCompletedNewestFirst() {
        val a = parseRiderOrder("a", full + ("createdAt" to "2026-09-20T12:00:00Z"))
        val b = parseRiderOrder("b", full + ("createdAt" to "2026-09-20T09:00:00Z"))
        val c = parseRiderOrder("c", full + ("createdAt" to "2026-09-19T09:00:00Z") + ("deliveryStatus" to "delivered"))
        val d = parseRiderOrder("d", full + ("createdAt" to "2026-09-18T09:00:00Z") + ("status" to "fulfilled"))
        assertEquals(listOf("b", "a", "c", "d"), sortForRider(listOf(d, a, c, b)).map { it.orderId })
    }

    @Test
    fun riderRecognition_byUidOrEmail_onlyForActiveDeliveryRiders() {
        val rider = WorkerRecord(name = "Rico", roleRate = "Delivery Rider", authUid = "uid-rider", accountEmail = "rico@acojidofarm.local")
        val picker = WorkerRecord(name = "Pia", roleRate = "Picker", authUid = "uid-pick", accountEmail = "pia@acojidofarm.local")
        val inactiveRider = WorkerRecord(
            name = "Ivan", roleRate = "Delivery Rider", authUid = "uid-old", accountEmail = "ivan@acojidofarm.local",
            details = "{\"status\":\"inactive\"}"
        )
        val all = listOf(picker, rider, inactiveRider)
        assertEquals("Rico", findRiderWorker("uid-rider", "x@y.com", all)?.name)
        assertEquals("Rico", findRiderWorker("other", "RICO@acojidofarm.local", all)?.name)   // email, any case
        assertNull(findRiderWorker("uid-pick", "pia@acojidofarm.local", all))                  // picker is not a rider
        assertNull(findRiderWorker("uid-old", "ivan@acojidofarm.local", all))                  // inactive rider
        assertNull(findRiderWorker("nobody", "nobody@x.com", all))
        // A rider with no login info can never be matched by a blank uid/email.
        val blank = WorkerRecord(name = "NoLogin", roleRate = "Delivery Rider")
        assertNull(findRiderWorker("", "", listOf(blank)))
        assertNotNull(findRiderWorker("uid-rider", "", all))
    }

    @Test
    fun deliveryRole_matchesRiderAndDriverWording() {
        assertTrue(FarmFinance.isDeliveryRole("Delivery Rider"))
        assertTrue(FarmFinance.isDeliveryRole(" driver "))
        assertFalse(FarmFinance.isDeliveryRole("Picker"))
        assertFalse(FarmFinance.isDeliveryRole("Farm Assist"))
    }

    @Test
    fun mapPage_isSelfContainedLeafletWithThePinAndPeriodDecimals() {
        val html = leafletMapHtml(15.145, 120.5887)
        assertTrue(html.contains("setView([15.145000, 120.588700], 17)"))
        assertTrue(html.contains("L.marker([15.145000, 120.588700]"))
        assertTrue(html.contains("https://tile.openstreetmap.org/{z}/{x}/{y}.png"))
        assertTrue(html.contains("leaflet.min.js") && html.contains("leaflet.min.css"))
        assertTrue("falls back to a message when Leaflet can't load", html.contains("typeof L === 'undefined'"))
        assertTrue("map div has an explicit pixel height", html.contains("#map{width:100%;height:240px}"))
        assertTrue(leafletMapHtml(1.0, 2.0, heightPx = 300).contains("#map{width:100%;height:300px}"))
        assertFalse("no comma decimals", html.contains("15,145"))
        assertTrue(MAP_BASE_URL.startsWith("https://"))
    }

    @Test
    fun mapLinks_usePeriodDecimalsAndEncodeText() {
        assertEquals("google.navigation:q=15.145000,120.588700", navigationUri(15.145, 120.5887))
        assertEquals("geo:15.145000,120.588700?q=15.145000,120.588700(Wavo%20Test)", geoUri(15.145, 120.5887, "Wavo Test"))
        assertEquals(
            "https://www.google.com/maps/dir/?api=1&destination=15.145000%2C120.588700",
            mapsWebUrl(15.145, 120.5887, "ignored")
        )
        assertEquals(
            "https://www.google.com/maps/search/?api=1&query=Purok%203%2C%20Angeles",
            mapsWebUrl(null, null, "Purok 3, Angeles")
        )
    }
}
