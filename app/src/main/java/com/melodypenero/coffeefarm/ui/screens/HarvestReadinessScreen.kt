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
import com.melodypenero.coffeefarm.data.store.HarvestReadinessReportRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.ui.components.farmPalette
import java.time.LocalDate

@Composable
fun HarvestReadinessScreen(reporterDisplayName: String = "") {
    val store = LocalAppStore.current
    val state by store.appState
    val context = LocalContext.current
    val palette = farmPalette()
    var showReportDialog by remember { mutableStateOf(false) }
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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageGradient)
    ) {
        HarvestReadinessList(
            reports = workerReports,
            onNewReport = { showReportDialog = true }
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
}

@Composable
private fun HarvestReadinessList(
    reports: List<HarvestReadinessReportRecord>,
    onNewReport: () -> Unit
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
                "Report crop readiness for admin review. Reports appear on the web harvest readiness board.",
                color = subtitleColor,
                style = MaterialTheme.typography.bodyMedium
            )
            Button(
                onClick = onNewReport,
                modifier = Modifier.padding(top = 12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF84B626),
                    contentColor = Color(0xFF111111)
                )
            ) {
                Text("Report readiness", fontWeight = FontWeight.SemiBold)
            }
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
