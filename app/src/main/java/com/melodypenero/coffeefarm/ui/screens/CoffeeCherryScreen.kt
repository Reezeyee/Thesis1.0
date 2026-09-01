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
import androidx.compose.material.icons.filled.PhotoLibrary
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

            when (activeTab) {
                "Scanner" -> PremiumCherryScannerTab(
                    suggestedBatchId = nextBatchId(
                        state.cherryGrades.mapNotNull { it.batchId?.trim() }
                    ),
                    onSaveScan = { summary, bitmap, batchId ->
                        store.addTreeRipenessScanWithCherryGrade(
                            TreeRipenessScanRecord(
                                treeId = "branch_scan",
                                ripenessLabel = summary.harvestStatus,
                                timestampMillis = summary.timestamp,
                                sourceGrade = summary.harvestStatus
                            ),
                            batchId = batchId,
                            grade = summary.harvestStatus,
                            confidence = "%.1f%%".format(summary.ripePercentage),
                            species = "Arabica",
                            speciesConfidence = "High",
                            scannedByWorkerName = session.displayName,
                            scannedByEmail = session.email,
                            scannedByAuthUid = session.userId
                        )

                        // Also push to Firebase repository in background
                        coroutineScope.launch(Dispatchers.IO) {
                            repository.saveBranchScan(summary, bitmap, session.userId)
                        }
                    }
                )

                "Saved Scans" -> SavedScansTab(
                    records = state.cherryGrades.sortedByDescending { it.savedAtMillis ?: 0L },
                    onDeleteRecord = { gradeKey ->
                        store.deleteCherryGradeByKey(gradeKey)
                    }
                )
            }
        }
    }
}

@Composable
private fun PremiumCherryScannerTab(
    suggestedBatchId: String,
    onSaveScan: (summary: BranchScanSummary, bitmap: Bitmap, batchId: String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mainExecutor = androidx.core.content.ContextCompat.getMainExecutor(context)

    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var selectedImageUri by remember { mutableStateOf<String?>(null) }
    var batchId by remember { mutableStateOf(suggestedBatchId) }
    var showBatchDialog by remember { mutableStateOf(false) }

    var inferenceRunning by remember { mutableStateOf(false) }
    var scanResult by remember { mutableStateOf<BranchScanSummary?>(null) }
    var showResultSheet by remember { mutableStateOf(false) }
    var showNoCherryDialog by remember { mutableStateOf(false) }

    val detector = remember { YoloTfliteDetector(context) }
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
            val res = withContext(Dispatchers.Default) {
                val cloudRes = RoboflowApiClient.detect(bmp)
                if (cloudRes.isSuccess && (cloudRes.getOrNull()?.totalCount ?: 0) > 0) {
                    cloudRes
                } else {
                    val errMsg = cloudRes.exceptionOrNull()?.message ?: ""
                    if (errMsg.contains("Training Pending")) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(context, errMsg, Toast.LENGTH_LONG).show()
                        }
                    }
                    detector.detect(bmp)
                }
            }


            res.fold(
                onSuccess = { summary ->
                    scanResult = summary
                    if (summary.totalCount > 0) {
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
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {

        // Top Control Card (Batch ID)
        Surface(
            color = Color(0xFF1E1611),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, Color(0xFF4A382C)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { showBatchDialog = true }
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.LocalFlorist,
                        contentDescription = null,
                        tint = Color(0xFF84B626),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text("Active Batch / Lot ID", color = Color(0xFFB8A99E), style = MaterialTheme.typography.labelSmall)
                        Text(batchId.ifBlank { "Tap to assign Batch ID" }, color = Color(0xFFF4EDE6), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                }
                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF8F8177))
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
                                        val cloudRes = RoboflowApiClient.detect(bmp)
                                        val res = if (cloudRes.isSuccess && (cloudRes.getOrNull()?.totalCount ?: 0) > 0) {
                                            cloudRes
                                        } else {
                                            detector.detect(bmp)
                                        }
                                        mainExecutor.execute {

                                            inferenceRunning = false
                                            res.fold(
                                                onSuccess = { summary ->
                                                    scanResult = summary
                                                    if (summary.totalCount > 0) {
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
                batchId = batchId,
                onSave = {
                    onSaveScan(scanResult!!, capturedBitmap!!, batchId)
                    showResultSheet = false
                    Toast.makeText(context, "Scan result saved under $batchId!", Toast.LENGTH_SHORT).show()
                },
                onDismiss = { showResultSheet = false }
            )
        }
    }

    // POP-OUT "COFFEE CHERRY NOT VISIBLE" DIALOG
    if (showNoCherryDialog) {
        CherryNotVisibleDialog(onDismiss = { showNoCherryDialog = false })
    }

    // BATCH ID SETTING DIALOG
    if (showBatchDialog) {
        AlertDialog(
            onDismissRequest = { showBatchDialog = false },
            containerColor = Color(0xFF2D211A),
            title = { Text("Set Batch ID", color = Color(0xFFF4EDE6), fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = batchId,
                    onValueChange = { batchId = it },
                    label = { Text("Batch ID") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF84B626),
                        unfocusedBorderColor = Color(0xFF4A382C),
                        focusedTextColor = Color(0xFFF4EDE6),
                        unfocusedTextColor = Color(0xFFF4EDE6)
                    )
                )
            },
            confirmButton = {
                TextButton(onClick = { showBatchDialog = false }) {
                    Text("Save", color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
                }
            }
        )
    }
}

@Composable
private fun BranchScanResultSheet(
    summary: BranchScanSummary,
    bitmap: Bitmap,
    batchId: String,
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
        // Header Row with Gold AI Badge
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Cherry Detection Complete", color = Color(0xFFD4AF37), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Batch: $batchId · ${animatedCherryCount.value.toInt()} Cherries Found", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall)
            }

            IconButton(onClick = onDismiss) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFFB8A99E))
            }
        }

        // Bounding Box Rendered Image Canvas
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(230.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color.Black)
                .border(1.dp, Color(0xFF4A382C), RoundedCornerShape(16.dp))
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val scaleX = size.width / bitmap.width.toFloat()
                val scaleY = size.height / bitmap.height.toFloat()

                // Draw bitmap background
                drawImage(bitmap.asImageBitmap(), dstSize = androidx.compose.ui.unit.IntSize(size.width.toInt(), size.height.toInt()))

                // Draw bounding boxes
                summary.detections.forEach { det ->
                    val color = CLASS_COLORS[det.className] ?: Color.Red
                    val rect = det.rect
                    val left = rect.left * scaleX
                    val top = rect.top * scaleY
                    val right = rect.right * scaleX
                    val bottom = rect.bottom * scaleY

                    drawRect(
                        color = color,
                        topLeft = Offset(left, top),
                        size = Size(right - left, bottom - top),
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

        // Harvest Recommendation Status Card
        Surface(
            color = when {
                summary.ripePercentage >= 75.0f -> Color(0xFF1E3A1E)
                summary.ripePercentage >= 40.0f -> Color(0xFF3D3210)
                else -> Color(0xFF3E1E1E)
            },
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Color(0xFF84B626)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text("HARVEST RECOMMENDATION", color = Color(0xFFB8A99E), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                Text(summary.harvestStatus, color = Color(0xFFF4EDE6), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Ripe Cherry Ratio: %.1f%%".format(animatedRipePct.value), color = Color(0xFF84B626), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
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
    onDeleteRecord: (gradeKey: String) -> Unit
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
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(r.batchId ?: "General Scan", color = Color(0xFFF4EDE6), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                    Text("Ripe Ratio / Confidence: ${r.confidence}", color = Color(0xFFB8A99E), style = MaterialTheme.typography.bodySmall)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(r.grade ?: "Graded", color = Color(0xFF84B626), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                                    IconButton(onClick = { onDeleteRecord(r.batchId ?: "") }) {
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
