package com.melodypenero.coffeefarm.ui.dashboard

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Construction
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
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

        // Coffee Maturity Overview (Donut Chart + Legend)
        item {
            CoffeeMaturityDonutCard(appState = appState, onNavigateToScanner = { onNavigateToModule(AppDestination.Cherry) })
        }

        item {
            FarmInfoBanner(
                text = "Harvest guide: Green means a tree or field is ready for harvest. Black batch labels mean the batch is harvestable after scan confirmation."
            )
        }

        item {
            SectionMapPreview(appState = appState, onNavigateToModule = onNavigateToModule)
        }

        item {
            FarmSectionTitle(
                title = "Modules",
                subtitle = "Daily attendance, interactive map, scan proof, equipment reports, irrigation checks, and activity assignments are tracked here or synced from the website."
            )
        }
        item {
            ModulesGrid(onNavigateToModule, isAdmin)
        }
    }
}

@Composable
private fun CoffeeMaturityDonutCard(
    appState: AppState,
    onNavigateToScanner: () -> Unit
) {
    val palette = farmPalette()
    val scans = appState.cherryGrades
    val totalScans = scans.size

    val ripeCount = scans.count { (it.grade ?: "").contains("Ripe", ignoreCase = true) && !(it.grade ?: "").contains("Unripe", ignoreCase = true) && !(it.grade ?: "").contains("Overripe", ignoreCase = true) }
    val ripeningCount = scans.count { (it.grade ?: "").contains("Ripening", ignoreCase = true) || (it.grade ?: "").contains("Near", ignoreCase = true) }
    val unripeCount = scans.count { (it.grade ?: "").contains("Unripe", ignoreCase = true) || (it.grade ?: "").contains("Green", ignoreCase = true) }
    val overripeCount = scans.count { (it.grade ?: "").contains("Overripe", ignoreCase = true) || (it.grade ?: "").contains("Defective", ignoreCase = true) }
    val damagedCount = scans.count { (it.grade ?: "").contains("Dry", ignoreCase = true) || (it.grade ?: "").contains("Damaged", ignoreCase = true) }

    val totalCategorized = (ripeCount + ripeningCount + unripeCount + overripeCount + damagedCount).coerceAtLeast(1)
    val ripeRatio = (ripeCount.toFloat() / totalCategorized * 100f)

    FarmCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onNavigateToScanner() }
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1.2f)) {
                Text(
                    text = "Coffee Maturity Distribution",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = palette.textPrimary
                )
                Text(
                    text = "$totalScans saved branch scans in database",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            androidx.compose.material3.Surface(
                color = Color(0xFFC8963E).copy(alpha = 0.18f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = "Cherry Analytics",

                    color = Color(0xFFC8963E),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Donut Chart Canvas
            Box(
                modifier = Modifier
                    .size(110.dp)
                    .padding(4.dp),
                contentAlignment = androidx.compose.ui.Alignment.Center
            ) {
                androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxSize()) {
                    val strokeWidth = 24f

                    val sliceUnripe = (unripeCount.toFloat() / totalCategorized) * 360f

                    val sliceRipening = (ripeningCount.toFloat() / totalCategorized) * 360f
                    val sliceRipe = (ripeCount.toFloat() / totalCategorized) * 360f
                    val sliceOverripe = (overripeCount.toFloat() / totalCategorized) * 360f
                    val sliceDamaged = (damagedCount.toFloat() / totalCategorized) * 360f

                    var startAngle = -90f

                    drawArc(Color(0xFF228B22), startAngle, sliceUnripe, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += sliceUnripe

                    drawArc(Color(0xFFFFBF00), startAngle, sliceRipening, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += sliceRipening

                    drawArc(Color(0xFFDC143C), startAngle, sliceRipe, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += sliceRipe

                    drawArc(Color(0xFF8B4513), startAngle, sliceOverripe, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += sliceOverripe

                    drawArc(Color(0xFF2F4F4F), startAngle, sliceDamaged, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                }

                Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    Text(
                        text = "%.0f%%".format(ripeRatio),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = palette.textPrimary
                    )
                    Text(
                        text = "Ripe",
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.textSecondary
                    )
                }
            }

            // Donut Legend Breakdown
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                MaturityLegendRow("Ripe", ripeCount, Color(0xFFDC143C), palette)
                MaturityLegendRow("Ripening", ripeningCount, Color(0xFFFFBF00), palette)
                MaturityLegendRow("Unripe", unripeCount, Color(0xFF228B22), palette)
                MaturityLegendRow("Overripe", overripeCount, Color(0xFF8B4513), palette)
                MaturityLegendRow("Dry/Damaged", damagedCount, Color(0xFF2F4F4F), palette)
            }
        }
    }
}

@Composable
private fun MaturityLegendRow(label: String, count: Int, color: Color, palette: com.melodypenero.coffeefarm.ui.components.FarmPalette) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Box(modifier = Modifier.size(8.dp).background(color, androidx.compose.foundation.shape.CircleShape))
            androidx.compose.foundation.layout.Spacer(Modifier.padding(horizontal = 3.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, color = palette.textSecondary)
        }
        Text("$count", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = palette.textPrimary)
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
private fun SectionMapPreview(
    appState: AppState,
    onNavigateToModule: (AppDestination) -> Unit
) {
    val palette = farmPalette()
    val sectionLabels = when {
        appState.coffeeFields.isNotEmpty() -> appState.coffeeFields.mapIndexed { index, field ->
            "Section ${('A'.code + index).toChar()}" to field.name
        }
        appState.sections.isNotEmpty() -> appState.sections.map { it.name to it.details }
        else -> listOf("Section A" to "No mapped crops yet", "Section B" to "Add fields on the website")
    }
    FarmCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onNavigateToModule(AppDestination.FarmMap) }
    ) {
        FarmSectionTitle(
            title = "Farm section map",
            subtitle = "Visual location guide for Section A, Section B, and crop areas. Tap to open interactive map."
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
    val modules: List<Triple<String, ImageVector, AppDestination>> = buildList {
        if (!isAdmin) {
            add(Triple("My Attendance", Icons.Default.Schedule, AppDestination.StaffAttendance))
        }
        add(Triple("Farm Section Map", Icons.Default.Map, AppDestination.FarmMap))
        add(Triple("Cherry scanner", Icons.Default.Coffee, AppDestination.Cherry))
        add(Triple("Harvest Reports", Icons.Default.AssignmentTurnedIn, AppDestination.HarvestReadiness))
        add(Triple("Pest & Disease", Icons.Default.BugReport, AppDestination.PestDisease))
        add(Triple("Equipment", Icons.Default.Construction, AppDestination.Equipment))
        add(Triple("Irrigation", Icons.Default.WaterDrop, AppDestination.Irrigation))
    }
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        maxItemsInEachRow = 2
    ) {
        for ((label, icon, destination) in modules) {
            FarmModuleTile(
                label = label,
                icon = icon,
                onClick = { onNavigateToModule(destination) }
            )
        }
    }
}
