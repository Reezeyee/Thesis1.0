package com.melodypenero.coffeefarm.data.orders

import com.google.firebase.firestore.FirebaseFirestore
import com.google.gson.Gson
import com.melodypenero.coffeefarm.data.firebase.FirebaseCollections
import com.melodypenero.coffeefarm.domain.ProductListing
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/** Raw shape of a listing inside app_state/farm's `stateJson` blob; nullable so a missing field never crashes the parse. */
private data class RawProductListing(
    val listingId: String? = null,
    val name: String? = null,
    val category: String? = null,
    val unit: String? = null,
    val pricePerUnit: Double? = null,
    val availableQty: Double? = null,
    val status: String? = null,
    val imageUrl: String? = null,
    val sourceHarvestWorkerName: String? = null,
    val sourceHarvestWeightText: String? = null,
    val sourceHarvestDate: String? = null
) {
    fun toProductListing() = ProductListing(
        listingId = listingId.orEmpty(),
        name = name.orEmpty(),
        category = category.orEmpty(),
        unit = unit.orEmpty(),
        pricePerUnit = pricePerUnit ?: 0.0,
        availableQty = availableQty ?: 0.0,
        status = status.orEmpty(),
        imageUrl = imageUrl,
        sourceHarvestWorkerName = sourceHarvestWorkerName,
        sourceHarvestWeightText = sourceHarvestWeightText,
        sourceHarvestDate = sourceHarvestDate
    )
}

/** Only the one field this repository needs out of the much larger shared app-state JSON. Gson ignores every other field. */
private data class FarmCatalogSnapshot(val productListings: List<RawProductListing>? = null)

/**
 * A Buyer's read-only view of the product catalog and live stock reservations. Deliberately bypasses
 * [com.melodypenero.coffeefarm.data.store.AppStore]: a Buyer account is never staff-role, so
 * firestore.rules blocks it from the shared-state write path that store participates in -- this
 * repository only ever reads.
 */
object BuyerCatalogRepository {
    private val db get() = FirebaseFirestore.getInstance()
    private val gson = Gson()

    /** Live product listings the admin has published, parsed out of the shared `app_state/farm` snapshot. */
    fun observeListings(): Flow<Result<List<ProductListing>>> = callbackFlow {
        val registration = db.collection(FirebaseCollections.APP_STATE)
            .document(FirebaseCollections.SHARED_FARM_DOCUMENT_ID)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                } else {
                    val json = snapshot?.getString("stateJson")
                    val listings = runCatching {
                        if (json.isNullOrBlank()) emptyList()
                        else gson.fromJson(json, FarmCatalogSnapshot::class.java)
                            ?.productListings.orEmpty()
                            .map { it.toProductListing() }
                            .filter { it.listingId.isNotBlank() }
                    }.getOrDefault(emptyList())
                    trySend(Result.success(listings))
                }
            }
        awaitClose { registration.remove() }
    }

    /** Live quantity reserved per listing across every pending order's stock hold. */
    fun observeReservedByListing(): Flow<Map<String, Double>> = callbackFlow {
        val registration = db.collection(FirebaseCollections.STOCK_HOLDS)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(emptyMap())
                    return@addSnapshotListener
                }
                val totals = mutableMapOf<String, Double>()
                for (doc in snapshot.documents) {
                    val items = doc.get("items") as? List<*> ?: continue
                    for (raw in items) {
                        val m = raw as? Map<*, *> ?: continue
                        val listingId = m["listingId"] as? String ?: continue
                        val qty = (m["quantity"] as? Number)?.toDouble() ?: continue
                        if (qty <= 0) continue
                        totals[listingId] = (totals[listingId] ?: 0.0) + qty
                    }
                }
                trySend(totals)
            }
        awaitClose { registration.remove() }
    }
}
