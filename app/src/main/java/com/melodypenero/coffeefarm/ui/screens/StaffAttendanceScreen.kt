package com.melodypenero.coffeefarm.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuDefaults
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.domain.FarmFinance
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette
import com.melodypenero.coffeefarm.ui.theme.AccentGreenBright
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.auth.UserRole

@Composable
fun StaffAttendanceScreen(session: AuthSession) {
    val store = LocalAppStore.current
    val state by store.appState
    val palette = farmPalette()
    val today = remember { LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE) }
    val linkedWorker = remember(state.workers, session.userId, session.email) {
        state.workers.firstOrNull { worker ->
            val wUid = worker.authUid ?: ""
            val wEmail = worker.accountEmail ?: ""
            wUid.equals(session.userId, ignoreCase = true) ||
                wEmail.equals(session.email, ignoreCase = true)
        }
    }
    val workerNames = remember(state.workers, linkedWorker, session.role) {
        if (session.role == UserRole.FARM_STAFF) {
            val name = linkedWorker?.name ?: ""
            if (name.isNotBlank()) listOf(name) else emptyList()
        } else {
            state.workers.map { it.name ?: "" }.filter { it.isNotBlank() }
        }
    }
    var selectedWorker by remember(workerNames, session.userId) { mutableStateOf(workerNames.firstOrNull().orEmpty()) }
    var workerMenuOpen by remember { mutableStateOf(false) }
    val isLinkedWorkerAccount = session.role == UserRole.FARM_STAFF && linkedWorker != null

    val linkedAttendanceIds = remember(state.payroll) {
        state.payroll.mapNotNull { p ->
            val aid = p.linkedAttendanceId ?: ""
            aid.trim().takeIf { id -> id.isNotEmpty() }
        }.toSet()
    }

    val mySubmissions = remember(state.attendance, selectedWorker, session.role) {
        state.attendance
            .filter {
                it.submittedByStaff &&
                    (session.role != UserRole.FARM_STAFF ||
                        it.workerName.equals(selectedWorker, ignoreCase = true))
            }
            .asReversed()
    }
    val todayAttendanceIndex = remember(state.attendance, selectedWorker, today) {
        state.attendance.indexOfLast {
            it.submittedByStaff &&
                it.date == today &&
                it.workerName.equals(selectedWorker, ignoreCase = true)
        }
    }
    val todayAttendance = state.attendance.getOrNull(todayAttendanceIndex)
    val hasTimedInToday = !todayAttendance?.clockIn.isNullOrBlank()
    val hasTimedOutToday = !todayAttendance?.clockOut.isNullOrBlank()

    fun nowClock(): String = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))

    fun timeIn() {
        if (selectedWorker.isBlank() || hasTimedInToday) return
        store.addAttendance(
            workerName = selectedWorker,
            details = "",
            clockIn = nowClock(),
            clockOut = "",
            date = today,
            staffSubmission = true
        )
    }

    fun timeOut() {
        val attendance = todayAttendance ?: return
        if (todayAttendanceIndex < 0 || !hasTimedInToday || hasTimedOutToday) return
        store.updateAttendance(
            index = todayAttendanceIndex,
            workerName = attendance.workerName,
            details = attendance.details,
            clockIn = attendance.clockIn,
            clockOut = nowClock(),
            date = today,
            awaitingPayrollLine = true,
            submittedByStaff = true
        )
    }

    FarmLazyScreen(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            FarmSectionTitle(
                title = "My attendance",
                subtitle = if (isLinkedWorkerAccount) {
                    "Signed in as ${linkedWorker?.name}. Time In/Time Out is saved to this worker account."
                } else {
                    "This login is not linked to an employee record yet. Ask the admin to create the worker account from the website."
                }
            )
        }
        item {
            FarmCard {
                Text(
                    text = "Today",
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium
                )
                Box(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                            .padding(16.dp)
                            .clickable(enabled = workerNames.isNotEmpty()) {
                                workerMenuOpen = true
                            }
                    ) {
                        Text("Worker", color = palette.textSecondary, style = MaterialTheme.typography.labelMedium)
                        Text(
                            selectedWorker.ifBlank {
                                if (session.role == UserRole.FARM_STAFF) "Worker account not linked" else "No workers available"
                            },
                            color = palette.textPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Icon(
                        Icons.Default.ArrowDropDown,
                        contentDescription = null,
                        tint = palette.accent,
                        modifier = Modifier
                            .padding(top = 28.dp, end = 12.dp)
                            .align(Alignment.TopEnd)
                    )
                    DropdownMenu(
                        expanded = workerMenuOpen,
                        onDismissRequest = { workerMenuOpen = false }
                    ) {
                        workerNames.forEach { name ->
                            DropdownMenuItem(
                                text = { Text(name, color = palette.textPrimary) },
                                colors = MenuDefaults.itemColors(textColor = palette.textPrimary),
                                onClick = {
                                    selectedWorker = name
                                    workerMenuOpen = false
                                }
                            )
                        }
                    }
                }
                Text(
                    text = buildString {
                        append(today)
                        append(" · ")
                        append(
                            "Time in: ${
                                todayAttendance?.clockIn
                                    ?.takeIf { it.isNotBlank() }
                                    ?.let(FarmFinance::formatClock24h)
                                    ?: "--:--"
                            }"
                        )
                        append(" · ")
                        append(
                            "Time out: ${
                                todayAttendance?.clockOut
                                    ?.takeIf { it.isNotBlank() }
                                    ?.let(FarmFinance::formatClock24h)
                                    ?: "--:--"
                            }"
                        )
                    },
                    color = palette.textSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
                FarmPrimaryButton(
                    text = if (hasTimedInToday) "Time in recorded" else "Time in",
                    onClick = { timeIn() },
                    enabled = selectedWorker.isNotBlank() && !hasTimedInToday
                )
                FarmPrimaryButton(
                    text = if (hasTimedOutToday) "Time out recorded" else "Time out",
                    onClick = { timeOut() },
                    enabled = hasTimedInToday && !hasTimedOutToday
                )
                Text(
                    text = if (hasTimedOutToday) {
                        "Today's attendance is saved. Tomorrow the buttons reset for a new record."
                    } else if (hasTimedInToday) {
                        "Time in is saved. Tap Time out when the workday ends."
                    } else if (session.role == UserRole.FARM_STAFF && !isLinkedWorkerAccount) {
                        "The admin must add this employee in the website so the email is linked to a worker profile."
                    } else {
                        "Tap Time in when the workday starts."
                    },
                    color = palette.textSecondary,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        item {
            Text(
                text = "Your recent submissions",
                style = MaterialTheme.typography.titleMedium,
                color = palette.textPrimary,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
        if (mySubmissions.isEmpty()) {
            item {
                Text(
                    "No submissions yet.",
                    color = palette.textSecondary,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        } else {
            itemsIndexed(mySubmissions) { _, a ->
                FarmCard {
                    Text(a.workerName, color = palette.textPrimary, fontWeight = FontWeight.SemiBold)
                    Text(
                        buildString {
                            val dateStr = a.date
                            if (dateStr.isNotBlank()) append("$dateStr · ")
                            append(FarmFinance.formatClock24h(a.clockIn))
                            append(" → ")
                            append(FarmFinance.formatClock24h(a.clockOut))
                        },
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                    val h = a.hoursWorked
                    Text(
                        if (h != null) "${"%.2f".format(h)} hours" else "Hours —",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (a.awaitingPayrollLine) {
                        Text(
                            "Awaiting payroll line from admin",
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                    } else if (linkedAttendanceIds.contains(a.attendanceId)) {
                        Text(
                            "Payroll line added — check the web admin portal for payment status",
                            color = AccentGreenBright,
                            style = MaterialTheme.typography.bodySmall
                        )
                    } else {
                        Text(
                            "Recorded",
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}
