package com.melodypenero.coffeefarm.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.data.store.PestControlRecord
import com.melodypenero.coffeefarm.ui.components.farmPalette
import java.io.ByteArrayOutputStream
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val PEST_OPTIONS = listOf(
    "Coffee Berry Borer (Hypothenemus hampei)",
    "Coffee Leaf Rust (Hemileia vastatrix)",
    "Twig Borer / Branch Dieback",
    "Mealybugs / Scale Insects",
    "Cercospora Leaf Spot",
    "Root Rot / Sudden Wilting",
    "Other / Unidentified Pest"
)

fun bitmapToBase64(bitmap: Bitmap): String {
    val maxDim = 800
    val w = bitmap.width
    val h = bitmap.height
    val scaled = if (w > maxDim || h > maxDim) {
        val aspect = w.toFloat() / h.toFloat()
        if (aspect > 1f) {
            Bitmap.createScaledBitmap(bitmap, maxDim, (maxDim / aspect).toInt(), true)
        } else {
            Bitmap.createScaledBitmap(bitmap, (maxDim * aspect).toInt(), maxDim, true)
        }
    } else {
        bitmap
    }
    val outputStream = ByteArrayOutputStream()
    scaled.compress(Bitmap.CompressFormat.JPEG, 82, outputStream)
    val bytes = outputStream.toByteArray()
    return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
}

fun base64ToBitmap(data: String): Bitmap? {
    return try {
        val base64Clean = if (data.contains(",")) data.substringAfter(",") else data
        val decoded = Base64.decode(base64Clean, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(decoded, 0, decoded.size)
    } catch (_: Exception) {
        null
    }
}

@Composable
fun PestDiseaseScreen(reporterDisplayName: String = "") {
    val store = LocalAppStore.current
    val state by store.appState
    val context = LocalContext.current
    val palette = farmPalette()
    var showDialog by remember { mutableStateOf(false) }

    val zoneOptions = remember(state.coffeeFields, state.sections) {
        val list = (state.coffeeFields.map { it.name } + state.sections.map { it.name })
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .distinct()
        if (list.isEmpty()) listOf("General Farm") else list
    }

    val workerReports = remember(state.pestControlLogs, reporterDisplayName) {
        val name = reporterDisplayName.trim().lowercase(Locale.ROOT)
        state.pestControlLogs
            .filter {
                val rep = (it.reportedBy).trim().lowercase(Locale.ROOT)
                name.isBlank() || rep.isBlank() || rep == name || rep.contains(name) || name.contains(rep)
            }
            .asReversed()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.pageGradient)
    ) {
        PestReportList(
            reports = workerReports,
            onNewReport = { showDialog = true }
        )

        FloatingActionButton(
            onClick = { showDialog = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(18.dp),
            containerColor = Color(0xFFE53935),
            contentColor = Color.White
        ) {
            Icon(Icons.Default.Add, contentDescription = "Report Pest/Disease")
        }
    }

    if (showDialog) {
        PestReportFormDialog(
            zoneOptions = zoneOptions,
            reporterName = reporterDisplayName.ifBlank { "Field Worker" },
            onDismiss = { showDialog = false },
            onSubmit = { field, treeNum, issue, notes, photoBase64 ->
                val dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US))
                val timeStr = LocalTime.now().format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))
                store.addPestControlLog(
                    date = dateStr,
                    time = timeStr,
                    field = field,
                    treeNumber = treeNum,
                    issue = issue,
                    treatment = "",
                    status = "Pending",
                    photoUrl = photoBase64,
                    photoBase64 = photoBase64,
                    reportedBy = reporterDisplayName.ifBlank { "Field Worker" },
                    notes = notes,
                    timestampMillis = System.currentTimeMillis()
                )
                Toast.makeText(context, "Pest & Disease Report submitted to Admin!", Toast.LENGTH_LONG).show()
                showDialog = false
            }
        )
    }
}

@Composable
private fun PestReportList(
    reports: List<PestControlRecord>,
    onNewReport: () -> Unit
) {
    val palette = farmPalette()

    if (reports.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "No Pest & Disease Reports",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = palette.textPrimary
                )
                Text(
                    text = "Tap the + button to report infected trees, berry borers, or diseases with photo evidence.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.textSecondary
                )
                Button(
                    onClick = onNewReport,
                    colors = ButtonDefaults.buttonColors(containerColor = palette.accent, contentColor = palette.onAccent)
                ) {
                    Text("Report Pest / Disease", fontWeight = FontWeight.Bold)
                }
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(reports, key = { it.pestControlId.ifBlank { "${it.field}-${it.date}-${it.treeNumber}" } }) { report ->
            PestReportCard(report = report)
        }
    }
}

@Composable
private fun PestReportCard(report: PestControlRecord) {
    val palette = farmPalette()
    val isResolved = report.status.equals("Resolved", ignoreCase = true)
    val isTreatment = report.status.equals("Under Treatment", ignoreCase = true)

    val statusBg = when {
        isResolved -> Color(0xFF1B5E20)
        isTreatment -> Color(0xFFE65100)
        else -> Color(0xFFB71C1C)
    }
    val statusText = when {
        isResolved -> "Resolved"
        isTreatment -> "Under Treatment"
        else -> "Pending Review"
    }

    val photoBitmap = remember(report.photoBase64, report.photoUrl) {
        val src = report.photoBase64.ifBlank { report.photoUrl }
        if (src.isNotBlank()) base64ToBitmap(src) else null
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = palette.surfaceElevated),
        border = BorderStroke(1.dp, palette.border)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = report.issue.ifBlank { "Pest / Disease Issue" },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = palette.textPrimary,
                    modifier = Modifier.weight(1f)
                )

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = statusBg.copy(alpha = 0.25f),
                    border = BorderStroke(1.dp, statusBg)
                ) {
                    Text(
                        text = statusText,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = when {
                            isResolved -> Color(0xFF81C784)
                            isTreatment -> Color(0xFFFFB74D)
                            else -> Color(0xFFE57373)
                        }
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (photoBitmap != null) {
                    Image(
                        bitmap = photoBitmap.asImageBitmap(),
                        contentDescription = "Tree photo",
                        modifier = Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(10.dp)),
                        contentScale = ContentScale.Crop
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "${report.field} · ${if (report.treeNumber.isNotBlank()) report.treeNumber else "Tree #01"}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF81C784)
                    )
                    Text(
                        text = "Reported by ${report.reportedBy.ifBlank { "Worker" }} on ${report.date}",
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.textSecondary
                    )
                }
            }

            if (report.notes.isNotBlank()) {
                Text(
                    text = "Observations: ${report.notes}",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.textSecondary
                )
            }

            if (report.treatment.isNotBlank()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFF2E7D32).copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, Color(0xFF2E7D32).copy(alpha = 0.4f))
                ) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text(
                            text = "Admin Treatment Plan:",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF81C784)
                        )
                        Text(
                            text = report.treatment,
                            style = MaterialTheme.typography.bodySmall,
                            color = palette.textPrimary
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PestReportFormDialog(
    zoneOptions: List<String>,
    reporterName: String,
    onDismiss: () -> Unit,
    onSubmit: (field: String, treeNum: String, issue: String, notes: String, photoBase64: String) -> Unit
) {
    val context = LocalContext.current
    var selectedZone by remember { mutableStateOf(zoneOptions.firstOrNull() ?: "Section F") }
    var treeNumber by remember { mutableStateOf("") }
    var selectedPest by remember { mutableStateOf(PEST_OPTIONS[0]) }
    var customPest by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var photoBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var photoBase64 by remember { mutableStateOf("") }

    var zoneDropdownOpen by remember { mutableStateOf(false) }
    var pestDropdownOpen by remember { mutableStateOf(false) }

    val takePictureLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) {
            photoBitmap = bitmap
            photoBase64 = bitmapToBase64(bitmap)
        }
    }

    val pickImageLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            try {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    val bitmap = BitmapFactory.decodeStream(stream)
                    if (bitmap != null) {
                        photoBitmap = bitmap
                        photoBase64 = bitmapToBase64(bitmap)
                    }
                }
            } catch (_: Exception) {
                Toast.makeText(context, "Failed to load image", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Report Pest / Tree Disease",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                // Section Selector
                ExposedDropdownMenuBox(
                    expanded = zoneDropdownOpen,
                    onExpandedChange = { zoneDropdownOpen = !zoneDropdownOpen }
                ) {
                    OutlinedTextField(
                        value = selectedZone,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Farm Section / Block") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = zoneDropdownOpen) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = zoneDropdownOpen,
                        onDismissRequest = { zoneDropdownOpen = false }
                    ) {
                        zoneOptions.forEach { z ->
                            DropdownMenuItem(
                                text = { Text(z) },
                                onClick = {
                                    selectedZone = z
                                    zoneDropdownOpen = false
                                }
                            )
                        }
                    }
                }

                // Tree Number
                OutlinedTextField(
                    value = treeNumber,
                    onValueChange = { treeNumber = it },
                    label = { Text("Tree Identifier / Number (e.g. Tree #04)") },
                    placeholder = { Text("e.g. Tree #04") },
                    modifier = Modifier.fillMaxWidth()
                )

                // Pest Selection
                ExposedDropdownMenuBox(
                    expanded = pestDropdownOpen,
                    onExpandedChange = { pestDropdownOpen = !pestDropdownOpen }
                ) {
                    OutlinedTextField(
                        value = selectedPest,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Pest / Disease Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = pestDropdownOpen) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = pestDropdownOpen,
                        onDismissRequest = { pestDropdownOpen = false }
                    ) {
                        PEST_OPTIONS.forEach { p ->
                            DropdownMenuItem(
                                text = { Text(p) },
                                onClick = {
                                    selectedPest = p
                                    pestDropdownOpen = false
                                }
                            )
                        }
                    }
                }

                if (selectedPest == "Other / Unidentified Pest") {
                    OutlinedTextField(
                        value = customPest,
                        onValueChange = { customPest = it },
                        label = { Text("Specify Custom Pest Name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Photo Evidence Buttons & Preview
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Tree Photo Evidence",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold
                    )

                    if (photoBitmap != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(140.dp)
                                .clip(RoundedCornerShape(12.dp))
                        ) {
                            Image(
                                bitmap = photoBitmap!!.asImageBitmap(),
                                contentDescription = "Attached photo preview",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                            IconButton(
                                onClick = {
                                    photoBitmap = null
                                    photoBase64 = ""
                                },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(4.dp)
                                    .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(50))
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Remove photo", tint = Color.White)
                            }
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = { takePictureLauncher.launch(null) },
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Camera")
                            }
                            OutlinedButton(
                                onClick = { pickImageLauncher.launch("image/*") },
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Gallery")
                            }
                        }
                    }
                }

                // Notes
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Symptoms & Observations") },
                    placeholder = { Text("Describe observed damage, leaves condition...") },
                    minLines = 2,
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth()
                )

                // Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val finalIssue = if (selectedPest == "Other / Unidentified Pest" && customPest.isNotBlank()) customPest else selectedPest
                            val finalTreeNum = if (treeNumber.isNotBlank()) {
                                if (treeNumber.startsWith("#")) treeNumber else "Tree #$treeNumber"
                            } else "Tree #01"
                            onSubmit(selectedZone, finalTreeNum, finalIssue, notes, photoBase64)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935))
                    ) {
                        Text("Submit Report", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
