package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BuildCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Timer
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import com.melodypenero.coffeefarm.ui.components.FarmTabRow
import com.melodypenero.coffeefarm.ui.components.farmPalette
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.auth.LocalUserRole
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.store.EquipmentConditionReport
import com.melodypenero.coffeefarm.data.store.EquipmentRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext

@Composable
fun EquipmentScreen(reporterDisplayName: String = "") {
    val store = LocalAppStore.current
    val context = LocalContext.current
    val isAdmin = LocalUserRole.current == UserRole.ADMINISTRATOR
    val state by store.appState
    val tabs = remember(isAdmin) {
        if (isAdmin) {
            listOf("Usage", "Maintenance", "Costs")
        } else {
            listOf("Maintenance")
        }
    }
    var activeTab by remember(isAdmin) { mutableStateOf(if (isAdmin) "Usage" else "Maintenance") }
    var showAddDialog by remember { mutableStateOf(false) }
    var showReportDialog by remember { mutableStateOf(false) }
    var reportEquipmentPreset by remember { mutableStateOf<String?>(null) }
    var editingIndex by remember { mutableStateOf<Int?>(null) }
    val palette = farmPalette()
    val myReports = remember(state.equipmentReports, reporterDisplayName) {
        val name = reporterDisplayName.trim()
        state.equipmentReports
            .filter { name.isBlank() || (it.reportedBy?.equals(name, ignoreCase = true) == true) }
            .asReversed()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageGradient)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            FarmTabRow(
                tabs = tabs,
                selectedTab = activeTab,
                onTabSelected = { activeTab = it }
            )

            when (activeTab) {
                "Usage" -> UsageTab(state.usageLogs.map { Triple(it.equipmentName, it.details, it.hoursText) }) { editingIndex = it }
                "Maintenance" -> if (isAdmin) {
                    MaintenanceTab(
                        state.maintenanceLogs.map {
                            val subtitle = if (it.date.isNullOrBlank()) it.details else "${it.details} • ${it.date}"
                            Triple(it.equipmentName, subtitle, it.costText)
                        }
                    ) { editingIndex = it }
                } else {
                    EquipmentReportTab(
                        reports = myReports,
                        onNewReport = {
                            reportEquipmentPreset = null
                            showReportDialog = true
                        }
                    )
                }
                "Costs" -> CostsTab(state.equipment, state.maintenanceLogs.map { Triple(it.equipmentName, it.details, it.costText) })
            }
        }

        val showEquipmentFab = when (activeTab) {
            "Usage" -> isAdmin
            "Maintenance" -> true
            else -> false
        }
        if (showEquipmentFab) {
            FloatingActionButton(
                onClick = {
                    if (!isAdmin && activeTab == "Maintenance") {
                        reportEquipmentPreset = null
                        showReportDialog = true
                    } else {
                        showAddDialog = true
                    }
                },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(18.dp),
                containerColor = Color(0xFF84B626),
                contentColor = Color(0xFF111111)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add")
            }
        }
    }

    if (showReportDialog) {
        EquipmentConditionReportDialog(
            equipmentOptions = state.equipment.map { it.name },
            preselectedEquipment = reportEquipmentPreset,
            onDismiss = {
                showReportDialog = false
                reportEquipmentPreset = null
            },
            onSubmit = { equipmentName, choice, notes ->
                store.reportEquipmentIssue(
                    equipmentName = equipmentName,
                    details = notes,
                    isWrecked = choice == EquipmentReportChoice.BROKEN,
                    reportedBy = reporterDisplayName,
                    isFixedReport = false
                )
                showReportDialog = false
                reportEquipmentPreset = null
                Toast.makeText(
                    context,
                    "Report sent to admin. Thank you.",
                    Toast.LENGTH_SHORT
                ).show()
            }
        )
    }

    if (showAddDialog) {
        val equipmentOptions = state.equipment.map { it.name }
        val fields = when (activeTab) {
            "Usage" -> listOf(
                RecordField("Equipment Name", options = equipmentOptions),
                RecordField("Usage Details"),
                RecordField("Hours (e.g. 3.5h)")
            )
            else -> listOf(
                RecordField("Equipment Name", options = equipmentOptions),
                RecordField("Maintenance/Repair Details"),
                RecordField("Cost (e.g. ₱120)"),
                RecordField("Date")
            )
        }
        SimpleRecordDialog(
            title = "Add $activeTab",
            fields = fields,
            onDismiss = { showAddDialog = false },
            onSave = { values ->
                when (activeTab) {
                    "Usage" -> store.addUsageLog(values[0], values[1], values[2])
                    "Maintenance" -> if (isAdmin) {
                        store.addMaintenance(
                            equipmentName = values[0],
                            details = values[1],
                            costText = values[2],
                            date = values.getOrElse(3) { "" },
                            reportedBy = reporterDisplayName.ifBlank { null },
                            isWrecked = true
                        )
                    } else {
                        Unit
                    }
                }
            }
        )
    }

    editingIndex?.let { index ->
        val equipmentOptions = state.equipment.map { it.name }
        val fields = when (activeTab) {
            "Usage" -> listOf(RecordField("Equipment Name", equipmentOptions), RecordField("Usage Details"), RecordField("Hours (e.g. 3.5h)"))
            else -> listOf(RecordField("Equipment Name", equipmentOptions), RecordField("Maintenance/Repair Details"), RecordField("Cost (e.g. ₱120)"), RecordField("Date"))
        }
        val initial = when (activeTab) {
            "Usage" -> state.usageLogs.getOrNull(index)?.let { listOf(it.equipmentName, it.details, it.hoursText) } ?: emptyList()
            else -> state.maintenanceLogs.getOrNull(index)?.let { listOf(it.equipmentName, it.details, it.costText, it.date.orEmpty()) } ?: emptyList()
        }
        SimpleRecordDialog(
            title = "Edit $activeTab",
            fields = fields,
            initialValues = initial,
            onDismiss = { editingIndex = null },
            onSave = { values ->
                when (activeTab) {
                    "Usage" -> store.updateUsageLog(index, values[0], values[1], values[2])
                    else -> store.updateMaintenance(index, values[0], values[1], values[2], values.getOrElse(3) { "" })
                }
            },
            onDelete = when (activeTab) {
                "Usage" -> if (isAdmin) {
                    { store.deleteUsageLog(index) }
                } else null
                else -> if (isAdmin) {
                    { store.deleteMaintenance(index) }
                } else null
            }
        )
    }
}

@Composable
private fun EquipmentReportTab(
    reports: List<EquipmentConditionReport>,
    onNewReport: () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text(
                "Report what's wrong with equipment. Pick a machine the admin added on the website. Inventory is managed on the web admin portal only.",
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
                Text("Report issue", fontWeight = FontWeight.SemiBold)
            }
        }
        if (reports.isEmpty()) {
            item {
                Text("No reports submitted yet.", color = subtitleColor)
            }
        } else {
            items(reports, key = { it.reportId.ifBlank { "${it.equipmentName}-${it.reportedAt}" } }) { report ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = cardColor),
                    border = BorderStroke(1.dp, borderColor)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(report.equipmentName, color = titleColor, fontWeight = FontWeight.SemiBold)
                        val isFixed = report.isFixedReport || !report.fixedAt.isNullOrBlank()
                        val conditionLabel = when {
                            isFixed -> "Fixed / repaired"
                            report.isWrecked -> "Wrecked / broken"
                            else -> "Working OK"
                        }
                        val conditionColor = when {
                            isFixed -> Color(0xFF2D5016)
                            report.isWrecked -> Color(0xFFD4183D)
                            else -> Color(0xFF4A2C2A)
                        }
                        Text(
                            conditionLabel,
                            color = conditionColor,
                            fontWeight = FontWeight.Medium
                        )
                        if (report.notes.isNotBlank()) {
                            Text(report.notes, color = subtitleColor)
                        }
                        Text(
                            "${report.reportedAt}${report.reportedBy?.let { " · $it" } ?: ""}",
                            color = subtitleColor,
                            style = MaterialTheme.typography.labelMedium
                        )
                        if (!report.fixedAt.isNullOrBlank()) {
                            Text(
                                "Fixed on ${report.fixedAt}${report.fixedBy?.let { " · $it" } ?: ""}",
                                color = Color(0xFF2D5016),
                                style = MaterialTheme.typography.labelSmall
                            )
                        } else if (report.reviewed) {
                            Text("Reviewed by admin", color = Color(0xFF2D5016), style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UsageTab(logs: List<Triple<String, String, String>>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(logs) { index, log ->
            EquipmentSimpleCard(
                icon = Icons.Default.Timer,
                title = log.first,
                subtitle = log.second,
                trailing = log.third
            ) { onEdit(index) }
        }
    }
}

@Composable
private fun MaintenanceTab(maintenance: List<Triple<String, String, String>>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(maintenance) { index, item ->
            EquipmentSimpleCard(
                icon = Icons.Default.Settings,
                title = item.first,
                subtitle = item.second,
                trailing = item.third
            ) { onEdit(index) }
        }
    }
}

@Composable
private fun CostsTab(inventory: List<EquipmentRecord>, maintenance: List<Triple<String, String, String>>) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val mutedColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val totalCurrent = inventory.sumOf { it.currentValue }
    val maintenanceTotal = maintenance.sumOf { it.third.filter { c -> c.isDigit() }.toIntOrNull() ?: 0 }
    val costCards = listOf(
        Triple("Purchase Total", "₱${"%,d".format((totalCurrent * 1.12).toInt())}", Icons.Default.CreditCard),
        Triple("Current Value", "₱${"%,d".format(totalCurrent)}", Icons.Default.QueryStats),
        Triple("Maintenance Spent", "₱${"%,d".format(maintenanceTotal)}", Icons.Default.BuildCircle),
        Triple("Items in Fleet", inventory.size.toString(), Icons.Default.Inventory2)
    )
    val breakdown = inventory.map {
        Triple(
            it.name,
            "Bought ₱${"%,d".format((it.currentValue * 1.2).toInt())}",
            "Now ₱${"%,d".format(it.currentValue)}"
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CostStatCard(costCards[0].first, costCards[0].second, costCards[0].third, Modifier.weight(1f))
                CostStatCard(costCards[1].first, costCards[1].second, costCards[1].third, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CostStatCard(costCards[2].first, costCards[2].second, costCards[2].third, Modifier.weight(1f))
                CostStatCard(costCards[3].first, costCards[3].second, costCards[3].third, Modifier.weight(1f))
            }
        }
        item {
            Text(
                "Cost Breakdown",
                color = titleColor,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
        items(breakdown) { item ->
            Card(
                colors = CardDefaults.cardColors(containerColor = cardColor),
                border = BorderStroke(1.dp, borderColor)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(item.first, color = titleColor, fontWeight = FontWeight.SemiBold)
                        Text("Depreciation", color = mutedColor)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(item.second, color = mutedColor)
                        Text(item.third, color = Color(0xFF84B626))
                    }
                }
            }
        }
    }
}

@Composable
private fun EquipmentSimpleCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    trailing: String,
    onClick: () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 8.dp)
            ) {
                Text(title, color = titleColor, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = subtitleColor)
            }
            Text(trailing, color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CostStatCard(
    label: String,
    value: String,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val labelColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    val valueColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
            Text(label, color = labelColor, style = MaterialTheme.typography.labelLarge)
            Text(value, color = valueColor, fontWeight = FontWeight.Bold)
        }
    }
}
