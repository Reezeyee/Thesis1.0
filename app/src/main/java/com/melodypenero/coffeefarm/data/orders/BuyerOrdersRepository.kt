package com.melodypenero.coffeefarm.data.orders

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.melodypenero.coffeefarm.data.firebase.FirebaseCollections
import com.melodypenero.coffeefarm.domain.BuyerOrder
import com.melodypenero.coffeefarm.domain.BuyerOrderItem
import com.melodypenero.coffeefarm.domain.parseBuyerOrder
import com.melodypenero.coffeefarm.domain.sortForBuyer
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.time.Instant

/**
 * A Buyer's own `buyer_orders`: place a new order and watch the ones they've placed. Mirrors the
 * website's `BuyerStorefront.placeOrder` write shape exactly -- firestore.rules requires the order's
 * `buyerUid` to be the caller's own uid, `status` to start `'pending'`, and no rider/delivery-progress
 * fields on create; the stock hold written alongside it must carry only `items`/`createdAt` and the
 * exact same `items` as the order, or the whole batch is rejected.
 */
object BuyerOrdersRepository {
    private val db get() = FirebaseFirestore.getInstance()

    /** Live list of orders this buyer has placed, newest first. */
    fun observeMyOrders(buyerUid: String): Flow<Result<List<BuyerOrder>>> = callbackFlow {
        val registration = db.collection(FirebaseCollections.BUYER_ORDERS)
            .whereEqualTo("buyerUid", buyerUid)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(Result.failure(error ?: IllegalStateException("No data")))
                } else {
                    val orders = snapshot.documents.map { parseBuyerOrder(it.id, it.data.orEmpty()) }
                    trySend(Result.success(sortForBuyer(orders)))
                }
            }
        awaitClose { registration.remove() }
    }

    /** Places a new order + its stock hold in one batch. Throws on failure (permission, network, or a rules mismatch). */
    suspend fun placeOrder(
        buyerUid: String,
        buyerName: String,
        buyerEmail: String,
        buyerPhone: String,
        fulfillmentMethod: String,
        deliveryAddress: String?,
        deliveryProvince: String?,
        deliveryLat: Double?,
        deliveryLng: Double?,
        paymentMethod: String,
        items: List<BuyerOrderItem>,
        subtotal: Double,
        deliveryFee: Double,
        totalAmount: Double
    ) {
        val itemMaps = items.map { item ->
            mapOf(
                "listingId" to item.listingId,
                "name" to item.name,
                "unit" to item.unit,
                "pricePerUnit" to item.pricePerUnit,
                "quantity" to item.quantity,
                "subtotal" to item.subtotal
            )
        }
        val orderRef = db.collection(FirebaseCollections.BUYER_ORDERS).document()
        val now = Instant.now().toString()
        val orderData = mapOf(
            "buyerUid" to buyerUid,
            "buyerName" to buyerName,
            "buyerEmail" to buyerEmail,
            "buyerPhone" to buyerPhone,
            "fulfillmentMethod" to fulfillmentMethod,
            "deliveryAddress" to if (fulfillmentMethod == "delivery") deliveryAddress else null,
            "deliveryProvince" to if (fulfillmentMethod == "delivery") deliveryProvince else null,
            "deliveryLat" to if (fulfillmentMethod == "delivery") deliveryLat else null,
            "deliveryLng" to if (fulfillmentMethod == "delivery") deliveryLng else null,
            "paymentMethod" to paymentMethod,
            "items" to itemMaps,
            "subtotal" to subtotal,
            "deliveryFee" to deliveryFee,
            "totalAmount" to totalAmount,
            "status" to "pending",
            "createdAt" to now,
            "fulfilledAt" to null,
            "_serverCreatedAt" to FieldValue.serverTimestamp()
        )
        val holdData = mapOf("items" to itemMaps, "createdAt" to now)

        val batch = db.batch()
        batch.set(orderRef, orderData)
        batch.set(db.collection(FirebaseCollections.STOCK_HOLDS).document(orderRef.id), holdData)
        batch.commit().await()
    }
}
