package com.melodypenero.coffeefarm.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.data.store.CherryHarvestRecord
import com.melodypenero.coffeefarm.data.store.HarvestReadinessReportRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.ui.components.farmPalette
import java.time.LocalDate
import java.util.UUID

@Composable
fun HarvestReadinessScreen(reporterDisplayName: String = "") {
    val store = LocalAppStore.current
    val state by store.appState
    val context = LocalContext.current
    val palette = farmPalette()
    var showReportDialog by remember { mutableStateOf(false) }
    var showHarvestDialog by remember { mutableStateOf(false) }
    val zoneOptions = remember(state.coffeeFields, state.sections) {
        (state.coffeeFields.map { it.name } + state.sections.map { it.name })
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .ifEmpty { listOf("Block A") }
    }
    val workerReports = remember(state.harvestReadinessReports, reporterDisplayName) {
        val name = reporterDisplayName.trim()
        state.harvestReadinessReports
            .filter { name.isBlank() || it.reportedBy.equals(name, ignoreCase = true) }
            .asReversed()
    }
    val workerHarvests = remember(state.cherryHarvests, reporterDisplayName) {
        val name = reporterDisplayName.trim()
        state.cherryHarvests
            .filter { name.isBlank() || (it.pickerWorkerName ?: "").equals(name, ignoreCase = true) }
            .asReversed()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageGradient)
    ) {
        HarvestReadinessList(
            reports = workerReports,
            harvests = workerHarvests,
            onNewReport = { showReportDialog = true },
            onLogHarvest = { showHarvestDialog = true }
        )

        FloatingActionButton(
            onClick = { showReportDialog = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(18.dp),
            containerColor = Color(0xFF84B626),
            contentColor = Color(0xFF111111)
        ) {
            Icon(Icons.Default.Add, contentDescription = "Report readiness")
        }
    }

    if (showReportDialog) {
        SimpleRecordDialog(
            title = "Report Crop Readiness",
            fields = listOf(
                RecordField("Field / Block", options = zoneOptions),
                RecordField("Estimated Yield (e.g. 201 kg)"),
                RecordField("Notes")
            ),
            onDismiss = { showReportDialog = false },
            onSave = { values ->
                store.submitHarvestReadinessReport(
                    zone = values[0],
                    expectedWeight = values[1],
                    reportedBy = reporterDisplayName.ifBlank { "Worker" },
                    reportedAt = LocalDate.now().toString(),
                    notes = values[2]
                )
                Toast.makeText(
                    context,
                    "Harvest readiness report sent to admin.",
                    Toast.LENGTH_SHORT
                ).show()
            }
        )
    }

    if (showHarvestDialog) {
        SimpleRecordDialog(
            title = "Log Picked Harvest",
            fields = listOf(
                RecordField("Field / Block", options = zoneOptions),
                RecordField("Weight (kg)"),
                RecordField("Harvest Date"),
                RecordField("Notes")
            ),
            initialValues = listOf(zoneOptions.first(), "", LocalDate.now().toString(), ""),
            onDismiss = { showHarvestDialog = false },
            onSave = { values ->
                store.addCherryHarvest(
                    batchId = "HV-${UUID.randomUUID().toString().take(8).uppercase()}",
                    pickerWorkerName = reporterDisplayName.ifBlank { "Worker" },
                    details = values[3],
                    weightText = values[1],
                    date = values[2],
                    farmBlock = values[0]
                )
                Toast.makeText(
                    context,
                    "Harvest logged: ${values[1]} kg from ${values[0]}.",
                    Toast.LENGTH_SHORT
                ).show()
            }
        )
    }
}

@Composable
private fun HarvestReadinessList(
    reports: List<HarvestReadinessReportRecord>,
    harvests: List<CherryHarvestRecord>,
    onNewReport: () -> Unit,
    onLogHarvest: () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text(
                "Report crop readiness for admin review, or log cherries you've already picked and weighed. Both appear on the web admin portal.",
                color = subtitleColor,
                style = MaterialTheme.typography.bodyMedium
            )
            Row(
                modifier = Modifier.padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onNewReport,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF84B626),
                        contentColor = Color(0xFF111111)
                    )
                ) {
                    Text("Report readiness", fontWeight = FontWeight.SemiBold)
                }
                Button(
                    onClick = onLogHarvest,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF8B6F47),
                        contentColor = Color(0xFFF4EDE6)
                    )
                ) {
                    Text("Log harvest", fontWeight = FontWeight.SemiBold)
                }
            }
        }
        item {
            Text(
                "Logged harvests",
                color = titleColor,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        if (harvests.isEmpty()) {
            item {
                Text("No harvests logged yet today or otherwise.", color = subtitleColor)
            }
        } else {
            items(harvests, key = { it.harvestId.ifBlank { "${it.batchId}-${it.date}" } }) { harvest ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardColor),
                    border = BorderStroke(1.dp, borderColor)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                harvest.farmBlock.ifBlank { "Unspecified block" },
                                color = titleColor,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(harvest.weightText, color = Color(0xFF84B626), fontWeight = FontWeight.SemiBold)
                        }
                        if (harvest.details.isNotBlank()) {
                            Text(harvest.details, color = subtitleColor)
                        }
                        Text(
                            "Harvested: ${harvest.date ?: "Unknown date"}",
                            color = subtitleColor,
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                }
            }
        }
        item {
            Text(
                "Readiness reports",
                color = titleColor,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
        if (reports.isEmpty()) {
            item {
                Text("No harvest readiness reports submitted yet.", color = subtitleColor)
            }
        } else {
            items(reports, key = { it.reportId.ifBlank { "${it.zone}-${it.reportedAt}" } }) { report ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardColor),
                    border = BorderStroke(1.dp, borderColor)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(report.zone, color = titleColor, fontWeight = FontWeight.SemiBold)
                            Text(
                                report.status,
                                color = statusColor(report.status),
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Text("Estimated yield: ${report.expectedWeight}", color = subtitleColor)
                        if (report.notes.isNotBlank()) {
                            Text(report.notes, color = subtitleColor)
                        }
                        Text(
                            "Submitted: ${report.reportedAt} · ID: ${report.reportId}",
                            color = subtitleColor,
                            style = MaterialTheme.typography.labelMedium
                        )
                        if (report.reviewedAt.isNotBlank()) {
                            Text(
                                "Reviewed: ${report.reviewedAt}${report.reviewedBy.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}",
                                color = statusColor(report.status),
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun statusColor(status: String): Color = when (status) {
    "Approved" -> Color(0xFF2D5016)
    "Rejected" -> Color(0xFFD4183D)
    else -> Color(0xFF8B6F47)
}
