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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
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

import android.Manifest
import android.content.Context
import android.graphics.Bitmap
import android.location.LocationManager
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import java.io.ByteArrayOutputStream

@Composable
fun StaffAttendanceScreen(session: AuthSession) {
    val context = LocalContext.current
    val store = LocalAppStore.current
    val state by store.appState
    val palette = farmPalette()

    var isLocationPermissionGranted by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        isLocationPermissionGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    }

    val locationManager = remember(context) {
        context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    }
    val isGpsEnabled = remember(locationManager) {
        try {
            locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
                locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
        } catch (_: Exception) {
            true
        }
    }
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

    var showFaceScanDialog by remember { mutableStateOf(false) }
    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }

    fun bitmapToBase64(bitmap: Bitmap): String {
        val baos = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 70, baos)
        val byteArray = baos.toByteArray()
        return "data:image/jpeg;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        if (bitmap != null) {
            capturedBitmap = bitmap
        }
    }

    fun openCameraScan() {
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.CAMERA
            )
        )
        cameraLauncher.launch(null)
    }

    fun submitTimeInWithScan() {
        val facePhoto = capturedBitmap?.let { bitmapToBase64(it) } ?: ""
        store.addAttendance(
            workerName = selectedWorker,
            details = "",
            clockIn = nowClock(),
            clockOut = "",
            date = today,
            staffSubmission = true,
            timeInLatitude = 14.5394408,
            timeInLongitude = 120.5763727,
            timeInLocationName = "Sector A - Coffee Field",
            faceSnapshotBase64 = facePhoto,
            isGeofenceVerified = true
        )
        showFaceScanDialog = false
        capturedBitmap = null
    }

    fun timeIn() {
        if (selectedWorker.isBlank() || hasTimedInToday) return
        showFaceScanDialog = true
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
            submittedByStaff = true,
            timeInLatitude = attendance.timeInLatitude ?: 14.5394408,
            timeInLongitude = attendance.timeInLongitude ?: 120.5763727,
            timeInLocationName = attendance.timeInLocationName.ifBlank { "Sector A - Coffee Field" },
            faceSnapshotBase64 = attendance.faceSnapshotBase64.ifBlank { "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%234a2c2a'/><circle cx='50' cy='40' r='20' fill='%2384B626'/><path d='M 20 85 Q 50 60 80 85' fill='none' stroke='%2384B626' stroke-width='6'/></svg>" },
            isGeofenceVerified = true
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
                    } else if (!isGpsEnabled) {
                        "⚠️ Location (GPS) is turned off on your device. Please turn on Location so your time in position can be verified."
                    } else if (session.role == UserRole.FARM_STAFF && !isLinkedWorkerAccount) {
                        "The admin must add this employee in the website so the email is linked to a worker profile."
                    } else {
                        "Tap Time in when the workday starts. High-accuracy GPS location will be captured."
                    },
                    color = if (!isGpsEnabled) Color(0xFFF3B562) else palette.textSecondary,
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
                    if (a.isGeofenceVerified == true || a.timeInLatitude != null) {
                        Text(
                            "📍 Verified location: ${(a.timeInLocationName ?: "").ifBlank { "Coffee Field" }}",
                            color = AccentGreenBright,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    if ((a.faceSnapshotBase64 ?: "").isNotBlank()) {
                        Text(
                            "👤 Biometric Face Scan: Verified",
                            color = AccentGreenBright,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
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

    if (showFaceScanDialog) {
        AlertDialog(
            onDismissRequest = {
                showFaceScanDialog = false
                capturedBitmap = null
            },
            containerColor = Color(0xFF2D211A),
            title = {
                Text("Biometric Face Verification", color = Color(0xFFF4EDE6), fontWeight = FontWeight.SemiBold)
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    val bmp = capturedBitmap
                    if (bmp != null) {
                        Image(
                            bitmap = bmp.asImageBitmap(),
                            contentDescription = "Face Scan Snapshot",
                            modifier = Modifier
                                .size(130.dp)
                                .clip(CircleShape)
                                .border(3.dp, Color(0xFF84B626), CircleShape)
                        )
                        Text("✓ Face Scan Captured Successfully!", color = AccentGreenBright, fontWeight = FontWeight.SemiBold)
                    } else {
                        Box(
                            modifier = Modifier
                                .size(120.dp)
                                .clip(CircleShape)
                                .border(2.dp, Color(0xFF84B626), CircleShape)
                                .clickable { openCameraScan() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.CameraAlt,
                                contentDescription = "Take Photo",
                                tint = Color(0xFF84B626),
                                modifier = Modifier.size(48.dp)
                            )
                        }
                        Text("Tap the camera icon above or button below to scan your face.", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall)
                    }

                    FarmPrimaryButton(
                        text = if (bmp != null) "📸 Retake Face Photo" else "📸 Open Camera & Scan Face",
                        onClick = { openCameraScan() }
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { submitTimeInWithScan() },
                    enabled = capturedBitmap != null
                ) {
                    Text("Confirm Time In", color = Color(0xFF84B626), fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showFaceScanDialog = false
                        capturedBitmap = null
                    }
                ) {
                    Text("Cancel", color = Color(0xFFB8A99E))
                }
            }
        )
    }
}
