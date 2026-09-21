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

/**
 * Delivery fees for storefront orders, by Luzon province. Mirrors the website's `lib/orderCheckout.ts`
 * DELIVERY_ZONES table exactly -- keep both in sync if the farm changes pricing.
 */
private data class DeliveryZone(val label: String, val fee: Double, val provinces: List<String>)

private val DELIVERY_ZONES = listOf(
    DeliveryZone("Bataan", 60.0, listOf("Bataan")),
    DeliveryZone("Nearby Central Luzon", 100.0, listOf("Pampanga", "Zambales")),
    DeliveryZone("Greater Manila area", 150.0, listOf("Bulacan", "Tarlac", "Metro Manila")),
    DeliveryZone("Central & South Luzon", 250.0, listOf("Nueva Ecija", "Cavite", "Laguna", "Rizal", "Pangasinan")),
    DeliveryZone("Far South & North-Central Luzon", 350.0, listOf("Batangas", "Quezon", "La Union", "Benguet", "Nueva Vizcaya", "Aurora")),
    DeliveryZone("Northern Luzon", 450.0, listOf("Ilocos Sur", "Abra", "Mountain Province", "Ifugao", "Quirino", "Isabela", "Kalinga")),
    DeliveryZone("Far North & Bicol", 550.0, listOf("Ilocos Norte", "Cagayan", "Apayao", "Camarines Norte", "Camarines Sur", "Albay", "Sorsogon")),
    DeliveryZone(
        "Island provinces (ferry / air freight)", 750.0,
        listOf("Marinduque", "Romblon", "Oriental Mindoro", "Occidental Mindoro", "Catanduanes", "Masbate", "Palawan", "Batanes")
    )
)

/** Every province a buyer can pick for delivery, in the same order as the website's dropdown. */
val LUZON_PROVINCES: List<String> = DELIVERY_ZONES.flatMap { it.provinces }

private val FEE_BY_PROVINCE: Map<String, Double> =
    DELIVERY_ZONES.flatMap { zone -> zone.provinces.map { it to zone.fee } }.toMap()

private val MAX_FEE = DELIVERY_ZONES.maxOf { it.fee }

/** Delivery fee in pesos for a province; 0 while none is chosen. */
fun deliveryFeeFor(province: String): Double {
    if (province.isBlank()) return 0.0
    return FEE_BY_PROVINCE[province] ?: MAX_FEE
}

// Phone validation lives in ui/screens/InputRules.kt (sanitizePhoneInput, isValidPhone11,
// PHONE_ERROR_MESSAGE) -- the app's one standing phone rule; reuse it instead of duplicating here.
