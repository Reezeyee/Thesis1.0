package com.melodypenero.coffeefarm.ui.dashboard

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Construction
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Paid
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.auth.LocalUserRole
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.model.DashboardSummary
import com.melodypenero.coffeefarm.data.store.AppState
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.domain.FarmFinance
import com.melodypenero.coffeefarm.ui.navigation.AppDestination
import com.melodypenero.coffeefarm.ui.screens.RecordField
import com.melodypenero.coffeefarm.ui.screens.SimpleRecordDialog
import java.time.LocalDate
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp

@Composable
fun DashboardScreen(
    onNavigateToModule: (AppDestination) -> Unit
) {
    val store = LocalAppStore.current
    val isAdmin = LocalUserRole.current == UserRole.ADMINISTRATOR
    val appState by store.appState
    var editingTaskIndex by remember { mutableStateOf<Int?>(null) }
    val dashboardMetrics by remember(appState) {
        derivedStateOf {
            val summary = dashboardFinanceSummary(appState)
            summary to appState.equipment.size
        }
    }
    val summary = dashboardMetrics.first
    val totalEquipmentCount = dashboardMetrics.second
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val pageBackground = if (isDarkPalette) Color(0xFF1A120D) else Color(0xFFF5F5F5)

    val pendingAttendancePayroll = remember(appState.attendance) {
        appState.attendance.count { it.awaitingPayrollLine }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            DashboardSummaryGrid(
                summary,
                totalEquipmentCount,
                onNavigateToModule,
                isAdmin,
                pendingAttendancePayroll
            )
        }

        item {
            SectionTitle("Modules")
        }
        item { ModulesGrid(onNavigateToModule, isAdmin) }

        item {
            SectionTitle("Today's Tasks")
        }

        itemsIndexed(appState.tasks) { index, task ->
            TaskItem(
                title = task.title,
                status = task.status
            ) {
                editingTaskIndex = index
            }
        }
    }

    editingTaskIndex?.let { index ->
        val task = appState.tasks.getOrNull(index)
        if (task != null) {
            SimpleRecordDialog(
                title = "Edit Dashboard Task",
                fields = listOf(
                    RecordField("Task Title"),
                    RecordField("Task Details"),
                    RecordField("Status", listOf("pending", "in-progress", "done"))
                ),
                initialValues = listOf(task.title, task.details, task.status),
                onDismiss = { editingTaskIndex = null },
                onSave = { values ->
                    store.updateTask(index, values[0], values[1], values[2])
                },
                onDelete = {
                    store.deleteTask(index)
                }
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DashboardSummaryGrid(
    summary: DashboardSummary,
    totalEquipmentCount: Int,
    onNavigateToModule: (AppDestination) -> Unit,
    isAdmin: Boolean,
    pendingAttendancePayroll: Int
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        maxItemsInEachRow = 2
    ) {
        if (isAdmin) {
            SummaryCard(
                title = "Total Workers",
                value = summary.workersCount.toString(),
                icon = Icons.Default.Groups
            ) { onNavigateToModule(AppDestination.FarmOps) }
            if (pendingAttendancePayroll > 0) {
                SummaryCard(
                    title = "Attendance → Payroll",
                    value = pendingAttendancePayroll.toString(),
                    icon = Icons.Default.Schedule
                ) { onNavigateToModule(AppDestination.Profit) }
            }
        }
        SummaryCard(
            title = "Total Equip",
            value = totalEquipmentCount.toString(),
            icon = Icons.Default.Construction
        ) { onNavigateToModule(AppDestination.Equipment) }
        SummaryCard(
            title = "Today's Harvest",
            value = "${summary.harvestTodayKg.toInt()} kg",
            icon = Icons.Default.Coffee
        ) { onNavigateToModule(AppDestination.Cherry) }
        SummaryCard(
            title = "Cherry AI grades",
            value = summary.cherryGradingsCount.toString(),
            icon = Icons.Default.AutoAwesome
        ) { onNavigateToModule(AppDestination.Cherry) }
        if (isAdmin) {
            SummaryCard(
                title = "Total income",
                value = "₱${"%,.0f".format(summary.totalIncome)}",
                icon = Icons.Default.TrendingUp
            ) { onNavigateToModule(AppDestination.Profit) }
            SummaryCard(
                title = "Total expenses",
                value = "₱${"%,.0f".format(summary.totalExpenses)}",
                icon = Icons.Default.TrendingDown
            ) { onNavigateToModule(AppDestination.Profit) }
            SummaryCard(
                title = "Net profit",
                value = "₱${"%,.0f".format(summary.currentProfit)}",
                icon = Icons.Default.Paid
            ) { onNavigateToModule(AppDestination.Profit) }
            SummaryCard(
                title = "Profit / kg",
                value = "₱${"%,.0f".format(summary.profitPerKg)}",
                icon = Icons.Default.Coffee
            ) { onNavigateToModule(AppDestination.Profit) }
        }
    }
}

private fun dashboardFinanceSummary(appState: AppState): DashboardSummary {
    return DashboardSummary(
        workersCount = appState.workers.size,
        treesCount = appState.trees.size,
        harvestTodayKg = appState.cherryHarvests
            .filter { FarmFinance.parseToLocalDate(it.date.orEmpty()) == LocalDate.now() }
            .sumOf { parseWeightKg(it.weightText) },
        cherryGradingsCount = appState.cherryGrades.size,
        currentProfit = FarmFinance.netProfit(appState).toDouble(),
        totalIncome = FarmFinance.totalIncome(appState.sales).toDouble(),
        totalExpenses = FarmFinance.totalExpenses(appState).toDouble(),
        profitPerKg = FarmFinance.profitPerKg(appState)
    )
}

private fun parseWeightKg(weightText: String): Double {
    val parsed = weightText.filter { it.isDigit() || it == '.' }
    return parsed.toDoubleOrNull() ?: 0.0
}

@Composable
private fun SummaryCard(
    title: String,
    value: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFCFC2B9) else Color(0xFF7A6A5F)
    val valueColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    Card(
        modifier = Modifier
            .fillMaxWidth(0.48f)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    color = titleColor
                )
                Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
            }
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = valueColor
            )
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    Text(
        text = title,
        style = MaterialTheme.typography.titleLarge,
        color = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723),
        fontWeight = FontWeight.SemiBold
    )
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun ModulesGrid(onNavigateToModule: (AppDestination) -> Unit, isAdmin: Boolean) {
    val modules = buildList {
        if (isAdmin) {
            add(Triple("Workers & Operations", Icons.Default.Groups, AppDestination.FarmOps))
        }
        if (!isAdmin) {
            add(Triple("My Attendance", Icons.Default.Schedule, AppDestination.StaffAttendance))
        }
        add(Triple("Coffee Cherry", Icons.Default.Coffee, AppDestination.Cherry))
        add(Triple("Equipment", Icons.Default.Construction, AppDestination.Equipment))
        if (isAdmin) {
            add(Triple("Sales Management", Icons.Default.Paid, AppDestination.Profit))
        }
    }
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        maxItemsInEachRow = 2
    ) {
        modules.forEach { (label, icon, destination) ->
            ModuleCard(label, icon) {
                onNavigateToModule(destination)
            }
        }
    }
}

@Composable
private fun ModuleCard(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val textColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    Card(
        modifier = Modifier
            .fillMaxWidth(0.48f)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
            Text(
                label,
                color = textColor,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun TaskItem(title: String, status: String, onClick: () -> Unit) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFCFC2B9) else Color(0xFF7A6A5F)
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(Icons.Default.TaskAlt, contentDescription = null, tint = Color(0xFF84B626))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = title,
                    color = titleColor,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = status,
                    color = subtitleColor,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}
