package com.melodypenero.coffeefarm.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.data.store.ConsumableSupplyRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette

@Composable
fun SuppliesScreen(reporterDisplayName: String = "") {
    val store = LocalAppStore.current
    val state by store.appState
    val context = LocalContext.current
    val palette = farmPalette()
    val supplies = state.consumableSupplies
    val reports = state.consumableReports
    val activeUid = store.activeAuthUid.orEmpty()
    val linkedWorker = state.workers.firstOrNull { it.authUid.trim() == activeUid }
    val linkedWorkerName = linkedWorker?.name.orEmpty().trim().ifBlank { reporterDisplayName.trim() }
    val workerNames = state.workers.mapNotNull { it.name.trim().takeIf(String::isNotBlank) }.distinct().sorted()
    val supplyLabels = remember(supplies) {
        supplies.map { supply ->
            val stock = "${supply.stock} ${supply.unit}".trim()
            "${supply.name} · ${supply.category} · $stock"
        }
    }
    val supplyLabelToRecord = remember(supplies, supplyLabels) {
        supplyLabels.zip(supplies).toMap()
    }
    var reportDialogOpen by remember { mutableStateOf(false) }
    var withdrawDialogOpen by remember { mutableStateOf(false) }

    FarmLazyScreen(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            FarmSectionTitle(
                title = "Consumable supplies",
                subtitle = "Inventory is managed on the website. Workers can withdraw stock or report if supplies run out in the field."
            )
        }
        item {
            FarmInfoBanner(
                text = "Report fertilizer, pesticide, vitamins, bags, or other consumables before work is delayed."
            )
        }
        item {
            FarmCard {
                Text(
                    text = "Withdraw supply",
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "Getting supplies from the warehouse? Log the quantity so stock updates and the admin is notified with your name.",
                    color = palette.textSecondary,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))
                FarmPrimaryButton(
                    text = "Withdraw supply",
                    onClick = { withdrawDialogOpen = true },
                    enabled = supplies.any { it.stock > 0 } && (linkedWorkerName.isNotBlank() || workerNames.isNotEmpty())
                )
                if (supplies.none { it.stock > 0 }) {
                    Text(
                        text = "No consumable supplies currently in stock.",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
        item {
            FarmCard {
                Text(
                    text = "Report supply status",
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "Choose a supply from the website list and tell the admin if it ran out or still has stock.",
                    color = palette.textSecondary,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))
                FarmPrimaryButton(
                    text = "Create supply report",
                    onClick = { reportDialogOpen = true },
                    enabled = supplies.isNotEmpty() && (linkedWorkerName.isNotBlank() || workerNames.isNotEmpty())
                )
                if (supplies.isEmpty()) {
                    Text(
                        text = "No consumable supplies are available yet. Ask an admin to add supplies on the website first.",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                } else if (linkedWorkerName.isBlank() && workerNames.isEmpty()) {
                    Text(
                        text = "No workers found in the farm database. Ask the admin to add worker profiles on the website so reports can be attributed.",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }
        if (reports.isNotEmpty()) {
            item {
                FarmSectionTitle(
                    title = "Recent supply reports",
                    subtitle = "These are synced to the website Equipment page."
                )
            }
            items(
                reports.sortedByDescending { it.reportedAt }.take(10),
                key = { it.reportId.ifBlank { "${it.reportedAt}-${it.supplyName}" } }
            ) { report ->
                FarmCard {
                    Column {
                        Text(
                            text = report.supplyName.ifBlank { "Consumable supply" },
                            color = palette.textPrimary,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.titleMedium
                        )
                        val isWithdrawal = report.notes.startsWith("Withdrew ", ignoreCase = true)
                        Text(
                            text = when {
                                isWithdrawal && report.isRunOut -> "Withdrawn · now out of stock"
                                isWithdrawal -> "Withdrawn from stock"
                                report.isRunOut -> "Reported run out"
                                else -> "Reported still available"
                            },
                            color = if (report.isRunOut) Color(0xFFD4183D) else Color(0xFF2D5016),
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        Text(
                            text = buildString {
                                if (report.reportedAt.isNotBlank()) append(report.reportedAt)
                                if (report.reportedBy.isNotBlank()) {
                                    if (isNotEmpty()) append(" · ")
                                    append(report.reportedBy)
                                }
                            }.ifBlank { "Pending sync details" },
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        if (report.notes.isNotBlank()) {
                            Text(
                                text = report.notes,
                                color = palette.textSecondary,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                        if (report.reviewed) {
                            Text(
                                text = "Reviewed by admin",
                                color = Color(0xFF2D5016),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }
                }
            }
        }
        if (supplies.isNotEmpty()) {
            item {
                FarmSectionTitle(
                    title = "Website supply list",
                    subtitle = "Current stock shown from the shared farm database."
                )
            }
            items(supplies, key = { it.supplyId.ifBlank { "${it.name}-${it.category}" } }) { supply ->
                SupplyCard(supply)
            }
        }
    }

    if (withdrawDialogOpen) {
        val withdrawableSupplies = supplies.filter { it.stock > 0 }
        val withdrawSupplyLabels = remember(withdrawableSupplies) {
            withdrawableSupplies.map { supply ->
                "${supply.name} · ${supply.category} · ${supply.stock} ${supply.unit}".trim()
            }
        }
        val withdrawLabelToRecord = remember(withdrawableSupplies, withdrawSupplyLabels) {
            withdrawSupplyLabels.zip(withdrawableSupplies).toMap()
        }
        val fields = buildList {
            if (linkedWorkerName.isBlank()) {
                add(RecordField("Withdrawn by", options = workerNames))
            }
            add(RecordField("Supply", options = withdrawSupplyLabels))
            add(RecordField("Quantity"))
            add(RecordField("Report date"))
        }
        val initialValues = buildList {
            if (linkedWorkerName.isBlank()) {
                add(workerNames.firstOrNull().orEmpty())
            }
            add(withdrawSupplyLabels.firstOrNull().orEmpty())
            add("")
            add(java.time.LocalDate.now().toString())
        }
        SimpleRecordDialog(
            title = "Withdraw supply",
            fields = fields,
            initialValues = initialValues,
            onDismiss = { withdrawDialogOpen = false },
            onSave = { values ->
                val offset = if (linkedWorkerName.isBlank()) 1 else 0
                val worker = if (linkedWorkerName.isBlank()) values.getOrNull(0).orEmpty() else linkedWorkerName
                val supplyLabel = values.getOrNull(offset).orEmpty()
                val quantityText = values.getOrNull(offset + 1).orEmpty()
                val date = values.getOrNull(offset + 2).orEmpty()
                val supply = withdrawLabelToRecord[supplyLabel]
                val quantity = quantityText.trim().toIntOrNull()
                when {
                    supply == null -> Toast.makeText(context, "Choose a supply to withdraw.", Toast.LENGTH_SHORT).show()
                    quantity == null || quantity <= 0 -> Toast.makeText(context, "Enter a valid quantity greater than zero.", Toast.LENGTH_SHORT).show()
                    quantity > supply.stock -> Toast.makeText(context, "Only ${supply.stock} ${supply.unit} available in stock.", Toast.LENGTH_SHORT).show()
                    worker.isBlank() -> Toast.makeText(context, "Select who is withdrawing this supply.", Toast.LENGTH_SHORT).show()
                    else -> {
                        store.withdrawConsumableSupply(
                            supplyId = supply.supplyId,
                            quantity = quantity,
                            withdrawnBy = worker,
                            withdrawnByAuthUid = activeUid,
                            withdrawnAt = date
                        )
                        withdrawDialogOpen = false
                    }
                }
            }
        )
    }

    if (reportDialogOpen) {
        val fields = buildList {
            if (linkedWorkerName.isBlank()) {
                add(RecordField("Reported by", options = workerNames))
            }
            add(RecordField("Supply", options = supplyLabels))
            add(RecordField("Status", options = listOf("Run out", "Still available")))
            add(RecordField("Notes"))
            add(RecordField("Report date"))
        }
        val initialValues = buildList {
            if (linkedWorkerName.isBlank()) {
                add(workerNames.firstOrNull().orEmpty())
            }
            add(supplyLabels.firstOrNull().orEmpty())
            add("Run out")
            add("")
            add(java.time.LocalDate.now().toString())
        }
        SimpleRecordDialog(
            title = "Consumable supply report",
            fields = fields,
            initialValues = initialValues,
            onDismiss = { reportDialogOpen = false },
            onSave = { values ->
                val offset = if (linkedWorkerName.isBlank()) 1 else 0
                val reporter = if (linkedWorkerName.isBlank()) values.getOrNull(0).orEmpty() else linkedWorkerName
                val supplyLabel = values.getOrNull(offset).orEmpty()
                val status = values.getOrNull(offset + 1).orEmpty()
                val notes = values.getOrNull(offset + 2).orEmpty()
                val date = values.getOrNull(offset + 3).orEmpty()
                val supply = supplyLabelToRecord[supplyLabel]
                store.reportConsumableSupply(
                    supplyId = supply?.supplyId.orEmpty(),
                    supplyName = supply?.name.orEmpty().ifBlank { supplyLabel.substringBefore(" ·").trim() },
                    isRunOut = status.equals("Run out", ignoreCase = true),
                    notes = notes,
                    reportedBy = reporter,
                    reportedByAuthUid = activeUid,
                    reportedAt = date
                )
                reportDialogOpen = false
            }
        )
    }
}

@Composable
private fun SupplyCard(supply: ConsumableSupplyRecord) {
    val palette = farmPalette()
    val statusColor = when (supply.status.trim().lowercase()) {
        "out of stock" -> Color(0xFFD4183D)
        "low stock" -> Color(0xFFD4A574)
        else -> Color(0xFF2D5016)
    }

    FarmCard {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = supply.name.ifBlank { "Unnamed supply" },
                color = palette.textPrimary,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "${supply.stock} ${supply.unit} · ${supply.category}",
                color = palette.textSecondary,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp)
            )
            Text(
                text = supply.status.ifBlank { "In Stock" },
                color = statusColor,
                fontWeight = FontWeight.Medium,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}
