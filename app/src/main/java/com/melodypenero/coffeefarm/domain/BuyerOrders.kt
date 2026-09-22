package com.melodypenero.coffeefarm.domain

data class BuyerOrderItem(
    val listingId: String,
    val name: String,
    val unit: String,
    val pricePerUnit: Double,
    val quantity: Double,
    val subtotal: Double
)

/**
 * A signed-in Buyer's own view of one of their `buyer_orders` documents. Every order is picked up
 * at the farm by the buyer -- there is no delivery.
 */
data class BuyerOrder(
    val orderId: String,
    val items: List<BuyerOrderItem>,
    val totalAmount: Double,
    /** pending -> ready (buyer is told "Product is ready to pick up") -> fulfilled, or cancelled. */
    val status: String,
    val paymentMethod: String,
    val createdAt: String,
    val readyAt: String?,
    val fulfilledAt: String?
) {
    val isCashAtPickup: Boolean get() = paymentMethod == "cash"
    val isActive: Boolean get() = status == "pending" || status == "ready"
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
        totalAmount = data["totalAmount"].asDouble() ?: items.sumOf { it.subtotal },
        status = data["status"]?.toString().orEmpty().ifBlank { "pending" },
        paymentMethod = data["paymentMethod"]?.toString().orEmpty().ifBlank { "cash" },
        createdAt = data["createdAt"]?.toString().orEmpty(),
        readyAt = data["readyAt"]?.toString(),
        fulfilledAt = data["fulfilledAt"]?.toString()
    )
}

/** Newest orders first. */
fun sortForBuyer(orders: List<BuyerOrder>): List<BuyerOrder> = orders.sortedByDescending { it.createdAt }
