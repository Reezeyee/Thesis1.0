@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.melodypenero.coffeefarm.ui.screens

import com.melodypenero.coffeefarm.ml.RoboflowApiClient


import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.RectF
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FilterAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocalFlorist
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Sort
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.data.model.BoundingBoxDetection
import com.melodypenero.coffeefarm.data.model.BranchScanSummary
import com.melodypenero.coffeefarm.data.repository.FirebaseScanRepository
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.data.store.TreeRipenessScanRecord
import com.melodypenero.coffeefarm.data.store.isDeviceOnline
import com.melodypenero.coffeefarm.ml.BitmapExifUtils
import com.melodypenero.coffeefarm.ml.CoffeeSpeciesTfliteClassifier
import com.melodypenero.coffeefarm.ml.YoloTfliteDetector
import com.melodypenero.coffeefarm.ui.components.FarmTabRow
import com.melodypenero.coffeefarm.ui.components.farmPalette
import java.io.File
import java.time.LocalDate
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val CLASS_COLORS = mapOf(
    "Unripe" to Color(0xFF228B22),      // Forest Green
    "Ripening" to Color(0xFFFFBF00),    // Amber Yellow
    "Ripe" to Color(0xFFDC143C),        // Crimson Red
    "Overripe" to Color(0xFF8B4513),    // Saddle Brown
    "Dry_Damaged" to Color(0xFF2F4F4F)  // Dark Slate
)

@Composable
fun CoffeeCherryScreen(
    session: AuthSession,
    initialTab: String? = null,
    onInitialTabHandled: () -> Unit = {}
) {
    val store = LocalAppStore.current
    val context = LocalContext.current
    val state by store.appState
    val coroutineScope = rememberCoroutineScope()

    val validTabs = setOf("Scanner", "Saved Scans")
    fun resolveTab(t: String?): String = when {
        t in validTabs -> t!!
        t == "Recent" || t == "Sorting" -> "Saved Scans"
        else -> "Scanner"
    }

    val tabs = listOf("Scanner", "Saved Scans")
    var activeTab by remember { mutableStateOf(resolveTab(initialTab)) }

    LaunchedEffect(initialTab) {
        if (!initialTab.isNullOrBlank()) {
            activeTab = resolveTab(initialTab)
            onInitialTabHandled()
        }
    }

    val repository = remember { FirebaseScanRepository(context) }
    val palette = farmPalette()

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

            val availableSections = remember(state.coffeeFields, state.sections, state.trees) {
                val items = mutableListOf<FarmSectionOption>()
                
                // 1. Mapped coffee fields from farm map
                state.coffeeFields.forEach { f ->
                    val name = f.name.trim()
                    if (name.isNotBlank() && items.none { it.name.equals(name, ignoreCase = true) }) {
                        val detailsList = listOfNotNull(
                            f.variety.takeIf { it.isNotBlank() },
                            if (f.trees > 0) "${f.trees} trees" else null,
                            f.status.takeIf { it.isNotBlank() }
                        )
                        items.add(
                            FarmSectionOption(
                                name = name,
                                details = if (detailsList.isNotEmpty()) detailsList.joinToString(" · ") else "Active Field Section",
                                treeCount = f.trees
                            )
                        )
                    }
                }
                
                // 2. General farm sections
                state.sections.forEach { s ->
                    val name = s.name.trim()
                    if (name.isNotBlank() && items.none { it.name.equals(name, ignoreCase = true) }) {
                        items.add(
                            FarmSectionOption(
                                name = name,
                                details = s.details.trim().ifBlank { "Farm Block Section" }
                            )
                        )
                    }
                }
                
                // 3. Mapped trees
                state.trees.forEach { t ->
                    val name = t.sectionName.trim()
                    if (name.isNotBlank() && items.none { it.name.equals(name, ignoreCase = true) }) {
                        val count = state.trees.count { it.sectionName.trim().equals(name, ignoreCase = true) }
                        items.add(
                            FarmSectionOption(
                                name = name,
                                details = "$count trees mapped",
                                treeCount = count
                            )
                        )
                    }
                }
                
                if (items.isEmpty()) {
                    listOf(
                        FarmSectionOption("Section A", "North Plot · Arabica"),
                        FarmSectionOption("Section B", "East Slope · Robusta"),
                        FarmSectionOption("Section C", "South Ridge · Liberica"),
                        FarmSectionOption("Section D", "West Terrace · Excelsa")
                    )
                } else {
                    items
                }
            }

            when (activeTab) {
                "Scanner" -> PremiumCherryScannerTab(
                    availableSections = availableSections,
                    onSaveScan = { summary, bitmap, section ->
                        val generatedBatchId = nextBatchId(
                            state.cherryGrades.mapNotNull { it.batchId?.trim() }
                        )

                        store.addTreeRipenessScanWithCherryGrade(
                            TreeRipenessScanRecord(
                                treeId = "branch_scan",
                                ripenessLabel = summary.harvestStatus,
                                timestampMillis = summary.timestamp,
                                sourceGrade = summary.harvestStatus
                            ),
                            batchId = generatedBatchId,
                            grade = summary.harvestStatus,
                            confidence = "%.1f%%".format(summary.ripePercentage),
                            species = summary.detectedSpecies,
                            speciesConfidence = summary.speciesConfidence,
                            location = section,
                            scannedByWorkerName = session.displayName,
                            scannedByEmail = session.email,
                            scannedByAuthUid = session.userId
                        )

                        // Also push to Firebase repository in background
                        coroutineScope.launch(Dispatchers.IO) {
                            repository.saveBranchScan(
                                summary = summary,
                                bitmap = bitmap,
                                userId = session.userId,
                                batchId = generatedBatchId,
                                location = section
                            )
                        }
                    }
                )

                "Saved Scans" -> SavedScansTab(
                    records = state.cherryGrades.sortedByDescending { it.savedAtMillis ?: 0L },
                    onDeleteRecord = { gradeRecord ->
                        store.deleteCherryGradeByKey(store.stableKeyForCherryGrade(gradeRecord))
                    }
                )
            }
        }
    }
}

data class FarmSectionOption(
    val name: String,
    val details: String = "",
    val treeCount: Int = 0
)

@Composable
private fun PremiumCherryScannerTab(
    availableSections: List<FarmSectionOption>,
    onSaveScan: (summary: BranchScanSummary, bitmap: Bitmap, section: String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mainExecutor = androidx.core.content.ContextCompat.getMainExecutor(context)

    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var selectedImageUri by remember { mutableStateOf<String?>(null) }
    var selectedSection by remember { mutableStateOf(availableSections.firstOrNull()?.name ?: "Section A") }
    var showSectionDialog by remember { mutableStateOf(false) }

    var inferenceRunning by remember { mutableStateOf(false) }
    var scanResult by remember { mutableStateOf<BranchScanSummary?>(null) }
    var showResultSheet by remember { mutableStateOf(false) }
    var showNoCherryDialog by remember { mutableStateOf(false) }

    val detector = remember { YoloTfliteDetector(context) }
    val speciesClassifier = remember { CoffeeSpeciesTfliteClassifier(context) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val imageCapture = remember { ImageCapture.Builder().build() }

    var hasCameraPermission by remember {
        mutableStateOf(
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.CAMERA
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasCameraPermission = granted }

    val galleryPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            selectedImageUri = uri.toString()
            capturedBitmap = null
            scanResult = null
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
            detector.close()
        }
    }

    // Process Gallery Photo Selection
    LaunchedEffect(selectedImageUri) {
        val uriStr = selectedImageUri ?: return@LaunchedEffect
        inferenceRunning = true
        val bmp = withContext(Dispatchers.IO) {
            BitmapExifUtils.loadBitmapWithOrientation(context, Uri.parse(uriStr))
        }
        if (bmp != null) {
            capturedBitmap = bmp
            selectedImageUri = null
            val (yoloRes, speciesPred) = withContext(Dispatchers.Default) {
                val localRes = detector.detect(bmp)
                val detectionResult = if (localRes.isSuccess && (localRes.getOrNull()?.totalCount ?: 0) > 0) {
                    localRes
                } else {
                    val cloudRes = RoboflowApiClient.detect(bmp)
                    if (cloudRes.isSuccess && (cloudRes.getOrNull()?.totalCount ?: 0) > 0) {
                        cloudRes
                    } else {
                        localRes
                    }
                }
                val spec = speciesClassifier.classify(bmp).getOrNull()
                detectionResult to spec
            }

            yoloRes.fold(
                onSuccess = { summary ->
                    val speciesName = speciesPred?.speciesDisplay ?: "Undetermined"
                    val speciesConf = speciesPred?.confidenceText ?: "0.0%"
                    val finalSummary = summary.copy(
                        detectedSpecies = speciesName,
                        speciesConfidence = speciesConf
                    )
                    scanResult = finalSummary
                    if (finalSummary.totalCount > 0) {
                        showResultSheet = true
                    } else {
                        showNoCherryDialog = true
                    }
                },
                onFailure = {
                    showNoCherryDialog = true
                }
            )
        }
        inferenceRunning = false
    }

    // Scanning Animation Transition
    val infiniteTransition = rememberInfiniteTransition(label = "laser_sweep")
    val laserPosition by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "laser_pos"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {

        // Top Control: Active Farm Section Picker
        Surface(
            color = Color(0xFF1E1611),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, Color(0xFF4A382C)),
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showSectionDialog = true }
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .background(Color(0xFF2C2017), CircleShape)
                            .border(1.dp, Color(0xFFD4AF37).copy(alpha = 0.6f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = Color(0xFFD4AF37),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Active Farm Section",
                            color = Color(0xFFB8A99E),
                            style = MaterialTheme.typography.labelSmall,
                            fontSize = 11.sp
                        )
                        Text(
                            text = selectedSection.ifBlank { "Tap to select Farm Section" },
                            color = Color(0xFFF4EDE6),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = Color(0xFF8F8177)
                )
            }
        }

        // Premium Camera / Scanner Frame
        Surface(
            color = Color(0xFF120D0A),
            shape = RoundedCornerShape(24.dp),
            border = BorderStroke(2.dp, if (inferenceRunning) Color(0xFF84B626) else Color(0xFF3E2D22)),
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                val currentBmp = capturedBitmap

                if (currentBmp != null) {
                    // Display Captured / Selected Image
                    Image(
                        bitmap = currentBmp.asImageBitmap(),
                        contentDescription = "Scanned Branch Photo",
                        modifier = Modifier.fillMaxSize()
                    )
                } else if (hasCameraPermission) {
                    // Live Camera Preview
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { viewContext ->
                            PreviewView(viewContext).apply {
                                scaleType = PreviewView.ScaleType.FILL_CENTER
                            }
                        },
                        update = { previewView ->
                            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
                            cameraProviderFuture.addListener({
                                val cameraProvider = cameraProviderFuture.get()
                                val preview = Preview.Builder().build().also {
                                    it.setSurfaceProvider(previewView.surfaceProvider)
                                }
                                try {
                                    cameraProvider.unbindAll()
                                    cameraProvider.bindToLifecycle(
                                        lifecycleOwner,
                                        CameraSelector.DEFAULT_BACK_CAMERA,
                                        preview,
                                        imageCapture
                                    )
                                } catch (_: Exception) {}
                            }, mainExecutor)
                        }
                    )
                } else {
                    // Permission Request Prompt
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null, tint = Color(0xFF84B626), modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("Camera Permission Required", color = Color(0xFFF4EDE6), style = MaterialTheme.typography.titleMedium)
                        Text("Grant permission to scan coffee cherry branches in real-time.", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { permissionLauncher.launch(android.Manifest.permission.CAMERA) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF84B626))
                        ) {
                            Text("Enable Camera")
                        }
                    }
                }

                // Overlay Camera Target Reticle / Gold Brackets
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp)
                        .border(1.5.dp, Color(0xFFC8963E), RoundedCornerShape(16.dp))
                )

                // Gold Laser Scanning Line & Progress Overlay (Skippable via tap)
                if (inferenceRunning) {
                    Canvas(
                        modifier = Modifier
                            .fillMaxSize()
                            .clickable { showResultSheet = true }
                    ) {
                        val y = size.height * laserPosition
                        // Soft gold glow trail
                        drawRect(
                            brush = Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color(0x66C8963E), Color(0xFFC8963E), Color.Transparent),
                                startY = (y - 40f).coerceAtLeast(0f),
                                endY = (y + 10f).coerceAtMost(size.height)
                            )
                        )
                        // Laser line
                        drawLine(
                            brush = Brush.horizontalGradient(
                                colors = listOf(Color.Transparent, Color(0xFFD4AF37), Color.White, Color(0xFFD4AF37), Color.Transparent)
                            ),
                            start = Offset(0f, y),
                            end = Offset(size.width, y),
                            strokeWidth = 6f
                        )
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0x66000000))
                            .clickable {
                                inferenceRunning = false
                                if (scanResult != null) showResultSheet = true
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = Color(0xFFC8963E), strokeWidth = 3.dp)
                            Spacer(Modifier.height(12.dp))
                            Text("Analyzing Coffee Cherry Branch…", color = Color(0xFFF4EDE6), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text("Tap anywhere to skip animation", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
        }

        // Action Buttons Row (Capture vs Gallery)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = {
                    if (!hasCameraPermission) {
                        permissionLauncher.launch(android.Manifest.permission.CAMERA)
                        return@Button
                    }
                    val output = File.createTempFile("branch-scan", ".jpg", context.cacheDir)
                    val options = ImageCapture.OutputFileOptions.Builder(output).build()
                    imageCapture.takePicture(
                        options,
                        cameraExecutor,
                        object : ImageCapture.OnImageSavedCallback {
                            override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                                val bmp = BitmapExifUtils.loadBitmapWithOrientationFromFile(output.absolutePath)
                                    ?: BitmapFactory.decodeFile(output.absolutePath)
                                output.delete()
                                if (bmp != null) {
                                    mainExecutor.execute {
                                        capturedBitmap = bmp
                                        selectedImageUri = null
                                        inferenceRunning = true
                                    }
                                    cameraExecutor.execute {
                                        val localRes = detector.detect(bmp)
                                        val res = if (localRes.isSuccess && (localRes.getOrNull()?.totalCount ?: 0) > 0) {
                                            localRes
                                        } else {
                                            val cloudRes = RoboflowApiClient.detect(bmp)
                                            if (cloudRes.isSuccess && (cloudRes.getOrNull()?.totalCount ?: 0) > 0) {
                                                cloudRes
                                            } else {
                                                localRes
                                            }
                                        }
                                        val speciesPred = speciesClassifier.classify(bmp).getOrNull()

                                        mainExecutor.execute {
                                            inferenceRunning = false
                                            res.fold(
                                                onSuccess = { summary ->
                                                    val speciesName = speciesPred?.speciesDisplay ?: "Undetermined"
                                                    val speciesConf = speciesPred?.confidenceText ?: "0.0%"
                                                    val finalSummary = summary.copy(
                                                        detectedSpecies = speciesName,
                                                        speciesConfidence = speciesConf
                                                    )
                                                    scanResult = finalSummary
                                                    if (finalSummary.totalCount > 0) {
                                                        showResultSheet = true
                                                    } else {
                                                        showNoCherryDialog = true
                                                    }
                                                },
                                                onFailure = { showNoCherryDialog = true }
                                            )
                                        }
                                    }
                                }
                            }
                            override fun onError(exception: ImageCaptureException) {
                                mainExecutor.execute {
                                    Toast.makeText(context, "Photo capture failed.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    )
                },
                enabled = !inferenceRunning,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E8B3C)),
                shape = CircleShape,
                modifier = Modifier
                    .weight(1f)
                    .height(54.dp)
            ) {
                Icon(Icons.Default.CameraAlt, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Scan Camera", fontWeight = FontWeight.Bold)
            }

            Button(
                onClick = { galleryPicker.launch("image/*") },
                enabled = !inferenceRunning,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3E2D22)),
                shape = CircleShape,
                modifier = Modifier
                    .weight(1f)
                    .height(54.dp)
            ) {
                Icon(Icons.Default.PhotoLibrary, contentDescription = null, tint = Color(0xFFF4EDE6))
                Spacer(Modifier.width(8.dp))
                Text("Select Gallery", color = Color(0xFFF4EDE6), fontWeight = FontWeight.Bold)
            }
        }
    }

    // POP-OUT SCAN RESULTS BOTTOM SHEET
    if (showResultSheet && scanResult != null && capturedBitmap != null) {
        ModalBottomSheet(
            onDismissRequest = { showResultSheet = false },
            containerColor = Color(0xFF1A1410),
            contentColor = Color(0xFFF4EDE6)
        ) {
            BranchScanResultSheet(
                summary = scanResult!!,
                bitmap = capturedBitmap!!,
                section = selectedSection,
                onSave = {
                    onSaveScan(scanResult!!, capturedBitmap!!, selectedSection)
                    showResultSheet = false
                    Toast.makeText(context, "Scan result saved for $selectedSection!", Toast.LENGTH_SHORT).show()
                },
                onDismiss = { showResultSheet = false }
            )
        }
    }

    // POP-OUT "COFFEE CHERRY NOT VISIBLE" DIALOG
    if (showNoCherryDialog) {
        CherryNotVisibleDialog(onDismiss = { showNoCherryDialog = false })
    }

    // FARM SECTION PICKER DIALOG
    if (showSectionDialog) {
        SectionPickerDialog(
            currentSection = selectedSection,
            availableSections = availableSections,
            onDismiss = { showSectionDialog = false },
            onConfirm = { chosen ->
                selectedSection = chosen.ifBlank { "Section A" }
                showSectionDialog = false
            }
        )
    }
}

@Composable
private fun SectionPickerDialog(
    currentSection: String,
    availableSections: List<FarmSectionOption>,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var tempSection by remember { mutableStateOf(currentSection) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF241A14),
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color(0xFFD4AF37), modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(8.dp))
                Text("Select Farm Section", color = Color(0xFFF4EDE6), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Choose the accurate farm section or map sector for this coffee scan:",
                    color = Color(0xFFB8A99E),
                    style = MaterialTheme.typography.bodySmall
                )

                OutlinedTextField(
                    value = tempSection,
                    onValueChange = { tempSection = it },
                    label = { Text("Selected Farm Section") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF84B626),
                        unfocusedBorderColor = Color(0xFF4A382C),
                        focusedTextColor = Color(0xFFF4EDE6),
                        unfocusedTextColor = Color(0xFFF4EDE6)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = "Mapped Farm Sections (${availableSections.size}):",
                    color = Color(0xFFD4AF37),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold
                )

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(availableSections) { sec ->
                        val isSelected = tempSection.trim().equals(sec.name.trim(), ignoreCase = true)
                        Surface(
                            color = if (isSelected) Color(0xFF84B626).copy(alpha = 0.25f) else Color(0xFF1E1611),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(
                                1.dp,
                                if (isSelected) Color(0xFF84B626) else Color(0xFF3E2D22)
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { tempSection = sec.name }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    modifier = Modifier.weight(1f),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .background(if (isSelected) Color(0xFF84B626).copy(alpha = 0.3f) else Color(0xFF2C2017), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Place,
                                            contentDescription = null,
                                            tint = if (isSelected) Color(0xFF84B626) else Color(0xFFD4AF37),
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                    Spacer(Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = sec.name,
                                            color = if (isSelected) Color(0xFF84B626) else Color(0xFFF4EDE6),
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold
                                        )
                                        if (sec.details.isNotBlank()) {
                                            Text(
                                                text = sec.details,
                                                color = Color(0xFF9E8E81),
                                                style = MaterialTheme.typography.labelSmall,
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }
                                if (isSelected) {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = Color(0xFF84B626),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(tempSection.trim()) },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF84B626))
            ) {
                Text("Confirm Section", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Color(0xFFB8A99E))
            }
        }
    )
}

@Composable
private fun BranchScanResultSheet(
    summary: BranchScanSummary,
    bitmap: Bitmap,
    section: String,
    onSave: () -> Unit,
    onDismiss: () -> Unit
) {
    // Count-up animatable for ripe ratio
    val animatedRipePct = remember { androidx.compose.animation.core.Animatable(0f) }
    val animatedCherryCount = remember { androidx.compose.animation.core.Animatable(0f) }
    LaunchedEffect(summary) {
        animatedRipePct.animateTo(summary.ripePercentage, tween(800, easing = FastOutSlowInEasing))
        animatedCherryCount.animateTo(summary.totalCount.toFloat(), tween(800, easing = FastOutSlowInEasing))
    }

    val lowConfidenceCount = remember(summary) {
        summary.detections.count { it.uncertain || it.confidence < 0.40f }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(20.dp)
            .navigationBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header Row with Gold AI Badge & Accurate Section Name
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f, fill = false)) {
                Text("Cherry Detection Complete", color = Color(0xFFD4AF37), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Section: $section · ${animatedCherryCount.value.toInt()} Cherries Found", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall)
            }

            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFFB8A99E))
            }
        }

        // Bounding Box Rendered Image Canvas (Proper Aspect-Ratio Scaling)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(230.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF0D0907))
                .border(1.dp, Color(0xFF4A382C), RoundedCornerShape(16.dp))
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val imgW = bitmap.width.toFloat()
                val imgH = bitmap.height.toFloat()
                if (imgW <= 0 || imgH <= 0) return@Canvas

                val imageAspect = imgW / imgH
                val viewAspect = size.width / size.height

                val drawW: Float
                val drawH: Float
                val offX: Float
                val offY: Float

                if (imageAspect > viewAspect) {
                    drawW = size.width
                    drawH = size.width / imageAspect
                    offX = 0f
                    offY = (size.height - drawH) / 2f
                } else {
                    drawH = size.height
                    drawW = size.height * imageAspect
                    offX = (size.width - drawW) / 2f
                    offY = 0f
                }

                val scale = drawW / imgW

                // Draw background bitmap fitted with true proportions
                drawImage(
                    image = bitmap.asImageBitmap(),
                    dstOffset = androidx.compose.ui.unit.IntOffset(offX.toInt(), offY.toInt()),
                    dstSize = androidx.compose.ui.unit.IntSize(drawW.toInt(), drawH.toInt())
                )

                // Draw bounding boxes mapped accurately
                summary.detections.forEach { det ->
                    val color = CLASS_COLORS[det.className] ?: Color.Red
                    val rect = det.rect
                    val left = offX + rect.left * scale
                    val top = offY + rect.top * scale
                    val right = offX + rect.right * scale
                    val bottom = offY + rect.bottom * scale

                    drawRect(
                        color = color,
                        topLeft = Offset(left, top),
                        size = Size((right - left).coerceAtLeast(0f), (bottom - top).coerceAtLeast(0f)),
                        style = Stroke(width = 4f)
                    )
                }
            }
        }

        // Low Confidence Review Banner (if any)
        if (lowConfidenceCount > 0) {
            Surface(
                color = Color(0xFF3E2D12),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, Color(0xFFC8963E)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFD4AF37), modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "$lowConfidenceCount detection(s) have lower confidence (<40%) — inspect branch before harvesting.",
                        color = Color(0xFFF4EDE6),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }

        // Unified AI Diagnostic & Assessment Card (Merged Species + Ripeness)
        val cardAccentColor = when {
            summary.ripePercentage >= 75.0f -> Color(0xFF4CAF50)
            summary.ripePercentage >= 40.0f -> Color(0xFFFFB300)
            else -> Color(0xFFE57373)
        }

        Surface(
            color = Color(0xFF1C1510),
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.5.dp, cardAccentColor.copy(alpha = 0.8f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Top Row: Botanical Species & Model Confidence
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        modifier = Modifier.weight(1f, fill = false),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .background(Color(0xFF2C2017), CircleShape)
                                .border(1.dp, Color(0xFFD4AF37), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalFlorist,
                                contentDescription = null,
                                tint = Color(0xFFD4AF37),
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "COFFEE SPECIES (CNN)",
                                color = Color(0xFF9E8E81),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp
                            )
                            Text(
                                text = summary.detectedSpecies,
                                color = Color(0xFFF4EDE6),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Spacer(Modifier.width(8.dp))

                    Surface(
                        color = Color(0xFF261D15),
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, Color(0xFFD4AF37).copy(alpha = 0.5f))
                    ) {
                        Text(
                            text = "Conf: ${summary.speciesConfidence}",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = Color(0xFFD4AF37),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                }

                HorizontalDivider(color = Color(0xFF382A20), thickness = 1.dp)

                // Ripeness & Harvest Status Section
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            modifier = Modifier.weight(1f, fill = false),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .background(cardAccentColor, CircleShape)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = summary.harvestStatus,
                                color = Color(0xFFF4EDE6),
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Spacer(Modifier.width(10.dp))

                        // Dedicated Non-Wrapping Ripe % Chip
                        Surface(
                            color = cardAccentColor.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, cardAccentColor.copy(alpha = 0.6f))
                        ) {
                            Text(
                                text = "%.1f%% Ripe".format(animatedRipePct.value),
                                color = cardAccentColor,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }

                    // Ripeness Progress Bar
                    LinearProgressIndicator(
                        progress = { (animatedRipePct.value / 100f).coerceIn(0f, 1f) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = cardAccentColor,
                        trackColor = Color(0xFF2C2017)
                    )
                }

                // Summary Metric Badges (Total, Ripe, Developing)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val ripeCount = summary.classCounts["Ripe"] ?: 0
                    val nonRipeCount = summary.totalCount - ripeCount

                    MetricPill(
                        modifier = Modifier.weight(1f),
                        label = "Total",
                        value = "${summary.totalCount}",
                        tint = Color(0xFFF4EDE6)
                    )
                    MetricPill(
                        modifier = Modifier.weight(1f),
                        label = "Ripe",
                        value = "$ripeCount",
                        tint = Color(0xFF4CAF50)
                    )
                    MetricPill(
                        modifier = Modifier.weight(1f),
                        label = "Unripe / Other",
                        value = "$nonRipeCount",
                        tint = Color(0xFFFFB300)
                    )
                }
            }
        }

        // Class Breakdown Pills
        Text("Cherries Found on Branch:", color = Color(0xFFF4EDE6), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(summary.classCounts.toList()) { (clsName, count) ->
                val color = CLASS_COLORS[clsName] ?: Color.Gray
                Surface(
                    color = color.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(20.dp),
                    border = BorderStroke(1.dp, color)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.size(10.dp).background(color, CircleShape))
                        Spacer(Modifier.width(6.dp))
                        Text("$clsName: $count", color = Color(0xFFF4EDE6), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Save Button
        Button(
            onClick = onSave,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E8B3C)),
            shape = CircleShape,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Icon(Icons.Default.CheckCircle, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Save Scan Result", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun MetricPill(
    label: String,
    value: String,
    tint: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color(0xFF241A14),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Color(0xFF3E2D22)),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = label,
                color = Color(0xFF9E8E81),
                style = MaterialTheme.typography.labelSmall,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = value,
                color = tint,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 1
            )
        }
    }
}


@Composable
private fun CherryNotVisibleDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF2D211A),
        icon = {
            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFFF7A70), modifier = Modifier.size(40.dp))
        },
        title = {
            Text("Coffee Cherry Not Detected", color = Color(0xFFF4EDE6), fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        },
        text = {
            Text(
                "No coffee cherries were detected in this image.\n\nPlease position the coffee branch clearly inside the frame under good lighting and try again.",
                color = Color(0xFFB8A99E),
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center
            )
        },

        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF84B626)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Got It & Try Again")
            }
        }
    )
}

@Composable
private fun SavedScansTab(
    records: List<com.melodypenero.coffeefarm.data.store.CherryGradeRecord>,
    onDeleteRecord: (record: com.melodypenero.coffeefarm.data.store.CherryGradeRecord) -> Unit
) {
    var sortOption by remember { mutableStateOf("Newest First") }

    val sortedRecords = remember(records, sortOption) {
        when (sortOption) {
            "Oldest First" -> records.sortedBy { it.savedAtMillis ?: 0L }
            "Highest Ripe %" -> records.sortedByDescending { (it.confidence ?: "").filter { c -> c.isDigit() || c == '.' }.toDoubleOrNull() ?: 0.0 }
            else -> records.sortedByDescending { it.savedAtMillis ?: 0L }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Sort Filter Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Saved Scan Results (${sortedRecords.size})", color = Color(0xFFF4EDE6), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("Newest First", "Highest Ripe %").forEach { opt ->
                    val isSel = sortOption == opt
                    Surface(
                        color = if (isSel) Color(0xFF84B626) else Color(0xFF2D211A),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.clickable { sortOption = opt }
                    ) {
                        Text(
                            text = opt,
                            color = if (isSel) Color.White else Color(0xFFB8A99E),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        }

        if (sortedRecords.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.FilterAlt, contentDescription = null, tint = Color(0xFF5A463A), modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("No saved scan results yet", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodyMedium)
                }
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(sortedRecords, key = { it.savedAtMillis ?: 0L }) { r ->
                    Surface(
                        color = Color(0xFF241A14),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, Color(0xFF4A382C)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Place,
                                            contentDescription = null,
                                            tint = Color(0xFFD4AF37),
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = r.location?.ifBlank { null } ?: "Farm Section",
                                            color = Color(0xFFF4EDE6),
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    val speciesInfo = if (!r.species.isNullOrBlank() && r.species != "Undetermined") {
                                        "Species: ${r.species} (${r.speciesConfidence ?: "CNN"})"
                                    } else {
                                        "Species: ${r.species ?: "Unidentified"}"
                                    }
                                    Text(speciesInfo, color = Color(0xFFD4AF37), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                                    Text("Ripeness: ${r.confidence ?: "0.0%"}", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(r.grade ?: "Graded", color = Color(0xFF84B626), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                    IconButton(onClick = { onDeleteRecord(r) }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFFF7A70), modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun nextBatchId(existingBatchIds: List<String>): String {
    val year = LocalDate.now().year
    val prefix = "B-$year-"
    val maxForYear = existingBatchIds
        .map { it.trim() }
        .mapNotNull { extractBatchSequence(it, prefix) }
        .maxOrNull() ?: 0
    return prefix + (maxForYear + 1).toString().padStart(3, '0')
}

private fun extractBatchSequence(batchId: String, prefix: String): Int? {
    val trimmed = batchId.trim()
    if (!trimmed.startsWith(prefix, ignoreCase = false)) return null
    return trimmed.removePrefix(prefix).trimStart().toIntOrNull()
}
