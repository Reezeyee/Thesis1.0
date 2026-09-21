package com.melodypenero.coffeefarm.domain

data class BuyerOrderItem(
    val listingId: String,
    val name: String,
    val unit: String,
    val pricePerUnit: Double,
    val quantity: Double,
    val subtotal: Double
)

/** A signed-in Buyer's own view of one of their `buyer_orders` documents. */
data class BuyerOrder(
    val orderId: String,
    val items: List<BuyerOrderItem>,
    val subtotal: Double,
    val deliveryFee: Double,
    val totalAmount: Double,
    /** Admin-side status: pending / fulfilled / cancelled. */
    val status: String,
    val fulfillmentMethod: String,
    val deliveryAddress: String?,
    val deliveryProvince: String?,
    val paymentMethod: String,
    val createdAt: String,
    val fulfilledAt: String?,
    val riderName: String?,
    val riderPhone: String?,
    /** Rider-reported delivery progress: assigned / out_for_delivery / delivered (null for pickup orders). */
    val deliveryStatus: String?,
    val hasDeliveryProof: Boolean
) {
    val isPickup: Boolean get() = fulfillmentMethod == "pickup"
    val isCashOnDelivery: Boolean get() = paymentMethod == "cash"
    val isActive: Boolean get() = status == "pending"
}

private fun Any?.asDouble(): Double? = (this as? Number)?.toDouble()

/** Builds a [BuyerOrder] from a raw Firestore document map. Tolerant of older orders missing newer fields. */
fun parseBuyerOrder(orderId: String, data: Map<String, Any?>): BuyerOrder {
    val items = (data["items"] as? List<*>).orEmpty().mapNotNull { raw ->
        val m = raw as? Map<*, *> ?: return@mapNotNull null
        BuyerOrderItem(
            listingId = m["listingId"]?.toString().orEmpty(),
            name = m["name"]?.toString().orEmpty(),
            unit = m["unit"]?.toString().orEmpty(),
            pricePerUnit = m["pricePerUnit"].asDouble() ?: 0.0,
            quantity = m["quantity"].asDouble() ?: 0.0,
            subtotal = m["subtotal"].asDouble() ?: 0.0
        )
    }
    return BuyerOrder(
        orderId = orderId,
        items = items,
        subtotal = data["subtotal"].asDouble() ?: items.sumOf { it.subtotal },
        deliveryFee = data["deliveryFee"].asDouble() ?: 0.0,
        totalAmount = data["totalAmount"].asDouble() ?: 0.0,
        status = data["status"]?.toString().orEmpty().ifBlank { "pending" },
        fulfillmentMethod = data["fulfillmentMethod"]?.toString().orEmpty().ifBlank { "delivery" },
        deliveryAddress = data["deliveryAddress"]?.toString(),
        deliveryProvince = data["deliveryProvince"]?.toString(),
        paymentMethod = data["paymentMethod"]?.toString().orEmpty().ifBlank { "cash" },
        createdAt = data["createdAt"]?.toString().orEmpty(),
        fulfilledAt = data["fulfilledAt"]?.toString(),
        riderName = data["riderName"]?.toString(),
        riderPhone = data["riderPhone"]?.toString(),
        deliveryStatus = data["deliveryStatus"]?.toString(),
        hasDeliveryProof = data["hasDeliveryProof"] == true
    )
}

/** Newest orders first. */
fun sortForBuyer(orders: List<BuyerOrder>): List<BuyerOrder> = orders.sortedByDescending { it.createdAt }
