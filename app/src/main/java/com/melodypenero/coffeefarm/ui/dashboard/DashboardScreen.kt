package com.melodypenero.coffeefarm.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Construction
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.auth.LocalUserRole
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.store.AppState
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.domain.FarmFinance
import com.melodypenero.coffeefarm.domain.TreeRipeness
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmModuleTile
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.FarmStatCard
import com.melodypenero.coffeefarm.ui.components.farmPalette
import com.melodypenero.coffeefarm.ui.navigation.AppDestination
import java.time.LocalDate

private data class DashboardFieldMetrics(
    val totalEquipmentCount: Int,
    val harvestTodayKg: Double,
    val irrigationZoneCount: Int,
    val readyTreeCount: Int
)

@Composable
fun DashboardScreen(
    onNavigateToModule: (AppDestination) -> Unit
) {
    val store = LocalAppStore.current
    val isAdmin = LocalUserRole.current == UserRole.ADMINISTRATOR
    val appState by store.appState
    val fieldMetrics by remember(appState) {
        derivedStateOf {
            val harvestTodayKg = appState.cherryHarvests
                .filter { FarmFinance.parseToLocalDate(it.date.orEmpty()) == LocalDate.now() }
                .sumOf { parseWeightKg(it.weightText) }
            val readyTreeCount = appState.trees.count { tree ->
                val scans = appState.treeRipenessScans.filter { it.treeId == tree.treeId }
                val avg = TreeRipeness.averageScore(scans)
                TreeRipeness.isFruitingStage(tree.stage) &&
                    scans.size >= TreeRipeness.MIN_SCANS_FOR_STATUS &&
                    TreeRipeness.decisionText(avg, scans.size).contains("harvest", ignoreCase = true)
            }
            DashboardFieldMetrics(
                totalEquipmentCount = appState.equipment.size,
                harvestTodayKg = harvestTodayKg,
                irrigationZoneCount = appState.irrigationSystems.size,
                readyTreeCount = readyTreeCount
            )
        }
    }

    FarmLazyScreen(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            FarmInfoBanner(
                text = if (isAdmin) {
                    "Field tools for scanning and logging. Manage workers, sales, and farm records on the web admin portal."
                } else {
                    "Scan cherries, check irrigation zones, log equipment use, and record attendance."
                }
            )
        }

        item {
            FieldSummaryGrid(
                metrics = fieldMetrics,
                onNavigateToModule = onNavigateToModule
            )
        }

        item {
            FarmInfoBanner(
                text = "Harvest guide: Green means a tree or field is ready for harvest. Black batch labels mean the batch is harvestable after scan confirmation."
            )
        }

        item {
            SectionMapPreview(appState = appState)
        }

        item {
            FarmSectionTitle(
                title = "Modules",
                subtitle = "Daily attendance, scan proof, equipment reports, irrigation checks, and activity assignments are tracked here or synced from the website."
            )
        }
        item {
            ModulesGrid(onNavigateToModule, isAdmin)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FieldSummaryGrid(
    metrics: DashboardFieldMetrics,
    onNavigateToModule: (AppDestination) -> Unit
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        maxItemsInEachRow = 2
    ) {
        FarmStatCard(
            title = "Equipment",
            value = metrics.totalEquipmentCount.toString(),
            icon = Icons.Default.Construction,
            onClick = { onNavigateToModule(AppDestination.Equipment) }
        )
        FarmStatCard(
            title = "Today's harvest",
            value = "${metrics.harvestTodayKg.toInt()} kg",
            icon = Icons.Default.Coffee,
            onClick = { onNavigateToModule(AppDestination.Cherry) }
        )
        FarmStatCard(
            title = "Ready trees",
            value = metrics.readyTreeCount.toString(),
            icon = Icons.Default.Coffee,
            onClick = { onNavigateToModule(AppDestination.Cherry) }
        )
        FarmStatCard(
            title = "Irrigation zones",
            value = metrics.irrigationZoneCount.toString(),
            icon = Icons.Default.WaterDrop,
            onClick = { onNavigateToModule(AppDestination.Irrigation) }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SectionMapPreview(appState: AppState) {
    val palette = farmPalette()
    val sectionLabels = when {
        appState.coffeeFields.isNotEmpty() -> appState.coffeeFields.mapIndexed { index, field ->
            "Section ${('A'.code + index).toChar()}" to field.name
        }
        appState.sections.isNotEmpty() -> appState.sections.map { it.name to it.details }
        else -> listOf("Section A" to "No mapped crops yet", "Section B" to "Add fields on the website")
    }
    FarmCard {
        FarmSectionTitle(
            title = "Farm section map",
            subtitle = "Visual location guide for Section A, Section B, and crop areas."
        )
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            maxItemsInEachRow = 2
        ) {
            sectionLabels.take(6).forEach { (section, detail) ->
                FarmCard(modifier = Modifier.fillMaxWidth(0.48f)) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = section.ifBlank { "Section" },
                            color = palette.textPrimary,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = detail.ifBlank { "Crop location" },
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}

private fun parseWeightKg(weightText: String): Double {
    val parsed = weightText.filter { it.isDigit() || it == '.' }
    return parsed.toDoubleOrNull() ?: 0.0
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ModulesGrid(onNavigateToModule: (AppDestination) -> Unit, isAdmin: Boolean) {
    val modules = buildList {
        if (!isAdmin) {
            add(Triple("My Attendance", Icons.Default.Schedule, AppDestination.StaffAttendance))
        }
        add(Triple("Cherry scanner", Icons.Default.Coffee, AppDestination.Cherry))
        add(Triple("Equipment", Icons.Default.Construction, AppDestination.Equipment))
        add(Triple("Irrigation", Icons.Default.WaterDrop, AppDestination.Irrigation))
    }
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        maxItemsInEachRow = 2
    ) {
        modules.forEach { (label, icon, destination) ->
            FarmModuleTile(
                label = label,
                icon = icon,
                onClick = { onNavigateToModule(destination) }
            )
        }
    }
}
