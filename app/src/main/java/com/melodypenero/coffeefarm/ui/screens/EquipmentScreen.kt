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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
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
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.auth.LocalUserRole
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.store.EquipmentRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore

@Composable
fun EquipmentScreen() {
    val store = LocalAppStore.current
    val isAdmin = LocalUserRole.current == UserRole.ADMINISTRATOR
    val state by store.appState
    val tabs = listOf("Inventory", "Usage", "Maintenance", "Costs")
    var activeTab by remember { mutableStateOf("Inventory") }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingIndex by remember { mutableStateOf<Int?>(null) }
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val pageBackground = if (isDarkPalette) Color(0xFF1A120D) else Color(0xFFF5F5F5)
    val tabContainer = if (isDarkPalette) Color(0xFF1F140F) else Color(0xFFFFFFFF)
    val tabContent = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val tabDivider = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val tabUnselected = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ScrollableTabRow(
                selectedTabIndex = tabs.indexOf(activeTab).coerceAtLeast(0),
                edgePadding = 12.dp,
                containerColor = tabContainer,
                contentColor = tabContent,
                divider = {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .background(tabDivider)
                    )
                }
            ) {
                tabs.forEach { tab ->
                    Tab(
                        selected = tab == activeTab,
                        onClick = { activeTab = tab },
                        text = {
                            Text(
                                tab,
                                color = if (tab == activeTab) Color(0xFF84B626) else tabUnselected,
                                fontWeight = if (tab == activeTab) FontWeight.SemiBold else FontWeight.Medium
                            )
                        }
                    )
                }
            }

            when (activeTab) {
                "Inventory" -> InventoryTab(state.equipment) { if (isAdmin) editingIndex = it }
                "Usage" -> UsageTab(state.usageLogs.map { Triple(it.equipmentName, it.details, it.hoursText) }) { editingIndex = it }
                "Maintenance" -> MaintenanceTab(
                    state.maintenanceLogs.map {
                        val subtitle = if (it.date.isNullOrBlank()) it.details else "${it.details} • ${it.date}"
                        Triple(it.equipmentName, subtitle, it.costText)
                    }
                ) { if (isAdmin) editingIndex = it }
                "Costs" -> CostsTab(state.equipment, state.maintenanceLogs.map { Triple(it.equipmentName, it.details, it.costText) })
            }
        }

        val showEquipmentFab = when (activeTab) {
            "Inventory" -> true
            "Usage" -> true
            "Maintenance" -> isAdmin
            else -> false
        }
        if (showEquipmentFab) {
            FloatingActionButton(
                onClick = { showAddDialog = true },
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

    if (showAddDialog) {
        val workerOptions = listOf("Unassigned") + state.workers.map { it.name }
        val equipmentOptions = state.equipment.map { it.name }
        val fields = when (activeTab) {
            "Inventory" -> listOf(
                RecordField("Equipment Name"),
                RecordField(
                    "Category",
                    options = listOf(
                        "Processing", "Spraying", "Cutting", "Drying",
                        "Harvest", "Quality", "Transport", "Power"
                    )
                ),
                RecordField("Status", options = listOf("available", "in-use", "maintenance", "broken")),
                RecordField("Assigned Worker", options = workerOptions),
                RecordField("Current Value")
            )
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
                    "Inventory" -> {
                        val parsed = values.getOrNull(4)?.filter { it.isDigit() }?.toIntOrNull() ?: 0
                        store.addEquipment(
                                name = values[0],
                                category = values[1],
                                status = values[2].lowercase(),
                                assignedTo = values[3].takeUnless { it.equals("Unassigned", true) || it.isBlank() },
                                currentValue = parsed
                        )
                    }
                    "Usage" -> store.addUsageLog(values[0], values[1], values[2])
                    "Maintenance" -> store.addMaintenance(values[0], values[1], values[2], values.getOrElse(3) { "" })
                }
            }
        )
    }

    editingIndex?.let { index ->
        val workerOptions = listOf("Unassigned") + state.workers.map { it.name }
        val equipmentOptions = state.equipment.map { it.name }
        val fields = when (activeTab) {
            "Inventory" -> listOf(
                RecordField("Equipment Name"),
                RecordField("Category", listOf("Processing", "Spraying", "Cutting", "Drying", "Harvest", "Quality", "Transport", "Power")),
                RecordField("Status", listOf("available", "in-use", "maintenance", "broken")),
                RecordField("Assigned Worker", workerOptions),
                RecordField("Current Value")
            )
            "Usage" -> listOf(RecordField("Equipment Name", equipmentOptions), RecordField("Usage Details"), RecordField("Hours (e.g. 3.5h)"))
            else -> listOf(RecordField("Equipment Name", equipmentOptions), RecordField("Maintenance/Repair Details"), RecordField("Cost (e.g. ₱120)"), RecordField("Date"))
        }
        val initial = when (activeTab) {
            "Inventory" -> state.equipment.getOrNull(index)?.let {
                listOf(it.name, it.category, it.status, it.assignedTo ?: "Unassigned", it.currentValue.toString())
            } ?: emptyList()
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
                    "Inventory" -> {
                        val parsed = values.getOrNull(4)?.filter { it.isDigit() }?.toIntOrNull() ?: 0
                        store.updateEquipment(index, values[0], values[1], values[2].lowercase(), values[3].takeUnless { it.equals("Unassigned", true) || it.isBlank() }, parsed)
                    }
                    "Usage" -> store.updateUsageLog(index, values[0], values[1], values[2])
                    else -> store.updateMaintenance(index, values[0], values[1], values[2], values.getOrElse(3) { "" })
                }
            },
            onDelete = when (activeTab) {
                "Inventory" -> if (isAdmin) {
                    { store.deleteEquipment(index) }
                } else null
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
private fun InventoryTab(inventory: List<EquipmentRecord>, onEdit: (Int) -> Unit) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(inventory) { index, item ->
            Card(
                modifier = Modifier.clickable { onEdit(index) },
                colors = CardDefaults.cardColors(containerColor = cardColor),
                border = BorderStroke(1.dp, borderColor)
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.name,
                                color = titleColor,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(text = item.category, color = subtitleColor)
                        }
                        StatusPill(item.status)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Assigned", color = subtitleColor)
                            Text(item.assignedTo ?: "Unassigned", color = titleColor, fontWeight = FontWeight.SemiBold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Current value", color = subtitleColor)
                            Text("₱${"%,d".format(item.currentValue)}", color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
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
private fun StatusPill(status: String) {
    val (bg, fg, label) = when (status) {
        "available" -> Triple(Color(0xFF234917), Color(0xFF9AD45E), "Available")
        "in-use" -> Triple(Color(0xFF133A5E), Color(0xFF6AB0FF), "In-Use")
        "maintenance" -> Triple(Color(0xFF4D2F0E), Color(0xFFF3B562), "Maintenance")
        "broken" -> Triple(Color(0xFF4B1F1F), Color(0xFFFF7A70), "Broken")
        else -> Triple(Color(0xFF3B3B3B), Color(0xFFDADADA), status)
    }
    Surface(color = bg, shape = MaterialTheme.shapes.extraLarge) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
            color = fg,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold
        )
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

