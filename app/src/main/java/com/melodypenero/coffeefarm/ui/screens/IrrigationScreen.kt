package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.data.store.IrrigationSystemRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette

@Composable
fun IrrigationScreen() {
    val store = LocalAppStore.current
    val state by store.appState
    val palette = farmPalette()
    val systems = state.irrigationSystems
    val reports = state.irrigationDamageReports
    val activeUid = store.activeAuthUid.orEmpty()
    val linkedWorker = state.workers.firstOrNull { it.authUid.trim() == activeUid }
    val linkedWorkerName = linkedWorker?.name.orEmpty().trim()
    val workerNames = state.workers.mapNotNull { it.name.trim().takeIf(String::isNotBlank) }.distinct().sorted()
    val systemLabels = remember(systems) {
        systems.map { system ->
            val zone = system.zone.ifBlank { "Unnamed zone" }
            val coverage = system.coverage.takeIf { it.isNotBlank() } ?: "—"
            val type = system.type.takeIf { it.isNotBlank() } ?: "—"
            val idSuffix = system.irrigationId.take(6).ifBlank { "local" }
            "$zone · $type · $coverage ($idSuffix)"
        }
    }
    val systemLabelToRecord = remember(systems, systemLabels) {
        systemLabels.zip(systems).toMap()
    }
    var reportDialogOpen by remember { mutableStateOf(false) }

    FarmLazyScreen(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            FarmSectionTitle(
                title = "Irrigation zones",
                subtitle = "Synced from the farm database. Admins add or update zones on the web portal."
            )
        }
        item {
            FarmInfoBanner(
                text = "Check zone status, coverage, and last maintenance before running lines in the field."
            )
        }
        item {
            FarmCard {
                Text(
                    text = "Report damaged sprinkler",
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "If you see a broken or leaking sprinkler, submit a report so the admin can schedule repairs.",
                    color = palette.textSecondary,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp)
                )
                Spacer(modifier = Modifier.height(10.dp))
                FarmPrimaryButton(
                    text = "Create damage report",
                    onClick = { reportDialogOpen = true },
                    enabled = systems.isNotEmpty() && (linkedWorkerName.isNotBlank() || workerNames.isNotEmpty())
                )
                if (systems.isEmpty()) {
                    Text(
                        text = "No irrigation systems available yet. Ask an admin to add sprinklers/zones on the website first.",
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
                    title = "Recent damage reports",
                    subtitle = "These are synced to the admin website under Farm Management."
                )
            }
            items(
                reports.sortedByDescending { it.reportedAt }.take(10),
                key = { it.reportId.ifBlank { "${it.reportedAt}-${it.sprinklerLabel}" } }
            ) { report ->
                FarmCard {
                    Column {
                        Text(
                            text = report.sprinklerLabel.ifBlank { "Sprinkler" },
                            color = palette.textPrimary,
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = buildString {
                                val zone = report.zone.ifBlank { "Unknown zone" }
                                append(zone)
                                if (report.reportedAt.isNotBlank()) {
                                    append(" · ")
                                    append(report.reportedAt)
                                }
                                if (report.reportedBy.isNotBlank()) {
                                    append(" · ")
                                    append(report.reportedBy)
                                }
                            },
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        if (report.details.isNotBlank()) {
                            Text(
                                text = report.details,
                                color = palette.textSecondary,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                        if (report.status.isNotBlank()) {
                            Text(
                                text = "Status: ${report.status}",
                                color = palette.textSecondary,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 8.dp)
                            )
                        }
                    }
                }
            }
        }
        if (systems.isEmpty()) {
            item {
                Text(
                    text = "No irrigation systems yet. Ask an admin to add zones in Farm Management on the website.",
                    color = palette.textSecondary,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        } else {
            items(systems, key = { it.irrigationId.ifBlank { "${it.zone}-${it.type}" } }) { system ->
                IrrigationZoneCard(system)
            }
        }
    }

    if (reportDialogOpen) {
        val fields = buildList {
            if (linkedWorkerName.isBlank()) {
                add(RecordField("Reported by", options = workerNames))
            }
            add(RecordField("Sprinkler zone", options = systemLabels))
            add(RecordField("Sprinkler ID / label"))
            add(RecordField("Damage details"))
            add(RecordField("Report date"))
        }
        val initialValues = buildList {
            if (linkedWorkerName.isBlank()) {
                add(workerNames.firstOrNull().orEmpty())
            }
            add(systemLabels.firstOrNull().orEmpty())
            add("")
            add("")
            add(java.time.LocalDate.now().toString())
        }
        SimpleRecordDialog(
            title = "Sprinkler damage report",
            fields = fields,
            initialValues = initialValues,
            onDismiss = { reportDialogOpen = false },
            onSave = { values ->
                val offset = if (linkedWorkerName.isBlank()) 1 else 0
                val reporter = if (linkedWorkerName.isBlank()) values.getOrNull(0).orEmpty() else linkedWorkerName
                val systemLabel = values.getOrNull(offset + 0).orEmpty()
                val sprinklerLabel = values.getOrNull(offset + 1).orEmpty()
                val details = values.getOrNull(offset + 2).orEmpty()
                val date = values.getOrNull(offset + 3).orEmpty()
                val system = systemLabelToRecord[systemLabel]
                store.reportDamagedSprinkler(
                    irrigationId = system?.irrigationId.orEmpty(),
                    zone = system?.zone.orEmpty().ifBlank { systemLabel.substringBefore(" ·").trim() },
                    sprinklerLabel = sprinklerLabel,
                    details = details,
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
private fun IrrigationZoneCard(system: IrrigationSystemRecord) {
    val palette = farmPalette()
    val statusColor = irrigationStatusColor(system.status)

    FarmCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = system.zone.ifBlank { "Unnamed zone" },
                color = palette.textPrimary,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.titleMedium
            )
            StatusChip(status = system.status, color = statusColor)
        }
        if (system.type.isNotBlank()) {
            DetailLine(label = "Type", value = system.type)
        }
        if (system.coverage.isNotBlank()) {
            DetailLine(label = "Coverage", value = system.coverage)
        }
        if (system.efficiency > 0) {
            DetailLine(label = "Efficiency", value = "${system.efficiency}%")
        }
        if (system.lastMaintenance.isNotBlank()) {
            DetailLine(label = "Last maintenance", value = system.lastMaintenance)
        }
    }
}

@Composable
private fun DetailLine(label: String, value: String) {
    val palette = farmPalette()
    Text(
        text = "$label: $value",
        color = palette.textSecondary,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
private fun StatusChip(status: String, color: Color) {
    val label = status.ifBlank { "unknown" }.replaceFirstChar { it.uppercase() }
    Surface(
        color = color.copy(alpha = 0.18f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = label,
            color = color,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

private fun irrigationStatusColor(status: String): Color = when (status.lowercase()) {
    "active" -> Color(0xFF2D6A4F)
    "maintenance" -> Color(0xFFB8860B)
    "inactive", "off" -> Color(0xFF6B5B4F)
    else -> Color(0xFF5C4A3A)
}
