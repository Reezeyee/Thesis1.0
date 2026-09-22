package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Store
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.data.orders.BuyerOrdersRepository
import com.melodypenero.coffeefarm.domain.BuyerOrder
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmEmptyState
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette
import java.util.Locale

/** A signed-in Buyer's own order history: what they ordered and its pickup status. */
@Composable
fun BuyerOrdersScreen(session: AuthSession) {
    var orders by remember { mutableStateOf<List<BuyerOrder>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(session.userId) {
        BuyerOrdersRepository.observeMyOrders(session.userId).collect { result ->
            loading = false
            result.onSuccess { orders = it; error = null }
                .onFailure { error = "Couldn't load your orders. Check your connection and try again." }
        }
    }

    FarmLazyScreen {
        item {
            FarmSectionTitle(
                title = "My Orders",
                subtitle = when {
                    loading -> "Loading your orders…"
                    orders.isEmpty() -> "You haven't placed an order yet."
                    else -> "${orders.size} order${if (orders.size == 1) "" else "s"}"
                }
            )
        }
        if (error != null) item { FarmInfoBanner(text = error!!) }
        if (loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = farmPalette().accent)
                }
            }
        } else if (orders.isEmpty() && error == null) {
            item {
                FarmEmptyState(
                    title = "No orders yet",
                    subtitle = "Everything you order from the Shop tab shows up here with its status.",
                    icon = Icons.Default.ReceiptLong
                )
            }
        }
        items(orders.size) { i -> OrderCard(orders[i]) }
    }
}

@Composable
private fun OrderCard(order: BuyerOrder) {
    val palette = farmPalette()
    FarmCard(modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Order #${order.orderId.take(8).uppercase(Locale.US)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.Bold
                )
                Text(order.createdAt.take(10), style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
            }
            StatusChip(order)
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Default.Store,
                contentDescription = null,
                tint = palette.accent,
                modifier = Modifier.padding(end = 6.dp)
            )
            Text(
                if (order.status == "ready") "Product is ready to pick up" else "Pick up at the farm",
                style = MaterialTheme.typography.bodyMedium,
                color = palette.textPrimary
            )
        }

        order.items.forEach { item ->
            Text("• ${item.name} × ${formatQty(item.quantity)} ${item.unit}", style = MaterialTheme.typography.bodySmall, color = palette.textSecondary)
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                if (order.paymentMethod == "e_wallet") "E-wallet" else "Cash at pickup",
                style = MaterialTheme.typography.labelMedium,
                color = palette.textSecondary
            )
            Text(peso(order.totalAmount), color = palette.accent, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StatusChip(order: BuyerOrder) {
    val (label, color) = when (order.status) {
        "cancelled" -> "Cancelled" to Color(0xFFD9534F)
        "fulfilled" -> "Picked Up" to Color(0xFF84B626)
        "ready" -> "Ready for Pickup" to Color(0xFFE0A030)
        else -> "Pending" to farmPalette().textSecondary
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

private fun peso(amount: Double) = String.format(Locale.US, "₱%,.2f", amount)

private fun formatQty(q: Double) = if (q % 1.0 == 0.0) q.toLong().toString() else q.toString()
