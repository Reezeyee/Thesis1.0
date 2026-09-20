package com.melodypenero.coffeefarm.data.orders

import com.google.firebase.firestore.FirebaseFirestore
import com.melodypenero.coffeefarm.data.firebase.FirebaseCollections
import com.melodypenero.coffeefarm.domain.DeliveryStatus
import com.melodypenero.coffeefarm.domain.RiderOrder
import com.melodypenero.coffeefarm.domain.isValidProofDataUrl
import com.melodypenero.coffeefarm.domain.parseRiderOrder
import com.melodypenero.coffeefarm.domain.sortForRider
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.time.Instant

/**
 * A Delivery Rider's view of `buyer_orders`. firestore.rules only lets a rider read orders whose
 * `riderUid` is their own uid (so the query MUST filter on it) and only change the delivery-progress
 * fields -- never the order's status, amounts, or the buyer's details.
 */
object RiderOrdersRepository {
    private val db get() = FirebaseFirestore.getInstance()

    /** Live list of the orders assigned to [riderUid], already sorted for the rider. */
    fun observe(riderUid: String): Flow<Result<List<RiderOrder>>> = callbackFlow {
        val registration = db.collection(FirebaseCollections.BUYER_ORDERS)
            .whereEqualTo("riderUid", riderUid)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(Result.failure(error ?: IllegalStateException("No data")))
                } else {
                    val orders = snapshot.documents.map { parseRiderOrder(it.id, it.data.orEmpty()) }
                    trySend(Result.success(sortForRider(orders)))
                }
            }
        awaitClose { registration.remove() }
    }

    /** Rider taps "Start delivery". (Delivered needs a photo -- see [markDelivered].) */
    suspend fun startDelivery(orderId: String) {
        val now = Instant.now().toString()
        db.collection(FirebaseCollections.BUYER_ORDERS).document(orderId)
            .update(mapOf("deliveryStatus" to DeliveryStatus.OUT_FOR_DELIVERY, "deliveryUpdatedAt" to now))
            .await()
    }

    /**
     * Rider confirms a delivery WITH its proof photo. The photo document and the order update are written in one
     * batch: firestore.rules only accepts "delivered" if the photo is saved in the same batch, so an order can
     * never be marked delivered without proof, and a photo is never left behind without the order updating.
     */
    suspend fun markDelivered(orderId: String, riderUid: String, photoDataUrl: String) {
        require(isValidProofDataUrl(photoDataUrl)) { "Proof photo must be a JPEG data URL within the size limit" }
        val now = Instant.now().toString()
        val batch = db.batch()
        batch.set(
            db.collection(FirebaseCollections.DELIVERY_PROOFS).document(orderId),
            mapOf("photo" to photoDataUrl, "takenAt" to now, "riderUid" to riderUid)
        )
        batch.update(
            db.collection(FirebaseCollections.BUYER_ORDERS).document(orderId),
            mapOf(
                "deliveryStatus" to DeliveryStatus.DELIVERED,
                "deliveryUpdatedAt" to now,
                "deliveredAt" to now,
                "hasDeliveryProof" to true
            )
        )
        batch.commit().await()
    }
}
