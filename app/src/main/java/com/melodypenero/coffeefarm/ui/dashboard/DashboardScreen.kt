package com.melodypenero.coffeefarm.ui.dashboard

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
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
import androidx.compose.material.icons.filled.Construction
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
import com.melodypenero.coffeefarm.ui.icons.CoffeeCherry
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
    // Each scan's real per-cherry CNN detection counts (unripeCount/ripeningCount/ripeCount/
    // overripeCount/dryDamagedCount) are the source of truth here -- they come straight from the
    // model's per-cherry classification, saved alongside `grade`. `grade` itself is only a single
    // coarse branch-level recommendation ("Optimal Harvest Ready" / "Selective Picking
    // Recommended" / "Wait / Unripe") computed from the ripe fraction of one scan, so it can never
    // say "overripe" and previously made this donut's slices (and the ripe% inside it) wrong for
    // every real scan: substring-matching "Ripe"/"Overripe"/"Dry"/"Damaged" against those three
    // fixed phrases always returned ripeCount=0 (neither phrase contains "Ripe" as a
    // non-"Unripe" substring) and overripeCount/damagedCount=0 (those words never appear at all).
    // Fall back to bucketing the coarse phrase only for scans saved before per-cherry counts
    // existed, using the phrases this app actually produces (not the "Green"/"Defective"/"Dry"/
    // "Near" keywords the old code guessed at, none of which ever appear in real data).
    val allScans = appState.cherryGrades

    fun legacyBucketCounts(grade: String?): IntArray {
        val k = (grade ?: "").lowercase().trim()
        return when {
            k.contains("optimal harvest ready") -> intArrayOf(1, 0, 0, 0, 0)
            k.contains("selective picking") -> intArrayOf(0, 1, 0, 0, 0)
            k.contains("wait") || k.contains("delay harvest") -> intArrayOf(0, 0, 1, 0, 0)
            k.contains("overripe") || k.contains("defect") -> intArrayOf(0, 0, 0, 1, 0)
            k.contains("dry") || k.contains("damaged") -> intArrayOf(0, 0, 0, 0, 1)
            else -> intArrayOf(0, 0, 0, 0, 0)
        }
    }

    var ripeCount = 0
    var ripeningCount = 0
    var unripeCount = 0
    var overripeCount = 0
    var damagedCount = 0
    for (g in allScans) {
        val hasRealCounts = g.unripeCount != null || g.ripeningCount != null || g.ripeCount != null ||
            g.overripeCount != null || g.dryDamagedCount != null
        if (hasRealCounts) {
            ripeCount += g.ripeCount ?: 0
            ripeningCount += g.ripeningCount ?: 0
            unripeCount += g.unripeCount ?: 0
            overripeCount += g.overripeCount ?: 0
            damagedCount += g.dryDamagedCount ?: 0
        } else {
            val (r, rg, u, o, d) = legacyBucketCounts(g.grade).toList()
            ripeCount += r
            ripeningCount += rg
            unripeCount += u
            overripeCount += o
            damagedCount += d
        }
    }

    val totalScans = ripeCount + ripeningCount + unripeCount + overripeCount + damagedCount
    val totalCategorized = totalScans.coerceAtLeast(1)
    val ripeRatio = (ripeCount.toFloat() / totalCategorized * 100f)

    // New scans arrive live (CNN scans sync from the field), so animate toward the new slice
    // angles / ripe% instead of snapping -- a value jumping straight to its new position reads
    // as broken on a donut chart, an eased transition reads as "the chart updated".
    val animSpec = tween<Float>(durationMillis = 600)
    val animatedRipeRatio by animateFloatAsState(ripeRatio, animSpec, label = "ripeRatio")
    val animatedSliceUnripe by animateFloatAsState((unripeCount.toFloat() / totalCategorized) * 360f, animSpec, label = "sliceUnripe")
    val animatedSliceRipening by animateFloatAsState((ripeningCount.toFloat() / totalCategorized) * 360f, animSpec, label = "sliceRipening")
    val animatedSliceRipe by animateFloatAsState((ripeCount.toFloat() / totalCategorized) * 360f, animSpec, label = "sliceRipe")
    val animatedSliceOverripe by animateFloatAsState((overripeCount.toFloat() / totalCategorized) * 360f, animSpec, label = "sliceOverripe")
    val animatedSliceDamaged by animateFloatAsState((damagedCount.toFloat() / totalCategorized) * 360f, animSpec, label = "sliceDamaged")

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

                    var startAngle = -90f

                    drawArc(Color(0xFF228B22), startAngle, animatedSliceUnripe, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += animatedSliceUnripe

                    drawArc(Color(0xFFFFBF00), startAngle, animatedSliceRipening, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += animatedSliceRipening

                    drawArc(Color(0xFFDC143C), startAngle, animatedSliceRipe, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += animatedSliceRipe

                    drawArc(Color(0xFF8B4513), startAngle, animatedSliceOverripe, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                    startAngle += animatedSliceOverripe

                    drawArc(Color(0xFF2F4F4F), startAngle, animatedSliceDamaged, false, style = androidx.compose.ui.graphics.drawscope.Stroke(strokeWidth))
                }

                Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    Text(
                        text = "%.0f%%".format(animatedRipeRatio),
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


private data class StatCardSpec(val title: String, val value: String, val icon: ImageVector, val onClick: () -> Unit)

/** Fades + slides each card in with a short stagger so the grid doesn't just pop in as one block. */
@Composable
private fun StaggeredEntrance(index: Int, content: @Composable () -> Unit) {
    val visibleState = remember { MutableTransitionState(false).apply { targetState = true } }
    AnimatedVisibility(
        visibleState = visibleState,
        enter = fadeIn(tween(durationMillis = 260, delayMillis = index * 50)) +
            slideInVertically(tween(durationMillis = 260, delayMillis = index * 50)) { it / 4 }
    ) {
        content()
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FieldSummaryGrid(
    metrics: DashboardFieldMetrics,
    onNavigateToModule: (AppDestination) -> Unit
) {
    val cards = listOf(
        StatCardSpec("Equipment", metrics.totalEquipmentCount.toString(), Icons.Default.Construction) {
            onNavigateToModule(AppDestination.Equipment)
        },
        StatCardSpec("Today's harvest", "${metrics.harvestTodayKg.toInt()} kg", Icons.Default.CoffeeCherry) {
            onNavigateToModule(AppDestination.Cherry)
        },
        StatCardSpec("Ready trees", metrics.readyTreeCount.toString(), Icons.Default.CoffeeCherry) {
            onNavigateToModule(AppDestination.Cherry)
        },
        StatCardSpec("Irrigation zones", metrics.irrigationZoneCount.toString(), Icons.Default.WaterDrop) {
            onNavigateToModule(AppDestination.Irrigation)
        },
    )
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        maxItemsInEachRow = 2
    ) {
        cards.forEachIndexed { index, card ->
            StaggeredEntrance(index) {
                FarmStatCard(title = card.title, value = card.value, icon = card.icon, onClick = card.onClick)
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
        add(Triple("Cherry scanner", Icons.Default.CoffeeCherry, AppDestination.Cherry))
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
        modules.forEachIndexed { index, (label, icon, destination) ->
            StaggeredEntrance(index) {
                FarmModuleTile(
                    label = label,
                    icon = icon,
                    onClick = { onNavigateToModule(destination) }
                )
            }
        }
    }
}
