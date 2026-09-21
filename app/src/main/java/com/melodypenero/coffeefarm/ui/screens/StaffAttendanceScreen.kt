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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuDefaults
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.location.Location
import android.location.LocationManager
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import java.io.ByteArrayOutputStream

/** Acojido farm HQ (Limay); see BATAAN_MAP_HUBS in the website's bataanProvinceMap.ts. */
private const val FARM_ORIGIN_LATITUDE = 14.5394408
private const val FARM_ORIGIN_LONGITUDE = 120.5763727

/** How far from farm HQ a time-in/time-out/correction can still count as on-site. */
private const val FARM_GEOFENCE_RADIUS_METERS = 500f

private fun isWithinFarmGeofence(latitude: Double, longitude: Double): Boolean {
    val result = FloatArray(1)
    Location.distanceBetween(latitude, longitude, FARM_ORIGIN_LATITUDE, FARM_ORIGIN_LONGITUDE, result)
    return result[0] <= FARM_GEOFENCE_RADIUS_METERS
}

@Composable
fun StaffAttendanceScreen(session: AuthSession) {
    val context = LocalContext.current
    val store = LocalAppStore.current
    val state by store.appState
    val palette = farmPalette()

    fun hasCameraPermission() =
        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    fun hasLocationPermission() =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    var isLocationPermissionGranted by remember { mutableStateOf(hasLocationPermission()) }
    // Set right before requesting permissions so the camera only opens once permission has
    // actually been granted, instead of launching both activities back-to-back (which races the
    // two ActivityResultLaunchers and can silently drop the camera capture).
    var pendingCameraOpen by remember { mutableStateOf(false) }

    val cameraLauncherRef = remember { mutableStateOf<(() -> Unit)?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        isLocationPermissionGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (pendingCameraOpen && permissions[Manifest.permission.CAMERA] == true) {
            cameraLauncherRef.value?.invoke()
        }
        pendingCameraOpen = false
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

    /** Best last-known fix across providers, or null if permission/GPS/network location is unavailable. */
    fun getCurrentLocation(): Triple<Double, Double, String>? {
        if (!hasLocationPermission()) return null
        val lm = locationManager ?: return null
        val best = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .mapNotNull { provider ->
                try {
                    @Suppress("MissingPermission")
                    lm.getLastKnownLocation(provider)
                } catch (_: Exception) {
                    null
                }
            }
            .maxByOrNull { it.time }
            ?: return null
        return Triple(best.latitude, best.longitude, "%.6f, %.6f".format(best.latitude, best.longitude))
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
    /** Which punch the open face-scan dialog is capturing for: true = Time In, false = Time Out. */
    var faceScanForTimeIn by remember { mutableStateOf(true) }

    var showCorrectionDialog by remember { mutableStateOf(false) }
    var showLeaveDialog by remember { mutableStateOf(false) }
    var correctionDate by remember { mutableStateOf(today) }
    /** Which punch the worker is correcting: true = Time In, false = Time Out. */
    var correctingTimeIn by remember { mutableStateOf(true) }
    var correctionTime by remember { mutableStateOf("08:00 AM") }
    var correctionReason by remember { mutableStateOf("") }
    var leaveType by remember { mutableStateOf("Sick Leave") }
    var leaveTypeMenuOpen by remember { mutableStateOf(false) }
    val leaveTypeOptions = remember {
        listOf("Sick Leave", "Vacation Leave", "Emergency Leave", "Bereavement", "Maternity / Paternity", "Official Business", "Unpaid Leave")
    }
    var leaveStartDate by remember { mutableStateOf(today) }
    var leaveEndDate by remember { mutableStateOf(today) }
    var leaveReason by remember { mutableStateOf("") }

    val myCorrections = remember(state.timesheetCorrections, selectedWorker) {
        state.timesheetCorrections.filter {
            it.workerName.equals(selectedWorker, ignoreCase = true)
        }
    }

    val myLeaves = remember(state.leaveRequests, selectedWorker) {
        state.leaveRequests.filter {
            it.workerName.equals(selectedWorker, ignoreCase = true)
        }
    }

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
    cameraLauncherRef.value = { cameraLauncher.launch(null) }

    fun openCameraScan() {
        // Ask for location permission alongside camera (best-effort; a "no" here just means the
        // eventual submission goes through without a verified location) but only ever launch the
        // camera once camera permission is actually granted -- launching both activities back to
        // back races the two ActivityResultLaunchers and can silently drop the photo capture.
        if (hasCameraPermission()) {
            cameraLauncher.launch(null)
            if (!hasLocationPermission()) {
                permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            }
        } else {
            pendingCameraOpen = true
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    fun nowClock(): String = LocalTime.now().format(DateTimeFormatter.ofPattern("hh:mm a"))

    fun submitTimeInWithScan() {
        val facePhoto = capturedBitmap?.let { bitmapToBase64(it) } ?: ""
        val loc = getCurrentLocation()
        store.addAttendance(
            workerName = selectedWorker,
            details = "",
            clockIn = nowClock(),
            clockOut = "",
            date = today,
            staffSubmission = true,
            timeInLatitude = loc?.first ?: FARM_ORIGIN_LATITUDE,
            timeInLongitude = loc?.second ?: FARM_ORIGIN_LONGITUDE,
            timeInLocationName = loc?.third ?: "Location unavailable",
            faceSnapshotBase64 = facePhoto,
            isGeofenceVerified = loc?.let { isWithinFarmGeofence(it.first, it.second) } ?: false
        )
        showFaceScanDialog = false
        capturedBitmap = null
    }

    fun submitTimeOutWithScan() {
        val attendance = todayAttendance
        if (attendance == null || todayAttendanceIndex < 0 || !hasTimedInToday || hasTimedOutToday) {
            showFaceScanDialog = false
            capturedBitmap = null
            return
        }
        val facePhoto = capturedBitmap?.let { bitmapToBase64(it) } ?: ""
        val loc = getCurrentLocation()
        store.updateAttendance(
            index = todayAttendanceIndex,
            workerName = attendance.workerName,
            details = attendance.details,
            clockIn = attendance.clockIn,
            clockOut = nowClock(),
            date = today,
            awaitingPayrollLine = true,
            submittedByStaff = true,
            timeOutLatitude = loc?.first ?: FARM_ORIGIN_LATITUDE,
            timeOutLongitude = loc?.second ?: FARM_ORIGIN_LONGITUDE,
            timeOutLocationName = loc?.third ?: "Location unavailable",
            timeOutFaceSnapshotBase64 = facePhoto,
            isTimeOutGeofenceVerified = loc?.let { isWithinFarmGeofence(it.first, it.second) } ?: false
        )
        showFaceScanDialog = false
        capturedBitmap = null
    }

    fun selectCorrectionType(timeIn: Boolean) {
        correctingTimeIn = timeIn
        correctionTime = if (timeIn) "08:00 AM" else "05:00 PM"
    }

    fun openCorrectionDialog() {
        correctionDate = today
        // Default to whichever punch is actually missing today.
        selectCorrectionType(timeIn = !hasTimedInToday)
        showCorrectionDialog = true
    }

    fun submitCorrection() {
        if (selectedWorker.isBlank() || correctionReason.isBlank() || correctionTime.isBlank()) return
        // Only the chosen punch is sent; the other stays blank so the store tags the request as
        // field "clockIn"/"clockOut" and the website keeps the original value for the other side.
        store.addTimesheetCorrection(
            workerName = selectedWorker,
            date = correctionDate,
            requestedClockIn = if (correctingTimeIn) correctionTime else "",
            requestedClockOut = if (correctingTimeIn) "" else correctionTime,
            reason = correctionReason,
            originalClockIn = todayAttendance?.clockIn ?: "",
            originalClockOut = todayAttendance?.clockOut ?: "",
            attendanceId = todayAttendance?.attendanceId ?: ""
        )
        showCorrectionDialog = false
        correctionReason = ""
    }

    fun timeIn() {
        if (selectedWorker.isBlank() || hasTimedInToday) return
        faceScanForTimeIn = true
        showFaceScanDialog = true
    }

    fun timeOut() {
        if (todayAttendanceIndex < 0 || !hasTimedInToday || hasTimedOutToday) return
        faceScanForTimeIn = false
        showFaceScanDialog = true
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

        // Missing Time In Alert Notice
        if (!hasTimedInToday && selectedWorker.isNotBlank()) {
            item {
                FarmCard {
                    Text(
                        text = "⚠️ Missing Time In",
                        color = Color(0xFFF3B562),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "Date: $today · Employee: $selectedWorker\nStatus: Requires Correction (Forgot to clock in or on leave)",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(
                            onClick = { openCorrectionDialog() },
                            modifier = Modifier
                                .weight(1f)
                                .border(1.dp, Color(0xFFF3B562), RoundedCornerShape(12.dp))
                        ) {
                            Text("Request Correction", color = Color(0xFFF3B562), fontWeight = FontWeight.Bold)
                        }
                        TextButton(
                            onClick = {
                                leaveStartDate = today
                                leaveEndDate = today
                                showLeaveDialog = true
                            },
                            modifier = Modifier
                                .weight(1f)
                                .border(1.dp, Color(0xFF84B626), RoundedCornerShape(12.dp))
                        ) {
                            Text("File Leave", color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        item {
            FarmCard {
                Text(
                    text = "Today",
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, palette.border, RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Text(
                        selectedWorker.ifBlank {
                            if (session.role == UserRole.FARM_STAFF) "Worker account not linked" else "No workers available"
                        },
                        color = palette.textPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
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
                if (hasTimedOutToday) {
                    val breakdown = FarmFinance.formatHoursBreakdown(todayAttendance?.regularHours, todayAttendance?.overtimeHours)
                        ?: todayAttendance?.hoursWorked?.let { FarmFinance.formatHoursBreakdown(it) }
                    if (breakdown != null) {
                        Text(
                            text = "Hours worked: $breakdown",
                            color = palette.textSecondary,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
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

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TextButton(
                        onClick = { openCorrectionDialog() },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Request Correction", color = palette.accent, fontWeight = FontWeight.SemiBold)
                    }
                    TextButton(
                        onClick = {
                            leaveStartDate = today
                            leaveEndDate = today
                            showLeaveDialog = true
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("File Leave", color = palette.accent, fontWeight = FontWeight.SemiBold)
                    }
                }

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

        // Timesheet Corrections Section
        if (myCorrections.isNotEmpty()) {
            item {
                Text(
                    text = "Timesheet Correction Requests",
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            itemsIndexed(myCorrections) { _, c ->
                FarmCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Date: ${c.date}", color = palette.textPrimary, fontWeight = FontWeight.Bold)
                        Text(
                            text = c.status,
                            color = if (c.status == "Approved") AccentGreenBright else if (c.status == "Rejected") Color(0xFFE57373) else Color(0xFFF3B562),
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                    Text(
                        "Requested: ${c.requestedClockIn.ifBlank { "--" }} - ${c.requestedClockOut.ifBlank { "--" }}",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        "Reason: ${c.reason}",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (c.managerRemarks.isNotBlank()) {
                        Text(
                            "Manager Remarks: ${c.managerRemarks}",
                            color = AccentGreenBright,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }

        // Leave Requests Section
        if (myLeaves.isNotEmpty()) {
            item {
                Text(
                    text = "My Leave Requests",
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            itemsIndexed(myLeaves) { _, l ->
                FarmCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(l.leaveType, color = palette.textPrimary, fontWeight = FontWeight.Bold)
                        Text(
                            text = l.status,
                            color = if (l.status == "Approved") AccentGreenBright else if (l.status == "Rejected") Color(0xFFE57373) else Color(0xFFF3B562),
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                    Text(
                        "Dates: ${l.startDate} to ${l.endDate} (${l.leaveDays} days)",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        "Reason: ${l.reason}",
                        color = palette.textSecondary,
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (l.managerRemarks.isNotBlank()) {
                        Text(
                            "Manager Remarks: ${l.managerRemarks}",
                            color = AccentGreenBright,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
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
                    val breakdown = FarmFinance.formatHoursBreakdown(a.regularHours, a.overtimeHours)
                        ?: a.hoursWorked?.let { FarmFinance.formatHoursBreakdown(it) }
                    Text(
                        breakdown ?: "Hours —",
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

    // Dialog for Timesheet Correction Request
    if (showCorrectionDialog) {
        AlertDialog(
            onDismissRequest = { showCorrectionDialog = false },
            containerColor = Color(0xFF2D211A),
            title = {
                Text("Request Timesheet Correction", color = Color(0xFFF4EDE6), fontWeight = FontWeight.SemiBold)
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Employee: $selectedWorker", color = Color(0xFFF3B562), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)

                    OutlinedTextField(
                        value = correctionDate,
                        onValueChange = { correctionDate = it },
                        label = { Text("Date (YYYY-MM-DD)", color = Color(0xFFB8A99E)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text("What do you need to correct?", color = Color(0xFFB8A99E), style = MaterialTheme.typography.labelMedium)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(true to "Time In", false to "Time Out").forEach { (isTimeIn, label) ->
                            val selected = correctingTimeIn == isTimeIn
                            val tint = if (selected) Color(0xFF84B626) else Color(0xFFB8A99E)
                            TextButton(
                                onClick = { selectCorrectionType(isTimeIn) },
                                modifier = Modifier
                                    .weight(1f)
                                    .border(if (selected) 2.dp else 1.dp, tint, RoundedCornerShape(12.dp))
                            ) {
                                Text(
                                    if (selected) "✓ $label" else label,
                                    color = tint,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }

                    val originalPunch = if (correctionDate == today) {
                        if (correctingTimeIn) todayAttendance?.clockIn else todayAttendance?.clockOut
                    } else {
                        null
                    }
                    if (!originalPunch.isNullOrBlank()) {
                        Text(
                            "Currently recorded: ${FarmFinance.formatClock24h(originalPunch)}",
                            color = Color(0xFFB8A99E),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    OutlinedTextField(
                        value = correctionTime,
                        onValueChange = { correctionTime = it },
                        label = {
                            Text(
                                if (correctingTimeIn) "Correct Time In (e.g. 08:00 AM)" else "Correct Time Out (e.g. 05:00 PM)",
                                color = Color(0xFFB8A99E)
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = correctionReason,
                        onValueChange = { correctionReason = it },
                        label = { Text("Reason for Correction", color = Color(0xFFB8A99E)) },
                        placeholder = { Text("e.g. Forgot to clock in before morning harvesting briefing", color = Color(0xFF8C7E76)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { submitCorrection() },
                    enabled = selectedWorker.isNotBlank() && correctionReason.isNotBlank() && correctionTime.isNotBlank()
                ) {
                    Text("Submit Request", color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCorrectionDialog = false }) {
                    Text("Cancel", color = Color(0xFFB8A99E))
                }
            }
        )
    }

    // Dialog for Leave Filing Request
    if (showLeaveDialog) {
        AlertDialog(
            onDismissRequest = { showLeaveDialog = false },
            containerColor = Color(0xFF2D211A),
            title = {
                Text("File Employee Leave", color = Color(0xFFF4EDE6), fontWeight = FontWeight.SemiBold)
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Employee: $selectedWorker", color = Color(0xFF84B626), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)

                    Box(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, Color(0xFFB8A99E), RoundedCornerShape(8.dp))
                                .padding(12.dp)
                                .clickable { leaveTypeMenuOpen = true }
                        ) {
                            Text("Leave Type", color = Color(0xFFB8A99E), style = MaterialTheme.typography.labelSmall)
                            Text(leaveType, color = Color(0xFFF4EDE6), fontWeight = FontWeight.SemiBold)
                        }
                        DropdownMenu(
                            expanded = leaveTypeMenuOpen,
                            onDismissRequest = { leaveTypeMenuOpen = false }
                        ) {
                            leaveTypeOptions.forEach { opt ->
                                DropdownMenuItem(
                                    text = { Text(opt) },
                                    onClick = {
                                        leaveType = opt
                                        leaveTypeMenuOpen = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = leaveStartDate,
                        onValueChange = { leaveStartDate = it },
                        label = { Text("Start Date (YYYY-MM-DD)", color = Color(0xFFB8A99E)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = leaveEndDate,
                        onValueChange = { leaveEndDate = it },
                        label = { Text("End Date (YYYY-MM-DD)", color = Color(0xFFB8A99E)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = leaveReason,
                        onValueChange = { leaveReason = it },
                        label = { Text("Reason for Leave", color = Color(0xFFB8A99E)) },
                        placeholder = { Text("e.g. Medical check-up / Family emergency", color = Color(0xFF8C7E76)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color(0xFFF4EDE6),
                            unfocusedTextColor = Color(0xFFF4EDE6)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (selectedWorker.isNotBlank() && leaveReason.isNotBlank()) {
                            store.addLeaveRequest(
                                workerName = selectedWorker,
                                leaveType = leaveType,
                                startDate = leaveStartDate,
                                endDate = leaveEndDate,
                                leaveDays = runCatching {
                                    java.time.temporal.ChronoUnit.DAYS.between(
                                        LocalDate.parse(leaveStartDate.trim()),
                                        LocalDate.parse(leaveEndDate.trim())
                                    ).toInt() + 1
                                }.getOrDefault(1).coerceAtLeast(1),
                                reason = leaveReason
                            )
                            showLeaveDialog = false
                            leaveReason = ""
                        }
                    },
                    enabled = selectedWorker.isNotBlank() && leaveReason.isNotBlank()
                ) {
                    Text("Submit Leave", color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLeaveDialog = false }) {
                    Text("Cancel", color = Color(0xFFB8A99E))
                }
            }
        )
    }

    if (showFaceScanDialog) {
        AlertDialog(
            onDismissRequest = {
                showFaceScanDialog = false
                capturedBitmap = null
            },
            containerColor = Color(0xFF2D211A),
            title = {
                Text(
                    if (faceScanForTimeIn) "Biometric Face Verification — Time In" else "Biometric Face Verification — Time Out",
                    color = Color(0xFFF4EDE6),
                    fontWeight = FontWeight.SemiBold
                )
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

                    val loc = if (isGpsEnabled && hasLocationPermission()) getCurrentLocation() else null
                    Text(
                        when {
                            !hasLocationPermission() -> "⚠️ Location permission not granted -- this submission will be marked unverified."
                            !isGpsEnabled -> "⚠️ Location (GPS) is off -- this submission will be marked unverified."
                            loc == null -> "⚠️ No GPS fix yet -- this submission will be marked unverified."
                            isWithinFarmGeofence(loc.first, loc.second) -> "📍 Location verified: on-site (${loc.third})"
                            else -> "📍 Location captured but outside the farm geofence (${loc.third})"
                        },
                        color = if (loc != null && isWithinFarmGeofence(loc.first, loc.second)) AccentGreenBright else Color(0xFFB8A99E),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { if (faceScanForTimeIn) submitTimeInWithScan() else submitTimeOutWithScan() },
                    enabled = capturedBitmap != null
                ) {
                    Text(
                        if (faceScanForTimeIn) "Confirm Time In" else "Confirm Time Out",
                        color = Color(0xFF84B626),
                        fontWeight = FontWeight.SemiBold
                    )
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
