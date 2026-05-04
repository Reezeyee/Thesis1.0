package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.domain.FarmFinance

@Composable
fun StaffAttendanceScreen() {
    val store = LocalAppStore.current
    val state by store.appState
    var showForm by remember { mutableStateOf(false) }
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val pageBackground = if (isDarkPalette) Color(0xFF1A120D) else Color(0xFFF5F5F5)
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)

    val linkedAttendanceIds = remember(state.payroll) {
        state.payroll.mapNotNull { p ->
            (p.linkedAttendanceId ?: "").trim().takeIf { id -> id.isNotEmpty() }
        }.toSet()
    }

    val mySubmissions = remember(state.attendance) {
        state.attendance.filter { it.submittedByStaff }.asReversed()
    }

    if (showForm) {
        AttendanceFormDialog(
            workerNames = state.workers.map { it.name },
            initial = null,
            title = "Log attendance",
            onDismiss = { showForm = false },
            onSave = { w, d, ci, co, notes, _ ->
                store.addAttendance(
                    workerName = w,
                    details = notes,
                    clockIn = ci,
                    clockOut = co,
                    date = d,
                    staffSubmission = true
                )
            },
            onDelete = null,
            onCreatePayroll = null
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground)
            .padding(16.dp)
    ) {
        Text(
            text = "Select your name from the same worker list the admin maintains. Data syncs after login (requires internet for cloud). Times use 24-hour format.",
            color = subtitleColor,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(bottom = 12.dp)
        )
        Button(
            onClick = { showForm = true },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF84B626),
                contentColor = Color(0xFF111111)
            )
        ) {
            Text("Log attendance", fontWeight = FontWeight.SemiBold)
        }
        Text(
            text = "Your recent submissions",
            color = titleColor,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 20.dp, bottom = 8.dp)
        )
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (mySubmissions.isEmpty()) {
                item {
                    Text(
                        "No submissions yet.",
                        color = subtitleColor,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                itemsIndexed(mySubmissions) { _, a ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = cardColor),
                        border = BorderStroke(1.dp, borderColor)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(a.workerName ?: "", color = titleColor, fontWeight = FontWeight.SemiBold)
                            Text(
                                buildString {
                                    val dateStr = a.date ?: ""
                                    if (dateStr.isNotBlank()) append("$dateStr · ")
                                    append(FarmFinance.formatClock24h(a.clockIn ?: ""))
                                    append(" → ")
                                    append(FarmFinance.formatClock24h(a.clockOut ?: ""))
                                },
                                color = subtitleColor,
                                style = MaterialTheme.typography.bodySmall
                            )
                            val h = a.hoursWorked
                            Text(
                                if (h != null) "${"%.2f".format(h)} hours" else "Hours —",
                                color = subtitleColor,
                                style = MaterialTheme.typography.bodySmall
                            )
                            if (a.awaitingPayrollLine) {
                                Text(
                                    "Awaiting payroll line from admin",
                                    color = Color(0xFFF3B562),
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            } else if (linkedAttendanceIds.contains(a.attendanceId ?: "")) {
                                Text(
                                    "Payroll line added — open Sales Management → Payroll for payment status",
                                    color = Color(0xFF84B626),
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            } else {
                                Text(
                                    "Recorded",
                                    color = subtitleColor,
                                    style = MaterialTheme.typography.bodySmall,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
