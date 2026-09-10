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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TaskAlt
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
import com.melodypenero.coffeefarm.data.store.AttendanceRecord
import com.melodypenero.coffeefarm.data.store.LocalAppStore

@Composable
fun FarmOperationsScreen() {
    val store = LocalAppStore.current
    val state by store.appState
    val tabs = listOf("Workers", "Attendance", "Tasks", "Sections", "Trees", "Harvest Schedule")
    var activeTab by remember { mutableStateOf("Trees") }
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
                "Workers" -> WorkersList(state.workers) { editingIndex = it }
                "Tasks" -> TasksList(
                    tasks = state.tasks.map { Triple(it.title, it.details, it.status) },
                    onToggleStatus = { idx ->
                        val task = state.tasks.getOrNull(idx) ?: return@TasksList
                        val next = when (task.status.lowercase()) {
                            "pending" -> "in-progress"
                            "in-progress" -> "done"
                            else -> "pending"
                        }
                        store.updateTask(idx, task.title, task.details, next)
                    },
                    onEdit = { editingIndex = it }
                )

                "Trees" -> TreesList(state.trees.map { Triple(it.sectionName, it.details, it.stage) }) { editingIndex = it }
                "Harvest Schedule" -> HarvestScheduleList(
                    state.harvestSchedules.map { schedule ->
                        val linkedFlowering = state.flowering.lastOrNull { it.sectionName == schedule.sectionName }
                        val linkedFloweringText = linkedFlowering?.let {
                            "Flowering: ${it.intensity.replaceFirstChar { c -> c.uppercase() }} - ${it.details}"
                        } ?: "Flowering: No linked flowering record"
                        Triple(schedule.sectionName, "${schedule.details}\n$linkedFloweringText", schedule.status)
                    }
                ) { editingIndex = it }
            }
        }

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

    if (showAddDialog) {
        when (activeTab) {
            "Attendance" -> {
                AttendanceFormDialog(
                    workerNames = state.workers.map { it.name },
                    initial = null,
                    title = "Add Attendance",
                    showClockFields = false,
                    onDismiss = { showAddDialog = false },
                    onSave = { w, d, ci, co, notes, hoursOverride ->
                        store.addAttendance(
                            workerName = w,
                            details = notes,
                            hoursWorked = hoursOverride,
                            clockIn = ci,
                            clockOut = co,
                            date = d,
                            staffSubmission = false
                        )
                    },
                    onDelete = null,
                    onCreatePayroll = null
                )
            }
            else -> {
                val sectionNames = state.sections.map { it.name }
                val floweringSectionNames = state.flowering.map { it.sectionName }.distinct()
                val harvestScheduleSectionOptions =
                    if (floweringSectionNames.isNotEmpty()) floweringSectionNames else sectionNames
                val workerRoleOptions = listOf(
                    "Picker",
                    "Field Manager",
                    "Quality Sorter",
                    "Agronomist",
                    "Other"
                )
                val fields = when (activeTab) {
                    "Workers" -> listOf(
                        RecordField("Worker Name"),
                        RecordField("Worker ID (optional)"),
                        RecordField("Role", options = workerRoleOptions),
                        RecordField("Phone Number"),
                        RecordField("Address"),
                        RecordField("Emergency Contact"),
                        RecordField("Worker Details")
                    )
                    "Tasks" -> listOf(
                        RecordField("Task Title"),
                        RecordField("Task Details"),
                        RecordField("Status", options = listOf("pending", "in-progress", "done"))
                    )
                    "Sections" -> listOf(RecordField("Section Name"), RecordField("Section Details"))
                    "Trees" -> listOf(
                        RecordField("Section Name", options = sectionNames),
                        RecordField("Tree Name / Details"),
                        RecordField(
                            "Growth Stage (Fruiting = cherry scan & harvest batch link)",
                            options = listOf("seedling", "sapling", "mature", "flowering", "fruiting", "harvesting")
                        )
                    )
                    else -> listOf(
                        RecordField("Section Name", options = harvestScheduleSectionOptions),
                        RecordField("Schedule Details"),
                        RecordField("Status", options = listOf("scheduled", "in-progress", "done"))
                    )
                }
                SimpleRecordDialog(
                    title = "Add $activeTab",
                    fields = fields,
                    onDismiss = { showAddDialog = false },
                    onSave = { values ->
                        when (activeTab) {
                            "Workers" -> store.addWorker(
                                name = values[0],
                                roleRate = values[2],
                                phoneNumber = values.getOrElse(3) { "" },
                                address = values.getOrElse(4) { "" },
                                emergencyContact = values.getOrElse(5) { "" },
                                details = values.getOrElse(6) { "" },
                                workerId = values.getOrElse(1) { "" }
                            )
                            "Tasks" -> store.addTask(values[0], values[1], values[2])
                            "Sections" -> store.addSection(values[0], values[1])
                            "Trees" -> store.addTree(values[0], values[1], values[2])
                            "Harvest Schedule" -> store.addHarvestSchedule(values[0], values[1], values[2])
                            else -> Unit
                        }
                    }
                )
            }
        }
    }

    editingIndex?.let { index ->
        when (activeTab) {
            "Attendance" -> {
                val record = state.attendance.getOrNull(index) ?: return@let
                AttendanceFormDialog(
                    workerNames = state.workers.map { it.name },
                    initial = record,
                    title = "Edit Attendance",
                    showClockFields = false,
                    onDismiss = { editingIndex = null },
                    onSave = { w, d, ci, co, notes, hoursOverride ->
                        store.updateAttendance(
                            index = index,
                            workerName = w,
                            details = notes,
                            hoursWorked = hoursOverride,
                            clockIn = ci,
                            clockOut = co,
                            date = d
                        )
                    },
                    onDelete = { store.deleteAttendance(index) },
                    onCreatePayroll = { store.createPayrollFromAttendance(index) }
                )
            }
            else -> {
                val sectionNames = state.sections.map { it.name }
                val floweringSectionNames = state.flowering.map { it.sectionName }.distinct()
                val harvestScheduleSectionOptions =
                    if (floweringSectionNames.isNotEmpty()) floweringSectionNames else sectionNames
                val fields = when (activeTab) {
                    "Workers" -> listOf(
                        RecordField("Worker Name"),
                        RecordField("Worker ID (optional)"),
                        RecordField(
                            "Role",
                            listOf("Picker", "Field Manager", "Quality Sorter", "Agronomist", "Other")
                        ),
                        RecordField("Phone Number"),
                        RecordField("Address"),
                        RecordField("Emergency Contact"),
                        RecordField("Worker Details")
                    )
                    "Tasks" -> listOf(
                        RecordField("Task Title"),
                        RecordField("Task Details"),
                        RecordField("Status", listOf("pending", "in-progress", "done"))
                    )
                    "Sections" -> listOf(RecordField("Section Name"), RecordField("Section Details"))
                    "Trees" -> listOf(
                        RecordField("Section Name", sectionNames),
                        RecordField("Tree Name / Details"),
                        RecordField(
                            "Growth Stage (Fruiting = cherry scan & harvest batch link)",
                            listOf("seedling", "sapling", "mature", "flowering", "fruiting", "harvesting")
                        )
                    )
                    else -> listOf(
                        RecordField("Section Name", harvestScheduleSectionOptions),
                        RecordField("Schedule Details"),
                        RecordField("Status", listOf("scheduled", "in-progress", "done"))
                    )
                }
                val initialValues = when (activeTab) {
                    "Workers" -> state.workers.getOrNull(index)?.let {
                        listOf(it.name, it.workerId, it.roleRate, it.phoneNumber, it.address, it.emergencyContact, it.details)
                    } ?: emptyList()
                    "Tasks" -> state.tasks.getOrNull(index)?.let { listOf(it.title, it.details, it.status) } ?: emptyList()
                    "Sections" -> state.sections.getOrNull(index)?.let { listOf(it.name, it.details) } ?: emptyList()
                    "Trees" -> state.trees.getOrNull(index)?.let { listOf(it.sectionName, it.details, it.stage) } ?: emptyList()
                    else -> state.harvestSchedules.getOrNull(index)?.let { listOf(it.sectionName, it.details, it.status) }
                        ?: emptyList()
                }
                SimpleRecordDialog(
                    title = "Edit $activeTab",
                    fields = fields,
                    initialValues = initialValues,
                    onDismiss = { editingIndex = null },
                    onSave = { values ->
                        when (activeTab) {
                            "Workers" -> store.updateWorker(
                                index = index,
                                name = values[0],
                                roleRate = values[2],
                                phoneNumber = values.getOrElse(3) { "" },
                                address = values.getOrElse(4) { "" },
                                emergencyContact = values.getOrElse(5) { "" },
                                details = values.getOrElse(6) { "" },
                                workerId = values.getOrElse(1) { "" }
                            )
                            "Tasks" -> store.updateTask(index, values[0], values[1], values[2])
                            "Sections" -> store.updateSection(index, values[0], values[1])
                            "Trees" -> store.updateTree(index, values[0], values[1], values[2])
                            else -> store.updateHarvestSchedule(index, values[0], values[1], values[2])
                        }
                    },
                    onDelete = {
                        when (activeTab) {
                            "Workers" -> store.deleteWorker(index)
                            "Tasks" -> store.deleteTask(index)
                            "Sections" -> store.deleteSection(index)
                            "Trees" -> store.deleteTree(index)
                            else -> store.deleteHarvestSchedule(index)
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun WorkersList(workers: List<com.melodypenero.coffeefarm.data.store.WorkerRecord>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(workers) { index, worker ->
            OpsCard(
                icon = Icons.Default.Groups,
                title = worker.name,
                subtitle = buildString {
                    if (worker.workerId.isNotBlank()) append("ID: ${worker.workerId}\n")
                    append(worker.roleRate)
                    if (worker.phoneNumber.isNotBlank()) append("\nPhone: ${worker.phoneNumber}")
                    if (worker.address.isNotBlank()) append("\nAddress: ${worker.address}")
                    if (worker.emergencyContact.isNotBlank()) append("\nEmergency: ${worker.emergencyContact}")
                },
                badge = if (worker.isActive) {
                    "Active" to statusBadgeColor("done")
                } else {
                    "Inactive" to statusBadgeColor("pending")
                }
            ) {
                onEdit(index)
            }
        }
    }
}

@Composable
private fun AttendanceList(attendance: List<AttendanceRecord>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(attendance) { index, a ->
            val subtitle = buildString {
                if (a.date.isNotBlank()) append("${a.date}\n")
                val h = a.hoursWorked
                append(if (h != null) "Hours: ${"%.2f".format(h)} h" else "Hours: —")
                if (a.details.isNotBlank()) append("\n${a.details}")
                if (a.submittedByStaff) append("\n(From worker app)")
            }
            val badge = if (a.awaitingPayrollLine) {
                "Needs payroll" to statusBadgeColor("pending")
            } else {
                null
            }
            OpsCard(
                icon = Icons.Default.Schedule,
                title = a.workerName,
                subtitle = subtitle,
                badge = badge
            ) {
                onEdit(index)
            }
        }
    }
}

@Composable
private fun TasksList(
    tasks: List<Triple<String, String, String>>,
    onToggleStatus: ((Int) -> Unit)? = null,
    onEdit: (Int) -> Unit
) {
    if (tasks.isEmpty()) {
        com.melodypenero.coffeefarm.ui.components.FarmEmptyState(
            title = "No Tasks Assigned",
            subtitle = "Tap the + button below to create a new coffee farm assignment.",
            icon = Icons.Default.TaskAlt,
            modifier = Modifier.padding(16.dp)
        )
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            itemsIndexed(tasks) { index, item ->
                val priority = when {
                    item.first.contains("Urgent", ignoreCase = true) || item.first.contains("Harvest", ignoreCase = true) -> "High"
                    item.first.contains("Check", ignoreCase = true) || item.first.contains("Repair", ignoreCase = true) -> "Medium"
                    else -> "Normal"
                }
                com.melodypenero.coffeefarm.ui.components.FigmaTaskCard(
                    title = item.first,
                    subtitle = item.second,
                    status = item.third,
                    priority = priority,
                    dueDate = "Today",
                    assignee = "Field Team",
                    onToggleStatus = { onToggleStatus?.invoke(index) },
                    onClick = { onEdit(index) }
                )
            }
        }
    }
}


@Composable
private fun SectionsList(sections: List<Pair<String, String>>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(sections) { index, item ->
            OpsCard(icon = Icons.Default.AccountTree, title = item.first, subtitle = item.second, badge = null) {
                onEdit(index)
            }
        }
    }
}

@Composable
private fun TreesList(trees: List<Triple<String, String, String>>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        itemsIndexed(trees) { index, item ->
            OpsCard(
                icon = Icons.Default.AccountTree,
                title = item.second.ifBlank { "Tree record" },
                subtitle = "Section: ${item.first}",
                badge = item.third to stageBadgeColor(item.third)
            ) { onEdit(index) }
        }
    }
}

@Composable
private fun HarvestScheduleList(schedules: List<Triple<String, String, String>>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(schedules) { index, item ->
            OpsCard(
                icon = Icons.Default.CalendarMonth,
                title = item.first,
                subtitle = item.second,
                badge = item.third to statusBadgeColor(item.third)
            ) { onEdit(index) }
        }
    }
}

@Composable
private fun OpsCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    badge: Pair<String, Pair<Color, Color>>?,
    onClick: () -> Unit
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val iconBg = if (isDarkPalette) Color(0xFF3A2A21) else Color(0xFFEDE4DC)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    Card(
        modifier = Modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, borderColor),
        shape = RoundedCornerShape(15.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .background(iconBg, CircleShape)
                    .padding(12.dp)
            ) {
                Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 10.dp)
            ) {
                Text(
                    text = title,
                    color = titleColor,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = subtitle,
                    color = subtitleColor,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            if (badge != null) {
                Surface(
                    color = badge.second.first,
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Text(
                        text = badge.first,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                        color = badge.second.second,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun stageBadgeColor(stage: String): Pair<Color, Color> {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    if (isDarkPalette) {
        return when (stage.lowercase()) {
            "seedling" -> Color(0xFF133A5E) to Color(0xFF6AB0FF)
            "sapling" -> Color(0xFF4D2F0E) to Color(0xFFF3B562)
            "mature" -> Color(0xFF234917) to Color(0xFF9AD45E)
            "flowering" -> Color(0xFF4A4014) to Color(0xFFEAC95C)
            "fruiting" -> Color(0xFF4D2F0E) to Color(0xFFF3B562)
            "harvesting" -> Color(0xFF4B1F1F) to Color(0xFFFF7A70)
            else -> Color(0xFF3B3B3B) to Color(0xFFDADADA)
        }
    }
    return when (stage.lowercase()) {
        "seedling" -> Color(0xFFDCEBFA) to Color(0xFF255E98)
        "sapling" -> Color(0xFFF8E8D3) to Color(0xFF8A5A1A)
        "mature" -> Color(0xFFDDEFD9) to Color(0xFF2C6A2A)
        "flowering" -> Color(0xFFF8EFCF) to Color(0xFF7A5E16)
        "fruiting" -> Color(0xFFF8E8D3) to Color(0xFF8A5A1A)
        "harvesting" -> Color(0xFFF6DADB) to Color(0xFF8B2F35)
        else -> Color(0xFFE7E1DB) to Color(0xFF6D5A50)
    }
}

@Composable
private fun statusBadgeColor(status: String): Pair<Color, Color> {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    if (isDarkPalette) {
        return when (status.lowercase()) {
            "pending" -> Color(0xFF4D2F0E) to Color(0xFFF3B562)
            "in-progress" -> Color(0xFF133A5E) to Color(0xFF6AB0FF)
            "done" -> Color(0xFF234917) to Color(0xFF9AD45E)
            "scheduled" -> Color(0xFF133A5E) to Color(0xFF6AB0FF)
            else -> Color(0xFF3B3B3B) to Color(0xFFDADADA)
        }
    }
    return when (status.lowercase()) {
        "pending" -> Color(0xFFF8E8D3) to Color(0xFF8A5A1A)
        "in-progress" -> Color(0xFFDCEBFA) to Color(0xFF255E98)
        "done" -> Color(0xFFDDEFD9) to Color(0xFF2C6A2A)
        "scheduled" -> Color(0xFFDCEBFA) to Color(0xFF255E98)
        else -> Color(0xFFE7E1DB) to Color(0xFF6D5A50)
    }
}

