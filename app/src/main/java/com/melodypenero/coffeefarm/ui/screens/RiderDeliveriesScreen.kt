package com.melodypenero.coffeefarm.ui.screens

import android.annotation.SuppressLint
import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.core.content.ContextCompat
import java.io.File
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Sms
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.data.orders.RiderOrdersRepository
import com.melodypenero.coffeefarm.domain.DeliveryStatus
import com.melodypenero.coffeefarm.domain.RiderOrder
import com.melodypenero.coffeefarm.domain.geoUri
import com.melodypenero.coffeefarm.domain.mapsWebUrl
import com.melodypenero.coffeefarm.domain.navigationUri
import com.melodypenero.coffeefarm.domain.MAP_BASE_URL
import com.melodypenero.coffeefarm.domain.leafletMapHtml
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmEmptyState
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSecondaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * Home screen for a signed-in Delivery Rider (replaces the field-tool dashboard): the buyer orders
 * the admin assigned to them, each with the buyer's contact, the delivery address on a map, the cash
 * to collect, and buttons to navigate, start, and complete the delivery.
 */
@Composable
fun RiderDeliveriesScreen(session: AuthSession) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var orders by remember { mutableStateOf<List<RiderOrder>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(session.userId) {
        RiderOrdersRepository.observe(session.userId).collect { result ->
            loading = false
            result
                .onSuccess { orders = it; error = null }
                .onFailure { error = "Couldn't load your deliveries. Check your connection and try again." }
        }
    }

    val capture = rememberProofCapture()

    RiderDeliveriesContent(
        riderName = session.displayName,
        orders = orders,
        loading = loading,
        error = error,
        onCall = { phone -> launchSafely(context, Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))) },
        onText = { phone -> launchSafely(context, Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$phone"))) },
        onNavigate = { order -> openNavigation(context, order) },
        onStart = { order ->
            scope.launch {
                runCatching { RiderOrdersRepository.startDelivery(order.orderId) }
                    .onFailure { Toast.makeText(context, "Couldn't update the delivery. Try again.", Toast.LENGTH_LONG).show() }
            }
        },
        onDelivered = { order ->
            val photo = capture.proof
            if (photo != null && capture.proofOrderId == order.orderId) {
                scope.launch {
                    capture.busy = true
                    runCatching { RiderOrdersRepository.markDelivered(order.orderId, session.userId, photo.dataUrl) }
                        .onSuccess { capture.clear() }
                        .onFailure {
                            Toast.makeText(context, "Couldn't save the delivery. Your photo is kept -- try again.", Toast.LENGTH_LONG).show()
                        }
                    capture.busy = false
                }
            }
        },
        proofPhotoFor = capture::previewFor,
        proofBusy = capture.busy,
        onTakeProofPhoto = capture::take,
        onClearProof = capture::clear
    )
}

/**
 * The proof-of-delivery photo while the rider is confirming a delivery: it opens the camera, compresses what
 * was taken, and holds the result until the delivery is saved. Shared by [RiderDeliveriesScreen] and the
 * on-device camera test so both run the very same capture code.
 */
@Stable
class ProofCapture internal constructor(private val requestPhoto: (RiderOrder) -> Unit) {
    var proof by mutableStateOf<DeliveryPhoto.Encoded?>(null)
    var proofOrderId by mutableStateOf<String?>(null)
    /** True while a photo is being processed or the delivery is being saved. */
    var busy by mutableStateOf(false)

    fun previewFor(orderId: String): Bitmap? = if (proofOrderId == orderId) proof?.preview else null
    fun take(order: RiderOrder) = requestPhoto(order)
    fun clear() { proof = null; proofOrderId = null }
}

@Composable
fun rememberProofCapture(): ProofCapture {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val requestRef = remember { mutableStateOf<(RiderOrder) -> Unit>({}) }
    val capture = remember { ProofCapture { order -> requestRef.value(order) } }
    var captureFile by remember { mutableStateOf<File?>(null) }
    var pendingCameraOrder by remember { mutableStateOf<RiderOrder?>(null) }

    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val file = captureFile
        if (file != null) {
            if (!saved) {
                file.delete()
            } else {
                scope.launch {
                    capture.busy = true
                    val encoded = DeliveryPhoto.encode(file)
                    file.delete()
                    capture.busy = false
                    if (encoded == null) {
                        Toast.makeText(context, "Couldn't read that photo. Please take it again.", Toast.LENGTH_LONG).show()
                    } else {
                        capture.proof = encoded
                    }
                }
            }
        }
    }

    fun launchCamera(order: RiderOrder) {
        val file = DeliveryPhoto.newCaptureFile(context)
        captureFile = file
        capture.proofOrderId = order.orderId
        capture.proof = null
        try {
            takePicture.launch(DeliveryPhoto.uriFor(context, file))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(context, "No camera app found on this phone.", Toast.LENGTH_LONG).show()
        }
    }

    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val order = pendingCameraOrder
        pendingCameraOrder = null
        if (granted && order != null) launchCamera(order)
        else Toast.makeText(context, "Camera permission is needed to take the delivery photo.", Toast.LENGTH_LONG).show()
    }

    SideEffect {
        requestRef.value = { order ->
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                launchCamera(order)
            } else {
                pendingCameraOrder = order
                cameraPermission.launch(Manifest.permission.CAMERA)
            }
        }
    }
    return capture
}

@Composable
fun RiderDeliveriesContent(
    riderName: String,
    orders: List<RiderOrder>,
    loading: Boolean,
    error: String?,
    onCall: (String) -> Unit,
    onText: (String) -> Unit,
    onNavigate: (RiderOrder) -> Unit,
    onStart: (RiderOrder) -> Unit,
    onDelivered: (RiderOrder) -> Unit,
    /** The proof photo taken for this order id (a preview), or null if none yet. */
    proofPhotoFor: (String) -> Bitmap? = { null },
    /** True while a photo is being processed or the delivery is being saved. */
    proofBusy: Boolean = false,
    onTakeProofPhoto: (RiderOrder) -> Unit = {},
    onClearProof: () -> Unit = {}
) {
    val palette = farmPalette()
    val active = orders.filter { !it.isCompleted }
    val completed = orders.filter { it.isCompleted }
    var confirming by remember { mutableStateOf<RiderOrder?>(null) }
    // The first delivery to make opens with its map showing; the rest stay collapsed to keep the list light.
    var expandedId by remember(active.firstOrNull()?.orderId) { mutableStateOf(active.firstOrNull()?.orderId) }

    FarmLazyScreen {
        item {
            FarmSectionTitle(
                title = "My Deliveries",
                subtitle = when {
                    loading -> "Loading your deliveries…"
                    active.isEmpty() -> "Hi ${riderName.substringBefore(' ')}, nothing to deliver right now."
                    else -> "Hi ${riderName.substringBefore(' ')} — ${active.size} to deliver"
                }
            )
        }
        if (error != null) item { FarmInfoBanner(text = error) }
        if (loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = palette.accent)
                }
            }
        } else if (orders.isEmpty() && error == null) {
            item {
                FarmEmptyState(
                    title = "No deliveries assigned",
                    subtitle = "When the farm assigns you an order, it shows up here with the buyer's address and contact.",
                    icon = Icons.Default.LocalShipping
                )
            }
        }
        if (active.isNotEmpty()) {
            item { SectionLabel("To deliver (${active.size})") }
            items(active.size) { i ->
                val order = active[i]
                DeliveryCard(
                    order = order,
                    mapExpanded = expandedId == order.orderId,
                    onToggleMap = { expandedId = if (expandedId == order.orderId) null else order.orderId },
                    onCall = onCall,
                    onText = onText,
                    onNavigate = onNavigate,
                    onStart = onStart,
                    onDelivered = { confirming = order }
                )
            }
        }
        if (completed.isNotEmpty()) {
            item { SectionLabel("Completed (${completed.size})") }
            items(completed.size) { i ->
                val order = completed[i]
                DeliveryCard(
                    order = order,
                    mapExpanded = false,
                    onToggleMap = null,
                    onCall = onCall,
                    onText = onText,
                    onNavigate = onNavigate,
                    onStart = onStart,
                    onDelivered = {}
                )
            }
        }
    }

    confirming?.let { order ->
        val photo = proofPhotoFor(order.orderId)
        AlertDialog(
            onDismissRequest = { onClearProof(); confirming = null },
            containerColor = palette.surface,
            title = { Text("Delivered to ${order.buyerName}?", color = palette.textPrimary, fontWeight = FontWeight.SemiBold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        if (order.isCashOnDelivery) "Make sure you collected ${peso(order.cashToCollect)} in cash before confirming."
                        else "This order is paid by e-wallet, so there is no cash to collect.",
                        color = palette.textSecondary
                    )
                    Text("Take a photo of the delivered order as proof. The farm and the buyer can see it.", color = palette.textPrimary, style = MaterialTheme.typography.bodyMedium)
                    if (photo != null) {
                        Image(
                            bitmap = photo.asImageBitmap(),
                            contentDescription = "Proof of delivery photo",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(12.dp)).testTag("proof-preview")
                        )
                    }
                    OutlinedButton(
                        onClick = { onTakeProofPhoto(order) },
                        enabled = !proofBusy,
                        modifier = Modifier.fillMaxWidth().testTag("take-proof-photo"),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, palette.border)
                    ) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(if (photo == null) "Take proof photo" else "Retake photo", color = palette.textPrimary)
                    }
                    if (proofBusy) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(color = palette.accent, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Working on it…", color = palette.textSecondary)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { onDelivered(order); confirming = null },
                    enabled = photo != null && !proofBusy,
                    modifier = Modifier.testTag("confirm-delivered")
                ) {
                    Text("Yes, delivered", color = if (photo != null && !proofBusy) palette.accent else palette.textSecondary, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = { TextButton(onClick = { onClearProof(); confirming = null }) { Text("Not yet", color = palette.textSecondary) } }
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = farmPalette().textSecondary,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
private fun DeliveryCard(
    order: RiderOrder,
    mapExpanded: Boolean,
    onToggleMap: (() -> Unit)?,
    onCall: (String) -> Unit,
    onText: (String) -> Unit,
    onNavigate: (RiderOrder) -> Unit,
    onStart: (RiderOrder) -> Unit,
    onDelivered: () -> Unit
) {
    val palette = farmPalette()
    FarmCard(modifier = Modifier.fillMaxWidth().testTag("delivery-${order.orderId}")) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(order.buyerName.ifBlank { "Buyer" }, style = MaterialTheme.typography.titleMedium, color = palette.textPrimary, fontWeight = FontWeight.Bold)
                Text("Order #${order.orderId.take(8).uppercase(Locale.US)}", style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
            }
            StatusChip(order)
        }

        // Buyer contact: number on its own line so it never wraps, then Call / Text side by side.
        if (order.buyerPhone.isNotBlank()) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Phone, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(order.buyerPhone, style = MaterialTheme.typography.titleMedium, color = palette.textPrimary, fontWeight = FontWeight.SemiBold, maxLines = 1)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { onCall(order.buyerPhone) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, palette.border)
                ) {
                    Icon(Icons.Default.Phone, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Call", color = palette.textPrimary)
                }
                OutlinedButton(
                    onClick = { onText(order.buyerPhone) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, palette.border)
                ) {
                    Icon(Icons.Default.Sms, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Text", color = palette.textPrimary)
                }
            }
        }

        // Address
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Icon(Icons.Default.LocationOn, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp).padding(top = 2.dp))
            Spacer(Modifier.width(8.dp))
            Column {
                Text(order.address.ifBlank { "No address given" }, style = MaterialTheme.typography.bodyMedium, color = palette.textPrimary)
                if (order.province.isNotBlank()) Text(order.province, style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
            }
        }

        // Payment
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(palette.accentContainer).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Payments, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                when {
                    !order.isCashOnDelivery -> "Paid by e-wallet — no cash to collect"
                    order.isCompleted -> "Cash on delivery · ${peso(order.cashToCollect)}"
                    else -> "Collect ${peso(order.cashToCollect)} cash"
                },
                style = MaterialTheme.typography.bodyMedium, color = palette.textPrimary, fontWeight = FontWeight.SemiBold
            )
        }

        // Items
        order.items.forEach { item ->
            Text("• ${item.name} × ${formatQty(item.quantity)} ${item.unit}", style = MaterialTheme.typography.bodySmall, color = palette.textSecondary)
        }

        // Map
        if (onToggleMap != null) {
            TextButton(onClick = onToggleMap, modifier = Modifier.testTag("toggle-map-${order.orderId}")) {
                Icon(Icons.Default.Map, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(if (mapExpanded) "Hide map" else "Show map", color = palette.accent, fontWeight = FontWeight.SemiBold)
            }
            if (mapExpanded) {
                if (order.hasPin) {
                    OrderMap(order.lat!!, order.lng!!, Modifier.testTag("map-${order.orderId}"))
                } else {
                    FarmInfoBanner(text = "The buyer didn't drop a map pin for this order. Tap Navigate to search their address instead.")
                }
            }
        }

        if (order.isCompleted && order.hasDeliveryProof) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Proof photo sent to the farm and the buyer", style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
            }
        }

        // Actions
        if (!order.isCompleted) {
            FarmSecondaryButton(text = "Navigate", onClick = { onNavigate(order) }, icon = Icons.Default.Navigation)
            if (order.deliveryStatus == DeliveryStatus.OUT_FOR_DELIVERY) {
                FarmPrimaryButton(text = "Mark delivered", onClick = onDelivered, icon = Icons.Default.CheckCircle)
            } else {
                FarmPrimaryButton(text = "Start delivery", onClick = { onStart(order) }, icon = Icons.Default.LocalShipping)
            }
        }
    }
}

@Composable
private fun StatusChip(order: RiderOrder) {
    val (label, color) = when {
        order.status == "cancelled" -> "Cancelled" to Color(0xFFD9534F)
        order.deliveryStatus == DeliveryStatus.DELIVERED || order.status == "fulfilled" -> "Delivered" to Color(0xFF84B626)
        order.deliveryStatus == DeliveryStatus.OUT_FOR_DELIVERY -> "On the way" to Color(0xFFE0A030)
        else -> "To deliver" to farmPalette().textSecondary
    }
    Text(
        label,
        color = color,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}

private const val MAP_HEIGHT_DP = 240

/** The buyer's pin on an OpenStreetMap map (Leaflet, no API key), in a WebView. Needs internet. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun OrderMap(lat: Double, lng: Double, modifier: Modifier = Modifier) {
    var failed by remember(lat, lng) { mutableStateOf(false) }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(MAP_HEIGHT_DP.dp)
            .clip(RoundedCornerShape(12.dp))
    ) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = android.view.ViewGroup.LayoutParams(
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    webViewClient = object : WebViewClient() {
                        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                            if (request.isForMainFrame) failed = true
                        }
                    }
                    loadDataWithBaseURL(MAP_BASE_URL, leafletMapHtml(lat, lng, heightPx = MAP_HEIGHT_DP), "text/html", "utf-8", null)
                }
            },
            modifier = Modifier.fillMaxWidth().height(MAP_HEIGHT_DP.dp)
        )
        if (failed) {
            Box(Modifier.fillMaxWidth().height(MAP_HEIGHT_DP.dp).background(farmPalette().surface), contentAlignment = Alignment.Center) {
                Text(
                    "The map couldn't load. Check your connection, or tap Navigate to open the address in Maps.",
                    color = farmPalette().textSecondary,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }
    }
}

private fun peso(amount: Double) = String.format(Locale.US, "₱%,.2f", amount)

private fun formatQty(q: Double) = if (q % 1.0 == 0.0) q.toLong().toString() else q.toString()

private fun launchSafely(context: Context, intent: Intent) {
    try {
        context.startActivity(intent)
    } catch (_: ActivityNotFoundException) {
        Toast.makeText(context, "No app found to do that on this phone.", Toast.LENGTH_SHORT).show()
    }
}

/** Turn-by-turn in Google Maps, else any maps app, else the browser -- with the pin, or a search of the typed address. */
private fun openNavigation(context: Context, order: RiderOrder) {
    val attempts = buildList {
        if (order.hasPin) {
            add(Intent(Intent.ACTION_VIEW, Uri.parse(navigationUri(order.lat!!, order.lng!!))))
            add(Intent(Intent.ACTION_VIEW, Uri.parse(geoUri(order.lat!!, order.lng!!, order.buyerName.ifBlank { "Delivery" }))))
        }
        add(Intent(Intent.ACTION_VIEW, Uri.parse(mapsWebUrl(order.lat, order.lng, order.address))))
    }
    for (intent in attempts) {
        try {
            context.startActivity(intent)
            return
        } catch (_: ActivityNotFoundException) {
            // try the next option
        }
    }
    Toast.makeText(context, "No maps app or browser found.", Toast.LENGTH_SHORT).show()
}
