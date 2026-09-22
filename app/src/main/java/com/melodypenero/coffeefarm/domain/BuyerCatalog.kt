package com.melodypenero.coffeefarm.domain

/** A product listing the admin published on the storefront (mirrors the website's ProductListingRecord). */
data class ProductListing(
    val listingId: String,
    val name: String,
    val category: String,
    val unit: String,
    val pricePerUnit: Double,
    val availableQty: Double,
    val status: String,
    val imageUrl: String? = null,
    val sourceHarvestWorkerName: String? = null,
    val sourceHarvestWeightText: String? = null,
    val sourceHarvestDate: String? = null
)

/** What a buyer can still order: stock minus what pending orders have already reserved, never below zero. */
fun availableAfterHolds(availableQty: Double, reserved: Double): Double =
    (availableQty - reserved).coerceAtLeast(0.0)

// Phone validation lives in ui/screens/InputRules.kt (sanitizePhoneInput, isValidPhone11,
// PHONE_ERROR_MESSAGE) -- the app's one standing phone rule; reuse it instead of duplicating here.
