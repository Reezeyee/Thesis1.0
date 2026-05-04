package com.melodypenero.coffeefarm.ui.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.data.store.AttendanceRecord
import com.melodypenero.coffeefarm.domain.FarmFinance
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/**
 * Add/edit attendance. [showClockFields] — worker accounts use clock in/out (hours derived from times).
 * Admin Farm Ops uses [showClockFields] = false: worker, date, notes only (no hours); workers record hours from their account.
 */
@Composable
fun AttendanceFormDialog(
    workerNames: List<String>,
    initial: AttendanceRecord?,
    title: String,
    showClockFields: Boolean = true,
    onDismiss: () -> Unit,
    onSave: (
        workerName: String,
        date: String,
        clockIn: String,
        clockOut: String,
        notes: String,
        hoursWorkedOverride: Double?,
    ) -> Unit,
    onDelete: (() -> Unit)? = null,
    onCreatePayroll: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val todayIso = remember { LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE) }
    var worker by remember(initial?.attendanceId) {
        mutableStateOf(initial?.workerName ?: workerNames.firstOrNull().orEmpty())
    }
    var dateStr by remember(initial?.attendanceId) {
        mutableStateOf(initial?.date?.takeIf { it.isNotBlank() } ?: todayIso)
    }
    var clockIn by remember(initial?.attendanceId) { mutableStateOf(initial?.clockIn.orEmpty()) }
    var clockOut by remember(initial?.attendanceId) { mutableStateOf(initial?.clockOut.orEmpty()) }
    var notes by remember(initial?.attendanceId) {
        mutableStateOf(initial?.details?.takeIf { it.isNotBlank() }.orEmpty())
    }
    var expandedWorker by remember { mutableStateOf(false) }

    val hoursFromClocks = remember(clockIn, clockOut) {
        FarmFinance.computeHoursFromClock(clockIn, clockOut)
    }
    val canSave = worker.isNotBlank() && when {
        showClockFields ->
            clockIn.isNotBlank() &&
                clockOut.isNotBlank() &&
                hoursFromClocks != null &&
                hoursFromClocks > 0
        else -> true
    }

    fun openDatePicker() {
        val initialDate = parseFlexibleDate(dateStr)
        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                dateStr = LocalDate.of(year, month + 1, dayOfMonth).format(DateTimeFormatter.ISO_LOCAL_DATE)
            },
            initialDate.year,
            initialDate.monthValue - 1,
            initialDate.dayOfMonth
        ).show()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF2D211A),
        title = {
            Text(text = title, color = Color(0xFFF4EDE6), fontWeight = FontWeight.SemiBold)
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                if (workerNames.isEmpty()) {
                    Text(
                        text = "No workers yet. Ask an admin to add your name under Workers & Operations.",
                        color = Color(0xFFF3B562),
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }
                Box(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = worker,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Worker Name") },
                        trailingIcon = {
                            Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = Color(0xFF84B626))
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6),
                            focusedBorderColor = Color(0xFF84B626),
                            unfocusedBorderColor = Color(0xFF5A463A),
                            focusedLabelColor = Color(0xFF84B626),
                            unfocusedLabelColor = Color(0xFFB8A99E)
                        )
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clickable { expandedWorker = true }
                    )
                    DropdownMenu(
                        expanded = expandedWorker && workerNames.isNotEmpty(),
                        onDismissRequest = { expandedWorker = false },
                        modifier = Modifier.background(Color(0xFF2D211A))
                    ) {
                        workerNames.forEach { name ->
                            DropdownMenuItem(
                                text = { Text(name, color = Color(0xFFF4EDE6)) },
                                colors = MenuDefaults.itemColors(textColor = Color(0xFFF4EDE6)),
                                onClick = {
                                    worker = name
                                    expandedWorker = false
                                }
                            )
                        }
                    }
                }

                Box(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    OutlinedTextField(
                        value = dateStr,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Work date") },
                        trailingIcon = {
                            Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = Color(0xFF84B626))
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6),
                            focusedBorderColor = Color(0xFF84B626),
                            unfocusedBorderColor = Color(0xFF5A463A),
                            focusedLabelColor = Color(0xFF84B626),
                            unfocusedLabelColor = Color(0xFFB8A99E)
                        )
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .clickable { openDatePicker() }
                    )
                }

                if (showClockFields) {
                    OutlinedTextField(
                        value = clockIn,
                        onValueChange = { clockIn = it },
                        label = { Text("Clock In (24-hour)") },
                        trailingIcon = {
                            Icon(
                                Icons.Default.Schedule,
                                contentDescription = "Pick time (24h)",
                                tint = Color(0xFF84B626),
                                modifier = Modifier.clickable {
                                    val (h, m) = FarmFinance.clockHourMinuteForPicker(clockIn)
                                    TimePickerDialog(
                                        context,
                                        { _, hour, minute ->
                                            clockIn = String.format(Locale.getDefault(), "%02d:%02d", hour, minute)
                                        },
                                        h,
                                        m,
                                        true
                                    ).show()
                                }
                            )
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6),
                            focusedBorderColor = Color(0xFF84B626),
                            unfocusedBorderColor = Color(0xFF5A463A),
                            focusedLabelColor = Color(0xFF84B626),
                            unfocusedLabelColor = Color(0xFFB8A99E),
                            cursorColor = Color(0xFF84B626)
                        )
                    )
                    OutlinedTextField(
                        value = clockOut,
                        onValueChange = { clockOut = it },
                        label = { Text("Clock Out (24-hour)") },
                        trailingIcon = {
                            Icon(
                                Icons.Default.Schedule,
                                contentDescription = "Pick time (24h)",
                                tint = Color(0xFF84B626),
                                modifier = Modifier.clickable {
                                    val (h, m) = FarmFinance.clockHourMinuteForPicker(clockOut, defaultHour = 17, defaultMinute = 0)
                                    TimePickerDialog(
                                        context,
                                        { _, hour, minute ->
                                            clockOut = String.format(Locale.getDefault(), "%02d:%02d", hour, minute)
                                        },
                                        h,
                                        m,
                                        true
                                    ).show()
                                }
                            )
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6),
                            focusedBorderColor = Color(0xFF84B626),
                            unfocusedBorderColor = Color(0xFF5A463A),
                            focusedLabelColor = Color(0xFF84B626),
                            unfocusedLabelColor = Color(0xFFB8A99E),
                            cursorColor = Color(0xFF84B626)
                        )
                    )
                }
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes (optional)") },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color(0xFFF4EDE6),
                        unfocusedTextColor = Color(0xFFF4EDE6),
                        focusedBorderColor = Color(0xFF84B626),
                        unfocusedBorderColor = Color(0xFF5A463A),
                        focusedLabelColor = Color(0xFF84B626),
                        unfocusedLabelColor = Color(0xFFB8A99E),
                        cursorColor = Color(0xFF84B626)
                    )
                )
                if (showClockFields) {
                    val hp = hoursFromClocks
                    Text(
                        text = when {
                            hp == null -> "Hours: enter valid times"
                            hp <= 0 -> "Hours: invalid"
                            else -> "Hours worked: ${"%.2f".format(hp)} h"
                        },
                        color = Color(0xFFB8A99E),
                        modifier = Modifier.padding(top = 8.dp)
                    )
                } else {
                    Text(
                        text = "Hours are recorded when workers log attendance from their account.",
                        color = Color(0xFFB8A99E),
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                if (showClockFields && initial?.awaitingPayrollLine == true) {
                    Text(
                        text = "Awaiting payroll line — confirm in Payroll or create a line here.",
                        color = Color(0xFFF3B562),
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
                if (showClockFields && onCreatePayroll != null && initial?.awaitingPayrollLine == true) {
                    TextButton(
                        onClick = {
                            onCreatePayroll()
                            onDismiss()
                        },
                        modifier = Modifier.padding(top = 8.dp)
                    ) {
                        Text("Create payroll line from this attendance", color = Color(0xFF6AB0FF), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(worker.trim(), dateStr.trim(), clockIn.trim(), clockOut.trim(), notes.trim(), null)
                    onDismiss()
                },
                enabled = canSave && workerNames.isNotEmpty()
            ) {
                Text("Save", color = Color(0xFF84B626), fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Color(0xFFB8A99E))
            }
        },
        icon = {
            if (onDelete != null) {
                TextButton(
                    onClick = {
                        onDelete()
                        onDismiss()
                    }
                ) {
                    Text("Delete", color = Color(0xFFFF7A70), fontWeight = FontWeight.SemiBold)
                }
            }
        }
    )
}

private fun parseFlexibleDate(raw: String): LocalDate {
    val cleaned = raw.trim()
    if (cleaned.isBlank()) return LocalDate.now()
    val formats = listOf(
        DateTimeFormatter.ISO_LOCAL_DATE,
        DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.getDefault()),
        DateTimeFormatter.ofPattern("MMM d yyyy", Locale.getDefault()),
    )
    for (fmt in formats) {
        try {
            return LocalDate.parse(cleaned, fmt)
        } catch (_: DateTimeParseException) {
        }
    }
    return LocalDate.now()
}
