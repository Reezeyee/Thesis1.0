package com.melodypenero.coffeefarm.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.data.orders.BuyerCatalogRepository
import com.melodypenero.coffeefarm.data.orders.BuyerOrdersRepository
import com.melodypenero.coffeefarm.domain.BuyerOrderItem
import com.melodypenero.coffeefarm.domain.LUZON_PROVINCES
import com.melodypenero.coffeefarm.domain.ProductListing
import com.melodypenero.coffeefarm.domain.availableAfterHolds
import com.melodypenero.coffeefarm.domain.deliveryFeeFor
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmEmptyState
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Buyer home: the same Admin-managed catalog the website's storefront shows, a cart, and checkout
 * (delivery or pickup, cash or e-wallet). Orders go straight to `buyer_orders` -- see
 * [BuyerOrdersRepository] -- never through the shared farm state, matching how the website's
 * storefront places orders.
 */
@Composable
fun BuyerShopScreen(session: AuthSession) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var listings by remember { mutableStateOf<List<ProductListing>>(emptyList()) }
    var reserved by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var cart by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }

    LaunchedEffect(Unit) {
        BuyerCatalogRepository.observeListings().collect { result ->
            loading = false
            result.onSuccess { listings = it; loadError = null }
                .onFailure { loadError = "Couldn't load the shop. Check your connection and try again." }
        }
    }
    LaunchedEffect(Unit) {
        BuyerCatalogRepository.observeReservedByListing().collect { reserved = it }
    }

    fun availableOf(l: ProductListing) = availableAfterHolds(l.availableQty, reserved[l.listingId] ?: 0.0)

    val sortedListings = remember(listings, reserved) {
        listings.sortedByDescending { availableOf(it) > 0 }
    }

    fun setQty(listingId: String, qty: Double, max: Double) {
        val clamped = qty.coerceIn(0.0, max)
        cart = if (clamped <= 0.0) cart - listingId else cart + (listingId to clamped)
    }

    val cartItems = remember(cart, listings) {
        listings.mapNotNull { l ->
            val qty = cart[l.listingId] ?: 0.0
            if (qty <= 0.0) return@mapNotNull null
            val subtotal = Math.round(qty * l.pricePerUnit * 100) / 100.0
            BuyerOrderItem(l.listingId, l.name, l.unit, l.pricePerUnit, qty, subtotal)
        }
    }
    val cartSubtotal = cartItems.sumOf { it.subtotal }

    var showCheckout by remember { mutableStateOf(false) }

    FarmLazyScreen {
        item {
            FarmSectionTitle(
                title = "Shop",
                subtitle = when {
                    loading -> "Loading products…"
                    listings.isEmpty() -> "The farm hasn't listed anything for sale yet."
                    else -> "${listings.size} product${if (listings.size == 1) "" else "s"} from the farm"
                }
            )
        }
        if (loadError != null) item { FarmInfoBanner(text = loadError!!) }
        if (loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = farmPalette().accent)
                }
            }
        } else if (listings.isEmpty() && loadError == null) {
            item {
                FarmEmptyState(
                    title = "No products yet",
                    subtitle = "Check back soon — the farm hasn't listed anything for sale.",
                    icon = Icons.Default.Storefront
                )
            }
        }
        items(sortedListings.size) { i ->
            val l = sortedListings[i]
            ListingCard(
                listing = l,
                available = availableOf(l),
                qtyInCart = cart[l.listingId] ?: 0.0,
                onQtyChange = { q -> setQty(l.listingId, q, availableOf(l)) }
            )
        }
        if (cartItems.isNotEmpty()) {
            item {
                FarmCard(modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${cartItems.size} item${if (cartItems.size == 1) "" else "s"} in cart", color = farmPalette().textPrimary, fontWeight = FontWeight.SemiBold)
                        Text(peso(cartSubtotal), color = farmPalette().accent, fontWeight = FontWeight.Bold)
                    }
                    FarmPrimaryButton(text = "Checkout", onClick = { showCheckout = true }, icon = Icons.Default.ShoppingCart)
                }
            }
        }
    }

    if (showCheckout) {
        CheckoutDialog(
            session = session,
            cartItems = cartItems,
            cartSubtotal = cartSubtotal,
            onDismiss = { showCheckout = false },
            onPlaced = {
                cart = emptyMap()
                showCheckout = false
                Toast.makeText(context, "Order placed! Track it under My Orders.", Toast.LENGTH_LONG).show()
            }
        )
    }
}

@Composable
private fun ListingCard(
    listing: ProductListing,
    available: Double,
    qtyInCart: Double,
    onQtyChange: (Double) -> Unit
) {
    val palette = farmPalette()
    val soldOut = available <= 0.0
    FarmCard(modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(listing.name.ifBlank { "Product" }, style = MaterialTheme.typography.titleMedium, color = palette.textPrimary, fontWeight = FontWeight.Bold)
                Text(listing.category, style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
            }
            Text(
                "${peso(listing.pricePerUnit)} / ${listing.unit}",
                style = MaterialTheme.typography.titleMedium,
                color = palette.accent,
                fontWeight = FontWeight.Bold
            )
        }
        Text(
            if (soldOut) "Out of stock" else "${formatQty(available)} ${listing.unit} available",
            style = MaterialTheme.typography.labelMedium,
            color = if (soldOut) MaterialTheme.colorScheme.error else palette.textSecondary
        )
        if (!soldOut) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.End) {
                IconButton(onClick = { onQtyChange(qtyInCart - 1) }, enabled = qtyInCart > 0.0) {
                    Icon(Icons.Default.Remove, contentDescription = "Fewer", tint = palette.accent)
                }
                Text(formatQty(qtyInCart), color = palette.textPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 12.dp))
                IconButton(onClick = { onQtyChange(qtyInCart + 1) }, enabled = qtyInCart < available) {
                    Icon(Icons.Default.Add, contentDescription = "More", tint = palette.accent)
                }
            }
        }
    }
}

@Composable
private fun CheckoutDialog(
    session: AuthSession,
    cartItems: List<BuyerOrderItem>,
    cartSubtotal: Double,
    onDismiss: () -> Unit,
    onPlaced: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val palette = farmPalette()

    var fulfillmentMethod by remember { mutableStateOf("delivery") }
    var address by remember { mutableStateOf("") }
    var province by remember { mutableStateOf("") }
    var provinceMenuOpen by remember { mutableStateOf(false) }
    var paymentMethod by remember { mutableStateOf("cash") }
    var phone by remember { mutableStateOf("") }
    var deliveryLat by remember { mutableStateOf<Double?>(null) }
    var deliveryLng by remember { mutableStateOf<Double?>(null) }
    var placing by remember { mutableStateOf(false) }
    var placeError by remember { mutableStateOf<String?>(null) }

    val locationManager = remember(context) { context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager }
    fun hasLocationPermission() =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun captureLocation() {
        val lm = locationManager ?: return
        if (!hasLocationPermission()) return
        val best = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .mapNotNull { provider -> try { @Suppress("MissingPermission") lm.getLastKnownLocation(provider) } catch (_: Exception) { null } }
            .maxByOrNull { it.time }
        if (best != null) {
            deliveryLat = best.latitude
            deliveryLng = best.longitude
        }
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        if (granted[Manifest.permission.ACCESS_FINE_LOCATION] == true || granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            captureLocation()
        } else {
            Toast.makeText(context, "Location permission is needed to share your delivery pin.", Toast.LENGTH_SHORT).show()
        }
    }

    val deliveryFeeAmount = if (fulfillmentMethod == "delivery") deliveryFeeFor(province) else 0.0
    val cartTotal = Math.round((cartSubtotal + deliveryFeeAmount) * 100) / 100.0

    fun placeOrder() {
        val trimmedPhone = sanitizePhoneInput(phone)
        val trimmedAddress = address.trim()
        if (!isValidPhone11(trimmedPhone)) {
            placeError = PHONE_ERROR_MESSAGE
            return
        }
        if (fulfillmentMethod == "delivery" && trimmedAddress.isBlank()) {
            placeError = "Enter the address where the order should be delivered."
            return
        }
        if (fulfillmentMethod == "delivery" && province.isBlank()) {
            placeError = "Choose your province so we can work out the delivery fee."
            return
        }
        placing = true
        placeError = null
        scope.launch {
            val result = runCatching {
                BuyerOrdersRepository.placeOrder(
                    buyerUid = session.userId,
                    buyerName = session.displayName.ifBlank { session.email },
                    buyerEmail = session.email,
                    buyerPhone = trimmedPhone,
                    fulfillmentMethod = fulfillmentMethod,
                    deliveryAddress = if (fulfillmentMethod == "delivery") trimmedAddress else null,
                    deliveryProvince = if (fulfillmentMethod == "delivery") province else null,
                    deliveryLat = if (fulfillmentMethod == "delivery") deliveryLat else null,
                    deliveryLng = if (fulfillmentMethod == "delivery") deliveryLng else null,
                    paymentMethod = paymentMethod,
                    items = cartItems,
                    subtotal = cartSubtotal,
                    deliveryFee = deliveryFeeAmount,
                    totalAmount = cartTotal
                )
            }
            placing = false
            result.onSuccess { onPlaced() }
                .onFailure { placeError = "Could not place your order. Check your connection and try again." }
        }
    }

    AlertDialog(
        onDismissRequest = { if (!placing) onDismiss() },
        containerColor = palette.surface,
        title = { Text("Checkout", color = palette.textPrimary, fontWeight = FontWeight.SemiBold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Total: ${peso(cartTotal)}", color = palette.accent, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)

                Text("Fulfillment", color = palette.textPrimary, fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = fulfillmentMethod == "delivery", onClick = { fulfillmentMethod = "delivery" })
                    Text("Delivery", color = palette.textPrimary, modifier = Modifier.padding(end = 16.dp))
                    RadioButton(selected = fulfillmentMethod == "pickup", onClick = { fulfillmentMethod = "pickup" })
                    Text("Pick up at the farm", color = palette.textPrimary)
                }

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = sanitizePhoneInput(it) },
                    label = { Text("Phone (09171234567)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (fulfillmentMethod == "delivery") {
                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        label = { Text("Delivery address") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Box {
                        OutlinedButton(onClick = { provinceMenuOpen = true }, modifier = Modifier.fillMaxWidth()) {
                            Text(province.ifBlank { "Choose province" }, color = palette.textPrimary)
                        }
                        DropdownMenu(expanded = provinceMenuOpen, onDismissRequest = { provinceMenuOpen = false }) {
                            LUZON_PROVINCES.forEach { p ->
                                DropdownMenuItem(text = { Text(p) }, onClick = { province = p; provinceMenuOpen = false })
                            }
                        }
                    }
                    if (province.isNotBlank()) {
                        Text("Delivery fee: ${peso(deliveryFeeAmount)}", color = palette.textSecondary, style = MaterialTheme.typography.bodySmall)
                    }
                    OutlinedButton(onClick = {
                        if (hasLocationPermission()) captureLocation()
                        else locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    }, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
                        Text(
                            if (deliveryLat != null) " Location pin captured" else " Share my location for the rider",
                            color = palette.textPrimary
                        )
                    }
                }

                Text("Payment", color = palette.textPrimary, fontWeight = FontWeight.SemiBold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = paymentMethod == "cash", onClick = { paymentMethod = "cash" })
                    Text(if (fulfillmentMethod == "pickup") "Cash at pickup" else "Cash on Delivery", color = palette.textPrimary, modifier = Modifier.padding(end = 16.dp))
                    RadioButton(selected = paymentMethod == "e_wallet", onClick = { paymentMethod = "e_wallet" })
                    Text("E-wallet", color = palette.textPrimary)
                }

                if (placeError != null) {
                    Text(placeError!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = ::placeOrder, enabled = !placing) {
                Text(if (placing) "Placing order…" else "Place order", color = palette.accent, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !placing) { Text("Cancel", color = palette.textSecondary) }
        }
    )
}

private fun peso(amount: Double) = String.format(Locale.US, "₱%,.2f", amount)

private fun formatQty(q: Double) = if (q % 1.0 == 0.0) q.toLong().toString() else q.toString()
