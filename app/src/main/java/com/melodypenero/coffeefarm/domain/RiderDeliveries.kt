package com.melodypenero.coffeefarm.domain

import com.melodypenero.coffeefarm.data.store.WorkerRecord
import java.net.URLEncoder
import java.util.Locale

/** Progress the rider reports on a buyer order; the admin's own `status` (fulfilled/cancelled) is separate. */
object DeliveryStatus {
    const val ASSIGNED = "assigned"
    const val OUT_FOR_DELIVERY = "out_for_delivery"
    const val DELIVERED = "delivered"
}

data class RiderOrderItem(val name: String, val quantity: Double, val unit: String)

/**
 * A buyer order assigned to the signed-in Delivery Rider (a `buyer_orders` document). Holds only
 * what a rider needs: who to deliver to, where, how much cash to collect, and progress.
 */
data class RiderOrder(
    val orderId: String,
    val buyerName: String,
    val buyerPhone: String,
    val address: String,
    val province: String,
    val lat: Double?,
    val lng: Double?,
    /** "cash" (Cash on Delivery) or "e_wallet". */
    val paymentMethod: String,
    val totalAmount: Double,
    val deliveryFee: Double,
    val items: List<RiderOrderItem>,
    /** Admin-side order status: pending / fulfilled / cancelled. */
    val status: String,
    val deliveryStatus: String,
    val createdAt: String,
    /** The rider already saved a proof-of-delivery photo for this order. */
    val hasDeliveryProof: Boolean = false
) {
    val hasPin: Boolean get() = lat != null && lng != null
    val isCashOnDelivery: Boolean get() = paymentMethod == "cash"

    /** What the rider must collect from the buyer on arrival (e-wallet orders are paid separately). */
    val cashToCollect: Double get() = if (isCashOnDelivery) totalAmount else 0.0

    /** Done (delivered by the rider, or closed by the admin) -- shown under Completed. */
    val isCompleted: Boolean
        get() = deliveryStatus == DeliveryStatus.DELIVERED || status == "fulfilled" || status == "cancelled"
}

private fun Any?.asDouble(): Double? = (this as? Number)?.toDouble()

/** Builds a [RiderOrder] from a raw Firestore document map. Tolerant of older orders missing newer fields. */
fun parseRiderOrder(orderId: String, data: Map<String, Any?>): RiderOrder {
    val items = (data["items"] as? List<*>).orEmpty().mapNotNull { raw ->
        val m = raw as? Map<*, *> ?: return@mapNotNull null
        RiderOrderItem(
            name = m["name"]?.toString().orEmpty(),
            quantity = m["quantity"].asDouble() ?: 0.0,
            unit = m["unit"]?.toString().orEmpty()
        )
    }
    return RiderOrder(
        orderId = orderId,
        buyerName = data["buyerName"]?.toString().orEmpty(),
        buyerPhone = data["buyerPhone"]?.toString().orEmpty(),
        address = data["deliveryAddress"]?.toString().orEmpty(),
        province = data["deliveryProvince"]?.toString().orEmpty(),
        lat = data["deliveryLat"].asDouble(),
        lng = data["deliveryLng"].asDouble(),
        paymentMethod = data["paymentMethod"]?.toString().orEmpty(),
        totalAmount = data["totalAmount"].asDouble() ?: 0.0,
        deliveryFee = data["deliveryFee"].asDouble() ?: 0.0,
        items = items,
        status = data["status"]?.toString().orEmpty().ifBlank { "pending" },
        deliveryStatus = data["deliveryStatus"]?.toString().orEmpty().ifBlank { DeliveryStatus.ASSIGNED },
        createdAt = data["createdAt"]?.toString().orEmpty(),
        hasDeliveryProof = data["hasDeliveryProof"] == true
    )
}

/** Active deliveries first, oldest order first (deliver in the order they came in); completed after, newest first. */
fun sortForRider(orders: List<RiderOrder>): List<RiderOrder> {
    val (done, active) = orders.partition { it.isCompleted }
    return active.sortedBy { it.createdAt } + done.sortedByDescending { it.createdAt }
}

/**
 * The worker record for this login if -- and only if -- they are an active Delivery Rider. Matched by
 * the login's Firebase uid (set when the admin created the worker account) or the account email.
 */
fun findRiderWorker(userId: String, email: String, workers: List<WorkerRecord>): WorkerRecord? =
    workers.firstOrNull { w ->
        w.isActive && FarmFinance.isDeliveryRole(w.roleRate) &&
            ((w.authUid.isNotBlank() && w.authUid == userId) ||
                (w.accountEmail.isNotBlank() && w.accountEmail.equals(email.trim(), ignoreCase = true)))
    }

private fun coord(v: Double) = String.format(Locale.US, "%.6f", v)

/** Base URL for the map page: OpenStreetMap's tile servers require requests to carry a real Referer. */
const val MAP_BASE_URL = "https://acojido-farm.app/"

/**
 * A small self-contained page (Leaflet + OpenStreetMap tiles, no API key) with the buyer's pin,
 * for the rider's WebView. It replaces OpenStreetMap's own embed page, which collapses to zero height
 * when loaded outside an iframe. The map div gets an explicit pixel height because percentage heights collapse to 0
 * inside a WebView in a Compose list. Needs internet; shows a message instead of a blank box if Leaflet can't load.
 */
fun leafletMapHtml(lat: Double, lng: Double, heightPx: Int = 240, zoom: Int = 17): String = """
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
html,body{margin:0;padding:0;height:100%;background:#e8e4dc}
#map{width:100%;height:${heightPx}px}
.pin{width:28px;height:28px;background:#c45c26;border:2px solid #fefdfb;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)}
.msg{font:14px sans-serif;color:#4a2c2a;padding:16px}
</style></head><body><div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
if (typeof L === 'undefined') {
  document.body.innerHTML = '<p class="msg">The map could not load. Check your connection, or tap Navigate to open the address in Maps.</p>';
} else {
  var map = L.map('map').setView([${coord(lat)}, ${coord(lng)}], $zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  L.marker([${coord(lat)}, ${coord(lng)}], {
    icon: L.divIcon({className: '', html: '<div class="pin"></div>', iconSize: [28, 28], iconAnchor: [14, 28]})
  }).addTo(map);
}
</script></body></html>
""".trimIndent()

/** Opens turn-by-turn navigation in Google Maps. */
fun navigationUri(lat: Double, lng: Double): String = "google.navigation:q=${coord(lat)},${coord(lng)}"

/** Any installed maps app. */
fun geoUri(lat: Double, lng: Double, label: String): String =
    "geo:${coord(lat)},${coord(lng)}?q=${coord(lat)},${coord(lng)}(${URLEncoder.encode(label, "UTF-8").replace("+", "%20")})"

/** Browser fallback when no maps app can handle a geo: link; uses the pin if there is one, else searches the typed address. */
fun mapsWebUrl(lat: Double?, lng: Double?, address: String): String =
    if (lat != null && lng != null) {
        "https://www.google.com/maps/dir/?api=1&destination=${coord(lat)}%2C${coord(lng)}"
    } else {
        "https://www.google.com/maps/search/?api=1&query=" + URLEncoder.encode(address, "UTF-8").replace("+", "%20")
    }
