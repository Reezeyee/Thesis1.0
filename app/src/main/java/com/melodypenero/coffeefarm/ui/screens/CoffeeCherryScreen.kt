@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.melodypenero.coffeefarm.ui.screens

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.Toast
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.FilterAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.LocalFlorist
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.melodypenero.coffeefarm.auth.LocalUserRole
import com.melodypenero.coffeefarm.auth.UserRole
import com.melodypenero.coffeefarm.data.store.LocalAppStore
import com.melodypenero.coffeefarm.data.store.TreeRecord
import com.melodypenero.coffeefarm.data.store.TreeRipenessScanRecord
import com.melodypenero.coffeefarm.data.store.isDeviceOnline
import com.melodypenero.coffeefarm.domain.TreeRipeness
import com.melodypenero.coffeefarm.ml.BitmapExifUtils
import com.melodypenero.coffeefarm.ml.CherryGradeTfliteClassifier
import com.melodypenero.coffeefarm.ml.CoffeeSpeciesTfliteClassifier
import java.io.File
import java.time.LocalDate
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Loading captions while Capture CNNs run (cherry check → ripeness + species). */
private object CaptureScanStages {
    const val LOADING_PHOTO = "Loading photo…"
    const val CHECK_COFFEE_CHERRY = "Checking whether this looks like coffee cherries…"
    const val ANALYZE_RIPENESS_AND_LEAF = "Analyzing ripeness and leaf cues…"
}

@Composable
fun CoffeeCherryScreen(
    initialTab: String? = null,
    onInitialTabHandled: () -> Unit = {}
) {
    val store = LocalAppStore.current
    val context = LocalContext.current
    val isAdmin = LocalUserRole.current == UserRole.ADMINISTRATOR
    val state by store.appState
    val validCherryTabs = setOf("Trees", "Harvest", "Batches", "Sorting", "Capture")
    fun resolveCherryTab(t: String?): String = when {
        t.isNullOrBlank() -> "Trees"
        t == "Flowering" -> "Trees"
        t in validCherryTabs -> t
        else -> "Trees"
    }
    val tabs = listOf("Trees", "Harvest", "Batches", "Sorting", "Capture")
    var activeTab by remember { mutableStateOf(resolveCherryTab(initialTab)) }
    var showAddDialog by remember { mutableStateOf(false) }
    var editingIndex by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(initialTab) {
        if (!initialTab.isNullOrBlank()) {
            activeTab = resolveCherryTab(initialTab)
            onInitialTabHandled()
        }
    }

    val treeListRows = state.trees.map { tree ->
        val scans = store.treeRipenessScansForTree(tree.treeId)
        val n = scans.size
        val avg = store.treeRipenessAverage(tree.treeId)
        val decision = TreeRipeness.decisionText(avg, n)
        val scoreLine = if (n >= TreeRipeness.MIN_SCANS_FOR_STATUS && avg != null) {
            "${TreeRipeness.percentFromAverage(avg)}% score · $decision"
        } else {
            decision
        }
        Triple(
            tree.details.ifBlank { "Tree" },
            "ID ${tree.treeId} · ${tree.sectionName} · $n / ${TreeRipeness.MIN_SCANS_FOR_STATUS} scans · $scoreLine",
            tree.stage
        )
    }
    val batchIds = state.batches.map { it.batchId }.distinct().sorted()
    val workerNames = state.workers.map { it.name }.distinct()
    val blockOptions = if (state.sections.isNotEmpty()) {
        state.sections.map { it.name }
    } else {
        listOf("(add Sections in Farm Operations)")
    }
    val harvestPrerequisitesMet = batchIds.isNotEmpty() && workerNames.isNotEmpty()
    val batchById = state.batches.associateBy { it.batchId }
    val harvestStatsByBatch = state.cherryHarvests.groupBy { it.batchId }.mapValues { (_, records) ->
        records.sumOf { parseWeightKg(it.weightText) }
    }
    val gradingCountByBatch = state.cherryGrades.groupBy { it.batchId ?: "" }.mapValues { it.value.size }
    val sortingSummary = buildList {
        val allBatchIds = (state.batches.map { it.batchId } + state.cherryHarvests.map { it.batchId } + state.cherryGrades.map { it.batchId ?: "" })
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .sorted()
        allBatchIds.forEach { batchId ->
            val grades = state.cherryGrades.filter { (it.batchId ?: "") == batchId }
            val gradeBadges = grades
                .groupBy { it.grade ?: "" }
                .map { (grade, byGrade) -> "$grade - ${byGrade.size}" to gradeTone(grade) }
            val totalSamples = grades.size
            val ripeSamples = grades.count {
                val g = it.grade ?: ""
                g == "Red/Ripe" || g == "Yellow/Near Ripe"
            }
            val ripeRatio = if (totalSamples > 0) (ripeSamples.toDouble() / totalSamples.toDouble()) * 100.0 else null
            val harvestRecords = state.cherryHarvests.count { it.batchId == batchId }
            val harvestKg = harvestStatsByBatch[batchId] ?: 0.0
            val statusText = batchById[batchId]?.status ?: "untracked"
            val subtitle = buildString {
                append("Harvest: $harvestRecords records • ${"%.1f".format(harvestKg)} kg")
                append(" • Graded: $totalSamples")
                append(" • Status: $statusText")
                if (ripeRatio != null) append(" • Ripe ratio: ${"%.0f".format(ripeRatio)}%")
            }
            add(
                TreesSectionCard(
                    title = batchId,
                    subtitle = subtitle,
                    badges = if (gradeBadges.isNotEmpty()) gradeBadges else listOf("No grades yet" to "neutral")
                )
            )
        }
    }
    val suggestedCaptureBatchId = nextBatchId(
        (state.cherryGrades.mapNotNull { it.batchId?.trim()?.takeIf { id -> id.isNotEmpty() } } +
            state.cherryHarvests.map { it.batchId.trim() }.filter { it.isNotEmpty() } +
            state.batches.map { it.batchId.trim() }.filter { it.isNotEmpty() })
            .distinct()
    )
    val fruitingTrees = state.trees.filter { TreeRipeness.isFruitingStage(it.stage) }
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
                "Trees" -> TreesTab(treeListRows)
                "Harvest" -> HarvestTab(
                    state.cherryHarvests.mapIndexed { index, harvest ->
                        val linkedBatch = batchById[harvest.batchId]
                        val linkedText = linkedBatch?.let { "Linked: ${it.status}" } ?: "Linked: no batch record"
                        val datedDetails = if (harvest.date.isNullOrBlank()) harvest.details else "${harvest.details} • ${harvest.date}"
                        val workerText = if (harvest.pickerWorkerName.isNullOrBlank()) "Worker: unassigned" else "Worker: ${harvest.pickerWorkerName}"
                        val disambiguator = harvest.date?.trim()?.takeIf { it.isNotEmpty() }
                            ?: harvest.pickerWorkerName?.trim()?.takeIf { it.isNotEmpty() }
                            ?: "record ${index + 1}"
                        val idLine = harvest.harvestId.ifBlank { harvest.batchId }
                        val blockLine = if (harvest.farmBlock.isNotBlank()) "Block: ${harvest.farmBlock}" else ""
                        val qLine = if (harvest.qualityNotes.isNotBlank()) "Quality: ${harvest.qualityNotes}" else ""
                        val title = "$idLine · $disambiguator"
                        val sub = listOf(
                            if (blockLine.isNotBlank()) blockLine else null,
                            if (qLine.isNotBlank()) qLine else null,
                            datedDetails,
                            workerText,
                            linkedText
                        ).mapNotNull { it }.joinToString(" • ")
                        Triple(title, sub, harvest.weightText)
                    }
                ) { if (isAdmin) editingIndex = it }
                "Batches" -> BatchesTab(
                    state.batches.map { batch ->
                        val harvestCount = state.cherryHarvests.count { it.batchId == batch.batchId }
                        val totalHarvestKg = harvestStatsByBatch[batch.batchId] ?: 0.0
                        val gradedSamples = gradingCountByBatch[batch.batchId] ?: 0
                        val stats =
                            "Harvests: $harvestCount • ${"%.1f".format(totalHarvestKg)} kg • Grades: $gradedSamples"
                        val label = batch.label.trim()
                        val batchId = batch.batchId.trim()
                        val connectedSummary = when {
                            label.isEmpty() || label.equals(batchId, ignoreCase = true) -> stats
                            else -> "$label • $stats"
                        }
                        val treeNote = batch.treeId?.let { tid ->
                            val p = (batch.ripenessScore ?: 0.0) * 100.0
                            "Tree $tid — ripeness ${"%.0f".format(p)}%"
                        } ?: "No tree link"
                        Triple(batchId, "$connectedSummary · $treeNote", batch.status)
                    }
                ) { if (isAdmin) editingIndex = it }
                "Sorting" -> SortingTab(sortingSummary)
                "Capture" -> AiGradingTab(
                    trees = fruitingTrees,
                    allScans = state.treeRipenessScans,
                    suggestedBatchId = suggestedCaptureBatchId,
                    recent = state.cherryGrades
                        .sortedByDescending { it.savedAtMillis ?: 0L }
                        .map { g ->
                        val ripenessPart =
                            if (g.confidence.isNullOrBlank() || g.confidence == "-") {
                                "Ripeness: awaiting model"
                            } else {
                                "Ripeness: ${g.grade ?: ""} (${g.confidence})"
                            }
                        val speciesPart =
                            if (!g.species.isNullOrBlank() && g.species != "—") {
                                "Species: ${g.species} (${g.speciesConfidence ?: ""})"
                            } else {
                                "Species: not recorded"
                            }
                        val treePart =
                            if (g.treeId.isNullOrBlank()) {
                                "Tree: not linked"
                            } else {
                                "Tree: ${g.treeId}"
                            }
                        RecentClassification(
                            gradeKey = store.stableKeyForCherryGrade(g),
                            batchId = g.batchId ?: "",
                            subtitle = "$treePart • $ripenessPart • $speciesPart",
                            grade = g.grade ?: "",
                            species = if (g.species.isNullOrBlank()) "—" else g.species,
                        )
                    },
                    onSaveResult = { batchId, grade, confidence, species, speciesConfidence, treeId ->
                        val label = TreeRipeness.mapDisplayGradeToRipenessLabel(grade)
                        val ok = store.addTreeRipenessScanWithCherryGrade(
                            TreeRipenessScanRecord(
                                treeId = treeId,
                                ripenessLabel = label,
                                timestampMillis = System.currentTimeMillis(),
                                sourceGrade = grade
                            ),
                            batchId = batchId,
                            grade = grade,
                            confidence = confidence,
                            species = species,
                            speciesConfidence = speciesConfidence
                        )
                        if (!ok) {
                            Toast.makeText(
                                context,
                                TreeRipeness.CHERRY_AND_HARVEST_ONLY_FOR_FRUITING,
                                Toast.LENGTH_LONG
                            ).show()
                        }
                        // Tree-level harvest is decided from averaged scans in Trees / Batches, not a single cherry.
                        false
                    },
                    allowDeleteRecent = isAdmin,
                    onDeleteRecent = { key -> store.deleteCherryGradeByKey(key) }
                )
            }
        }

        if (isAdmin &&
            activeTab in listOf("Harvest", "Batches") &&
            (activeTab != "Harvest" || harvestPrerequisitesMet)
        ) {
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

    if (activeTab == "Harvest" && !harvestPrerequisitesMet) {
        Surface(
            color = Color(0xFF4B1F1F),
            shape = RoundedCornerShape(12.dp),
            border = BorderStroke(1.dp, Color(0xFFFF7A70)),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Text(
                text = "To add Harvest records, add at least one Worker and one Batch first.",
                color = Color(0xFFFFD2CE),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
            )
        }
    }

    if (showAddDialog) {
        val batchTreeOptions = buildList {
            add("(No tree link)")
            fruitingTrees.forEach { t ->
                add("tree:${t.treeId}|${t.sectionName} · ${t.details.ifBlank { "Tree" }}")
            }
        }
        val fields = when (activeTab) {
            "Harvest" -> listOf(
                RecordField("Harvest ID (auto if blank)"),
                RecordField("Farm block", options = blockOptions),
                RecordField("Batch ID", options = batchIds),
                RecordField("Worker Name", options = workerNames),
                RecordField("Harvest details"),
                RecordField("Quality notes"),
                RecordField("Weight (kg)"),
                RecordField("Date")
            )
            "Batches" -> listOf(
                RecordField("Batch ID"),
                RecordField("Label"),
                RecordField("Processing Status", options = listOf("harvesting", "fermenting", "drying", "milled", "shipped")),
                RecordField(
                    "Link tree (Fruiting trees only: 10+ scans & ≥80% score, or No link)",
                    options = batchTreeOptions
                )
            )
            else -> listOf(
                RecordField("Batch ID"),
                RecordField("Label"),
                RecordField("Processing Status", options = listOf("harvesting", "fermenting", "drying", "milled", "shipped"))
            )
        }
        val addInitialValues = when (activeTab) {
            "Harvest" -> listOf(
                "",
                blockOptions.firstOrNull().orEmpty(),
                suggestedCaptureBatchId,
                workerNames.firstOrNull().orEmpty(),
                "",
                "",
                "",
                ""
            )
            "Batches" -> listOf(suggestedCaptureBatchId, "", "harvesting", "(No tree link)")
            else -> emptyList()
        }
        SimpleRecordDialog(
            title = "Add $activeTab",
            fields = fields,
            initialValues = addInitialValues,
            onDismiss = { showAddDialog = false },
            onSave = { values ->
                when (activeTab) {
                    "Harvest" -> store.addCherryHarvest(
                        batchId = values[2],
                        pickerWorkerName = values[3],
                        details = values[4],
                        weightText = values[6],
                        date = values.getOrElse(7) { "" },
                        harvestId = values[0].trim(),
                        farmBlock = values[1].trim(),
                        qualityNotes = values[5].trim()
                    )
                    "Batches" -> {
                        val tid = parseBatchTreeOption(values.getOrNull(3).orEmpty())
                        val ok = store.addBatch(
                            batchId = values[0],
                            label = values[1],
                            status = values[2],
                            treeId = tid
                        )
                        if (!ok) {
                            Toast.makeText(
                                context,
                                "Cannot link: tree must be Fruiting, with ${TreeRipeness.MIN_SCANS_FOR_STATUS}+ scans and average ≥ 80%. Choose “No tree link” for a general batch.",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    }
                }
            }
        )
    }

    editingIndex?.let { index ->
        val batchTreeOptionsEdit = buildList {
            add("(No tree link)")
            fruitingTrees.forEach { t ->
                add("tree:${t.treeId}|${t.sectionName} · ${t.details.ifBlank { "Tree" }}")
            }
        }
        val fields = when (activeTab) {
            "Harvest" -> listOf(
                RecordField("Harvest ID"),
                RecordField("Farm block", blockOptions),
                RecordField("Batch ID", batchIds),
                RecordField("Worker Name", workerNames),
                RecordField("Harvest details"),
                RecordField("Quality notes"),
                RecordField("Weight (kg)"),
                RecordField("Date")
            )
            "Batches" -> listOf(
                RecordField("Batch ID"),
                RecordField("Label"),
                RecordField("Processing Status", listOf("harvesting", "fermenting", "drying", "milled", "shipped")),
                RecordField("Link tree", batchTreeOptionsEdit)
            )
            else -> listOf(
                RecordField("Batch ID"),
                RecordField("Label"),
                RecordField("Processing Status", listOf("harvesting", "fermenting", "drying", "milled", "shipped"))
            )
        }
        val initial = when (activeTab) {
            "Harvest" -> state.cherryHarvests.getOrNull(index)?.let {
                listOf(
                    it.harvestId,
                    it.farmBlock,
                    it.batchId,
                    it.pickerWorkerName.orEmpty(),
                    it.details,
                    it.qualityNotes,
                    it.weightText,
                    it.date.orEmpty()
                )
            } ?: emptyList()
            "Batches" -> state.batches.getOrNull(index)?.let { b ->
                val treeLine = b.treeId?.let { tid ->
                    val tr = state.trees.find { it.treeId == tid }
                    "tree:$tid|${tr?.sectionName} · ${tr?.details?.ifBlank { "Tree" }}"
                } ?: "(No tree link)"
                listOf(b.batchId, b.label, b.status, treeLine)
            } ?: emptyList()
            else -> emptyList()
        }
        SimpleRecordDialog(
            title = "Edit $activeTab",
            fields = fields,
            initialValues = initial,
            onDismiss = { editingIndex = null },
            onSave = { values ->
                when (activeTab) {
                    "Harvest" -> store.updateCherryHarvest(
                        index = index,
                        batchId = values[2],
                        pickerWorkerName = values[3],
                        details = values[4],
                        weightText = values[6],
                        date = values.getOrElse(7) { "" },
                        harvestId = values[0].trim(),
                        farmBlock = values[1].trim(),
                        qualityNotes = values[5].trim()
                    )
                    "Batches" -> {
                        val tid = parseBatchTreeOption(values.getOrNull(3).orEmpty())
                        if (tid != null) {
                            val trec = state.trees.find { it.treeId == tid }
                            if (trec == null || !TreeRipeness.isFruitingStage(trec.stage)) {
                                Toast.makeText(
                                    context,
                                    TreeRipeness.CHERRY_AND_HARVEST_ONLY_FOR_FRUITING,
                                    Toast.LENGTH_LONG
                                ).show()
                            } else {
                                val scans = store.treeRipenessScansForTree(tid)
                                val avg = store.treeRipenessAverage(tid)
                                if (!TreeRipeness.canCreateHarvestBatch(avg, scans.size)) {
                                    Toast.makeText(
                                        context,
                                        "Cannot link tree: need ${TreeRipeness.MIN_SCANS_FOR_STATUS}+ scans and average ≥ 80%, or use No tree link.",
                                        Toast.LENGTH_LONG
                                    ).show()
                                } else {
                                    val uOk = store.updateBatch(
                                        index = index,
                                        batchId = values[0],
                                        label = values[1],
                                        status = values[2],
                                        treeId = tid,
                                        ripenessScore = avg
                                    )
                                    if (!uOk) {
                                        Toast.makeText(
                                            context,
                                            "Cannot link this batch to the tree. Check that the tree is Fruiting and meets scan requirements.",
                                            Toast.LENGTH_LONG
                                        ).show()
                                    }
                                }
                            }
                        } else {
                            val uOk = store.updateBatch(
                                index = index,
                                batchId = values[0],
                                label = values[1],
                                status = values[2],
                                treeId = null,
                                ripenessScore = null
                            )
                            if (!uOk) {
                                Toast.makeText(
                                    context,
                                    "Could not update batch. If removing the tree link is not working, try again.",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }
                }
            },
            onDelete = if (isAdmin) {
                {
                    when (activeTab) {
                        "Harvest" -> store.deleteCherryHarvest(index)
                        "Batches" -> store.deleteBatch(index)
                    }
                }
            } else null
        )
    }
}

@Composable
private fun TreesTab(treeRecords: List<Triple<String, String, String>>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(treeRecords) { item ->
            CherryCard(
                title = item.second.ifBlank { "Tree record" },
                subtitle = "Section: ${item.first}",
                badges = listOf(item.third.replaceFirstChar { it.uppercase() } to treeStageToTone(item.third))
            )
        }
    }
}

@Composable
private fun HarvestTab(records: List<Triple<String, String, String>>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(records) { index, r ->
            CherryCard(
                title = r.first,
                subtitle = r.second,
                icon = Icons.Default.ShoppingBag,
                trailing = r.third
            ) { onEdit(index) }
        }
    }
}

@Composable
private fun BatchesTab(batches: List<Triple<String, String, String>>, onEdit: (Int) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(batches) { index, b ->
            CherryCard(
                title = b.first,
                subtitle = b.second,
                badges = listOf(b.third.replaceFirstChar { it.uppercase() } to b.third)
            ) { onEdit(index) }
        }
    }
}

@Composable
private fun SortingTab(sorted: List<TreesSectionCard>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (sorted.isEmpty()) {
            item {
                CherryCard(
                    title = "No sorting data yet",
                    subtitle = "Run AI grading or add cherry grades to see batch summaries.",
                    icon = Icons.Default.FilterAlt
                )
            }
        } else {
            items(sorted) { s ->
                CherryCard(
                    title = s.title,
                    subtitle = s.subtitle,
                    icon = Icons.Default.FilterAlt,
                    badges = s.badges
                )
            }
        }
    }
}

private data class RecentClassification(
    val gradeKey: String,
    val batchId: String,
    val subtitle: String,
    val grade: String,
    val species: String,
)

@Composable
private fun FruitingTreeBottomSheetList(
    trees: List<TreeRecord>,
    allScans: List<TreeRipenessScanRecord>,
    selectedTreeId: String,
    onSelect: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
    ) {
        Text(
            "Fruiting trees",
            color = Color(0xFF84B626),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
        )
        Text(
            "Tap a card to select that tree for your scans.",
            color = Color(0xFFB8A99E),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 0.dp)
        )
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            modifier = Modifier
                .heightIn(max = 420.dp)
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(trees, key = { it.treeId }) { t ->
                val n = allScans.count { it.treeId == t.treeId }
                val runs = allScans.filter { it.treeId == t.treeId }
                val avg = TreeRipeness.averageScore(runs)
                val dec = TreeRipeness.decisionText(avg, n)
                val scorePct = if (n >= TreeRipeness.MIN_SCANS_FOR_STATUS && avg != null) {
                    "${TreeRipeness.percentFromAverage(avg)}%"
                } else {
                    "— (need ${TreeRipeness.MIN_SCANS_FOR_STATUS} scans)"
                }
                val isSelected = t.treeId == selectedTreeId
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (isSelected) Color(0xFF243018) else Color(0xFF1F1A16),
                    border = BorderStroke(
                        if (isSelected) 2.dp else 1.dp,
                        if (isSelected) Color(0xFF84B626) else Color(0xFF5A463A)
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(t.treeId) }
                ) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "${t.sectionName} · ${t.details.ifBlank { "Tree" }}",
                                color = Color(0xFFF4EDE6),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f)
                            )
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = Color(0xFF2A4018)
                            ) {
                                Text(
                                    "Fruiting",
                                    color = Color(0xFF9AD45E),
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                )
                            }
                        }
                        Text(
                            "ID ${t.treeId}",
                            color = Color(0xFF8F8177),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Scans: $n / ${TreeRipeness.MIN_SCANS_FOR_STATUS}   Ripeness index: $scorePct",
                            color = Color(0xFF84B626),
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            "Decision: $dec",
                            color = Color(0xFF9AD45E),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun AiGradingTab(
    trees: List<TreeRecord>,
    allScans: List<TreeRipenessScanRecord>,
    suggestedBatchId: String,
    recent: List<RecentClassification>,
    onSaveResult: (batchId: String, grade: String, confidence: String, species: String, speciesConfidence: String, treeId: String) -> Boolean,
    allowDeleteRecent: Boolean,
    onDeleteRecent: (gradeKey: String) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val mainExecutor = androidx.core.content.ContextCompat.getMainExecutor(context)
    var selectedImageUri by remember { mutableStateOf<String?>(null) }
    var capturedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var savingPending by remember { mutableStateOf(false) }
    var batchId by remember { mutableStateOf("") }
    var draftBatchId by remember { mutableStateOf("") }
    var showBatchIdDialog by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var inferenceRunning by remember { mutableStateOf(false) }
    /** Shown next to the spinner while CNNs run (cherry check → ripeness + leaf cues). */
    var scanStageLabel by remember { mutableStateOf<String?>(null) }
    var predictedGrade by remember { mutableStateOf<String?>(null) }
    var predictedConfidence by remember { mutableStateOf<String?>(null) }
    var predictedSpecies by remember { mutableStateOf<String?>(null) }
    var predictedSpeciesConfidence by remember { mutableStateOf<String?>(null) }
    var pendingDeleteGradeKey by remember { mutableStateOf<String?>(null) }
    var selectedTreeId by remember { mutableStateOf("") }
    var showFruitingTreeSheet by remember { mutableStateOf(false) }
    val classifier = remember { CherryGradeTfliteClassifier(context) }
    val speciesClassifier = remember { CoffeeSpeciesTfliteClassifier(context) }
    var hasCameraPermission by remember {
        mutableStateOf(
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.CAMERA
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            statusMessage = "Camera permission is required for live scan."
        }
    }
    val imageCapture = remember { ImageCapture.Builder().build() }
    val cameraExecutor: ExecutorService = remember { Executors.newSingleThreadExecutor() }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            selectedImageUri = uri.toString()
            capturedBitmap = null
            statusMessage = null
            scanStageLabel = null
            predictedGrade = null
            predictedConfidence = null
            predictedSpecies = null
            predictedSpeciesConfidence = null
        }
    }
    LaunchedEffect(suggestedBatchId) {
        if (batchId.isBlank()) {
            batchId = suggestedBatchId
        }
    }
    LaunchedEffect(trees) {
        if (selectedTreeId.isBlank() && trees.isNotEmpty()) {
            selectedTreeId = trees.first().treeId
        } else if (trees.none { it.treeId == selectedTreeId } && trees.isNotEmpty()) {
            selectedTreeId = trees.first().treeId
        }
    }
    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
            classifier.close()
            speciesClassifier.close()
        }
    }

    LaunchedEffect(selectedImageUri) {
        val uriStr = selectedImageUri ?: return@LaunchedEffect
        inferenceRunning = true
        scanStageLabel = CaptureScanStages.LOADING_PHOTO
        predictedGrade = null
        predictedConfidence = null
        predictedSpecies = null
        predictedSpeciesConfidence = null
        statusMessage = null
        val bmp = withContext(Dispatchers.IO) {
            BitmapExifUtils.loadBitmapWithOrientation(context, Uri.parse(uriStr))
        }
        if (bmp == null) {
            inferenceRunning = false
            scanStageLabel = null
            statusMessage = "Could not load image from gallery."
            return@LaunchedEffect
        }
        capturedBitmap = bmp
        selectedImageUri = null
        scanStageLabel = CaptureScanStages.CHECK_COFFEE_CHERRY
        val errors = mutableListOf<String>()
        var cherryUncertainReject = false
        val rip = withContext(Dispatchers.Default) { classifier.classify(bmp) }
        scanStageLabel = CaptureScanStages.ANALYZE_RIPENESS_AND_LEAF
        val spec = if (speciesClassifier.isReady()) {
            withContext(Dispatchers.Default) { speciesClassifier.classify(bmp) }
        } else {
            null
        }
        rip.fold(
            onSuccess = { p ->
                if (p.uncertain) {
                    cherryUncertainReject = true
                    predictedGrade = null
                    predictedConfidence = null
                } else {
                    predictedGrade = p.grade
                    predictedConfidence = p.confidenceText
                }
            },
            onFailure = { e ->
                predictedGrade = null
                predictedConfidence = null
                errors.add(e.message ?: "Ripeness CNN failed.")
            }
        )
        when {
            spec == null -> {
                predictedSpecies = null
                predictedSpeciesConfidence = null
            }
            else -> spec.fold(
                onSuccess = { p ->
                    predictedSpecies = p.speciesDisplay
                    predictedSpeciesConfidence = p.confidenceText
                },
                onFailure = { e ->
                    predictedSpecies = null
                    predictedSpeciesConfidence = null
                    errors.add(e.message ?: "Species CNN failed.")
                }
            )
        }
        statusMessage = when {
            cherryUncertainReject -> TreeRipeness.CAPTURE_NOT_CONFIDENT_CHERRY_SCAN
            TreeRipeness.shouldClearRipenessForLeafPhoto(speciesClassifier.isReady(), predictedSpecies, predictedConfidence) -> {
                predictedGrade = null
                predictedConfidence = null
                TreeRipeness.CAPTURE_PLEASE_TRY_AGAIN_FOCUS_CHERRIES
            }
            else -> errors.joinToString("\n").ifBlank { null }
        }
        inferenceRunning = false
        scanStageLabel = null
    }

    Box(modifier = Modifier.fillMaxSize()) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF2D211A)),
                border = BorderStroke(1.dp, Color(0xFF5A463A))
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (!classifier.isReady() || !speciesClassifier.isReady()) {
                        Surface(
                            color = Color(0xFF4A2C2C),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, Color(0xFF8F5A5A))
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                if (!classifier.isReady()) {
                                    Text(
                                        "Ripeness CNN: add cherry_grade_model.tflite to app/src/main/assets (required for grade).",
                                        color = Color(0xFFFFB4A8),
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                                if (!speciesClassifier.isReady()) {
                                    Text(
                                        "Species CNN: add coffee_species_model.tflite to app/src/main/assets (optional; ripeness still works).",
                                        color = Color(0xFFFFD9A0),
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }
                    if (trees.isEmpty()) {
                        Text(
                            "Add a tree and set its growth stage to Fruiting in Farm → Operations (Trees) before recording cherry scans.",
                            color = Color(0xFFFFB4A8),
                            style = MaterialTheme.typography.bodySmall
                        )
                    } else {
                        val nScans = allScans.count { it.treeId == selectedTreeId }
                        val runs = allScans.filter { it.treeId == selectedTreeId }
                        val avg = TreeRipeness.averageScore(runs)
                        val dec = TreeRipeness.decisionText(avg, nScans)
                        val scorePct = if (nScans >= TreeRipeness.MIN_SCANS_FOR_STATUS && avg != null) {
                            "${TreeRipeness.percentFromAverage(avg)}%"
                        } else {
                            "— (need ${TreeRipeness.MIN_SCANS_FOR_STATUS} scans)"
                        }
                        val selected = trees.find { it.treeId == selectedTreeId }
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "Tree (sample many cherries per tree)",
                                color = Color(0xFFB8A99E),
                                style = MaterialTheme.typography.labelMedium
                            )
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFF221810),
                                border = BorderStroke(1.5.dp, Color(0xFF84B626)),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { showFruitingTreeSheet = true }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(
                                            "Fruiting tree (tap to switch)",
                                            color = Color(0xFF84B626),
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            selected?.let { "${it.sectionName} · ${it.details.ifBlank { "Tree" }}" } ?: "",
                                            color = Color(0xFFF4EDE6),
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                        Text(
                                            "ID $selectedTreeId",
                                            color = Color(0xFF8F8177),
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Default.ChevronRight,
                                        contentDescription = "Choose fruiting tree",
                                        tint = Color(0xFF84B626)
                                    )
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    "Scans: $nScans / ${TreeRipeness.MIN_SCANS_FOR_STATUS}",
                                    color = Color(0xFF84B626),
                                    fontWeight = FontWeight.SemiBold,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text("Ripeness index: $scorePct", color = Color(0xFFE8E0D8))
                            }
                            Text(
                                "Decision: $dec",
                                color = Color(0xFF9AD45E),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFF241A14),
                        border = BorderStroke(1.dp, Color(0xFF6B5445))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    draftBatchId = batchId
                                    showBatchIdDialog = true
                                }
                                .padding(horizontal = 12.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalFlorist,
                                contentDescription = null,
                                tint = Color(0xFF84B626)
                            )
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(start = 10.dp)
                            ) {
                                Text(
                                    "Batch / lot ID (for sorting)",
                                    color = Color(0xFFB8A99E),
                                    style = MaterialTheme.typography.labelMedium
                                )
                                Text(
                                    if (batchId.isBlank()) "Tap to set batch ID" else batchId,
                                    color = if (batchId.isBlank()) Color(0xFF8F8177) else Color(0xFFF4EDE6),
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Icon(
                                imageVector = Icons.Default.ChevronRight,
                                contentDescription = null,
                                tint = Color(0xFF8F8177)
                            )
                        }
                    }
                    Surface(
                        color = Color(0xFF251912),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, Color(0xFF5A463A))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(240.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFF120D09))
                            ) {
                                if (hasCameraPermission) {
                                    AndroidView(
                                        modifier = Modifier.fillMaxSize(),
                                        factory = { viewContext ->
                                            PreviewView(viewContext).apply {
                                                scaleType = PreviewView.ScaleType.FILL_CENTER
                                                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
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
                                                } catch (_: Exception) {
                                                    statusMessage = "Unable to start camera preview."
                                                }
                                            }, mainExecutor)
                                        }
                                    )
                                } else {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .padding(horizontal = 20.dp),
                                        verticalArrangement = Arrangement.Center,
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text("Camera permission required", color = Color(0xFFF4EDE6))
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Button(
                                            onClick = { permissionLauncher.launch(android.Manifest.permission.CAMERA) },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = Color(0xFF2E8B3C),
                                                contentColor = Color(0xFFF4EDE6)
                                            )
                                        ) {
                                            Icon(Icons.Default.CameraAlt, contentDescription = null)
                                            Text(" Allow Camera")
                                        }
                                    }
                                }
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.Center)
                                        .fillMaxWidth(0.78f)
                                        .height(130.dp)
                                        .border(
                                            width = 2.dp,
                                            color = Color(0xFF84B626),
                                            shape = RoundedCornerShape(14.dp)
                                        ),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        "Focus coffee inside frame",
                                        color = Color(0xFFE8E0D8),
                                        style = MaterialTheme.typography.bodyMedium
                                    )
                                }
                                if (inferenceRunning) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(Color(0xAA000000)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Column(
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.spacedBy(10.dp),
                                            modifier = Modifier.padding(horizontal = 16.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(36.dp),
                                                color = Color(0xFF84B626),
                                                strokeWidth = 3.dp
                                            )
                                            Text(
                                                text = scanStageLabel ?: "Analyzing photo…",
                                                color = Color(0xFFE8E0D8),
                                                style = MaterialTheme.typography.bodySmall
                                            )
                                        }
                                    }
                                }
                            }
                            Button(
                                onClick = {
                                    if (!hasCameraPermission) {
                                        permissionLauncher.launch(android.Manifest.permission.CAMERA)
                                        return@Button
                                    }
                                    val output = File.createTempFile("coffee-capture", ".jpg", context.cacheDir)
                                    val outputOptions = ImageCapture.OutputFileOptions.Builder(output).build()
                                    imageCapture.takePicture(
                                        outputOptions,
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
                                                        statusMessage = null
                                                        predictedGrade = null
                                                        predictedConfidence = null
                                                        predictedSpecies = null
                                                        predictedSpeciesConfidence = null
                                                        inferenceRunning = true
                                                        scanStageLabel = CaptureScanStages.CHECK_COFFEE_CHERRY
                                                    }
                                                    cameraExecutor.execute {
                                                        val errors = mutableListOf<String>()
                                                        var cherryUncertainReject = false
                                                        val rip = classifier.classify(bmp)
                                                        mainExecutor.execute {
                                                            scanStageLabel = CaptureScanStages.ANALYZE_RIPENESS_AND_LEAF
                                                        }
                                                        val spec = if (speciesClassifier.isReady()) {
                                                            speciesClassifier.classify(bmp)
                                                        } else {
                                                            null
                                                        }
                                                        mainExecutor.execute {
                                                            inferenceRunning = false
                                                            scanStageLabel = null
                                                            rip.fold(
                                                                onSuccess = { p ->
                                                                    if (p.uncertain) {
                                                                        cherryUncertainReject = true
                                                                        predictedGrade = null
                                                                        predictedConfidence = null
                                                                    } else {
                                                                        predictedGrade = p.grade
                                                                        predictedConfidence = p.confidenceText
                                                                    }
                                                                },
                                                                onFailure = { e ->
                                                                    predictedGrade = null
                                                                    predictedConfidence = null
                                                                    errors.add(e.message ?: "Ripeness CNN failed.")
                                                                }
                                                            )
                                                            when {
                                                                spec == null -> {
                                                                    predictedSpecies = null
                                                                    predictedSpeciesConfidence = null
                                                                }
                                                                else -> spec.fold(
                                                                    onSuccess = { p ->
                                                                        predictedSpecies = p.speciesDisplay
                                                                        predictedSpeciesConfidence = p.confidenceText
                                                                    },
                                                                    onFailure = { e ->
                                                                        predictedSpecies = null
                                                                        predictedSpeciesConfidence = null
                                                                        errors.add(e.message ?: "Species CNN failed.")
                                                                    }
                                                                )
                                                            }
                                                            statusMessage = when {
                                                                cherryUncertainReject -> TreeRipeness.CAPTURE_NOT_CONFIDENT_CHERRY_SCAN
                                                                TreeRipeness.shouldClearRipenessForLeafPhoto(
                                                                    speciesClassifier.isReady(),
                                                                    predictedSpecies,
                                                                    predictedConfidence,
                                                                ) -> {
                                                                    predictedGrade = null
                                                                    predictedConfidence = null
                                                                    TreeRipeness.CAPTURE_PLEASE_TRY_AGAIN_FOCUS_CHERRIES
                                                                }
                                                                else -> errors.joinToString("\n").ifBlank { null }
                                                            }
                                                        }
                                                    }
                                                }
                                            }

                                            override fun onError(exception: ImageCaptureException) {
                                                mainExecutor.execute {
                                                    statusMessage = "Capture failed. Try again."
                                                }
                                            }
                                        }
                                    )
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF2E8B3C),
                                    contentColor = Color(0xFFF4EDE6)
                                ),
                                shape = CircleShape,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp)
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null)
                                Text(" Capture")
                            }
                        }
                    }
                    TextButton(
                        onClick = { picker.launch("image/*") }
                    ) {
                        Text("Use Gallery Instead", color = Color(0xFFB8A99E))
                    }
                    if (capturedBitmap != null || selectedImageUri != null) {
                        Surface(
                            color = Color(0xFF3A2A21),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, Color(0xFF5A463A))
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = when {
                                        capturedBitmap != null -> "Photo captured from camera."
                                        else -> "Loading image from gallery…"
                                    },
                                    color = Color(0xFFE8E0D8),
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                if (inferenceRunning) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(22.dp),
                                            color = Color(0xFF84B626),
                                            strokeWidth = 2.dp
                                        )
                                        Text(
                                            scanStageLabel ?: "Analyzing photo…",
                                            color = Color(0xFFB8A99E),
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                }
                                val pg = predictedGrade
                                if (pg != null) {
                                    Text(
                                        text = "Ripeness: $pg (${predictedConfidence ?: "-"})",
                                        color = Color(0xFF84B626),
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Text(
                                        text = "This scan adds one sample toward the tree average (need ${TreeRipeness.MIN_SCANS_FOR_STATUS}+ scans for a tree decision).",
                                        color = Color(0xFF8F8177),
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                                if (speciesClassifier.isReady()) {
                                    if (predictedSpecies != null) {
                                        Text(
                                            text = "Species: $predictedSpecies (${predictedSpeciesConfidence ?: "-"})",
                                            color = Color(0xFF6AB0FF),
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    } else if (!inferenceRunning && predictedGrade != null) {
                                        Text(
                                            text = "Species: no result",
                                            color = Color(0xFF8F8177),
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                } else {
                                    Text(
                                        text = "Species CNN not installed — add coffee_species_model.tflite to assets.",
                                        color = Color(0xFF8F8177),
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }
                    Button(
                        onClick = {
                            if (trees.isEmpty()) {
                                statusMessage =
                                    "Add a tree and set growth stage to Fruiting in Farm → Operations (Trees) first."
                                return@Button
                            }
                            if (selectedTreeId.isBlank()) {
                                statusMessage = "Select which tree this sample belongs to."
                                return@Button
                            }
                            if ((selectedImageUri != null || capturedBitmap != null) && batchId.isNotBlank()) {
                                if (inferenceRunning) {
                                    statusMessage = "Wait for the CNN to finish analyzing the photo."
                                    return@Button
                                }
                                val grade = predictedGrade
                                val conf = predictedConfidence
                                if (grade.isNullOrBlank()) {
                                    statusMessage =
                                        "No ripeness result yet. Capture a photo or choose from the gallery, wait until “Ripeness:” appears above, then save."
                                    return@Button
                                }
                                val species = if (speciesClassifier.isReady()) {
                                    predictedSpecies?.takeIf { it.isNotBlank() } ?: "—"
                                } else {
                                    "—"
                                }
                                val speciesConf =
                                    if (speciesClassifier.isReady()) predictedSpeciesConfidence ?: "-" else "—"
                                savingPending = true
                                val harvestLogged = onSaveResult(
                                    batchId,
                                    grade,
                                    conf ?: "-",
                                    species,
                                    speciesConf,
                                    selectedTreeId
                                )
                                savingPending = false
                                val baseMsg = if (isDeviceOnline(context)) {
                                    "Saved sample for tree $selectedTreeId under batch $batchId."
                                } else {
                                    "Saved on this device for batch $batchId. Will upload when you have internet."
                                }
                                statusMessage = baseMsg + if (harvestLogged) {
                                    " (Also logged to Harvest.)"
                                } else {
                                    " Averaging uses multiple scans in the Trees tab (not one cherry alone)."
                                }
                                batchId = ""
                                capturedBitmap = null
                                selectedImageUri = null
                                scanStageLabel = null
                                predictedGrade = null
                                predictedConfidence = null
                                predictedSpecies = null
                                predictedSpeciesConfidence = null
                            } else {
                                statusMessage = "Set Batch / lot ID and provide an image."
                            }
                        },
                        enabled = !savingPending && !inferenceRunning,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF2E8B3C),
                            contentColor = Color(0xFFF4EDE6)
                        ),
                        shape = CircleShape
                    ) {
                        if (savingPending) {
                            CircularProgressIndicator(color = Color.White)
                        } else {
                            Icon(Icons.Default.Image, contentDescription = null)
                            Text(" Save grading result")
                        }
                    }
                    if (statusMessage != null) {
                        Surface(
                            color = Color(0xFF3A2A21),
                            shape = MaterialTheme.shapes.medium
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    if (predictedGrade != null) "Status" else "Capture / CNN",
                                    color = Color(0xFF84B626),
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(statusMessage!!, color = Color(0xFFB8A99E))
                            }
                        }
                    }
                }
            }
        }
        item {
            Text(
                "Recent Classifications",
                color = Color(0xFFF4EDE6),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }
        items(recent, key = { it.gradeKey }) { r ->
            RecentClassificationCard(
                r = r,
                onDeleteClick = if (allowDeleteRecent) {
                    { pendingDeleteGradeKey = r.gradeKey }
                } else null
            )
        }
    }
    if (showFruitingTreeSheet) {
        ModalBottomSheet(
            onDismissRequest = { showFruitingTreeSheet = false },
            containerColor = Color(0xFF1A1410),
            contentColor = Color(0xFFF4EDE6),
        ) {
            FruitingTreeBottomSheetList(
                trees = trees,
                allScans = allScans,
                selectedTreeId = selectedTreeId,
                onSelect = { id ->
                    selectedTreeId = id
                    showFruitingTreeSheet = false
                }
            )
        }
    }
    }

    pendingDeleteGradeKey?.let { key ->
        val item = recent.firstOrNull { it.gradeKey == key }
        AlertDialog(
            onDismissRequest = { pendingDeleteGradeKey = null },
            containerColor = Color(0xFF2D211A),
            title = {
                Text(
                    "Delete classification?",
                    color = Color(0xFFF4EDE6),
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Text(
                    item?.let { "Remove scan for batch ${it.batchId} from recent classifications?" }
                        ?: "Remove this saved scan?",
                    color = Color(0xFFB8A99E)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDeleteRecent(key)
                        pendingDeleteGradeKey = null
                    }
                ) {
                    Text("Delete", color = Color(0xFFFF7A70), fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteGradeKey = null }) {
                    Text("Cancel", color = Color(0xFFB8A99E))
                }
            }
        )
    }

    if (showBatchIdDialog) {
        AlertDialog(
            onDismissRequest = { showBatchIdDialog = false },
            containerColor = Color(0xFF2D211A),
            title = {
                Text(
                    "Set Batch ID",
                    color = Color(0xFFF4EDE6),
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                OutlinedTextField(
                    value = draftBatchId,
                    onValueChange = { draftBatchId = it },
                    label = { Text("Batch ID") },
                    placeholder = { Text("e.g. B-2026-017") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color(0xFF84B626),
                        unfocusedBorderColor = Color(0xFF6B5445),
                        focusedLabelColor = Color(0xFF84B626),
                        unfocusedLabelColor = Color(0xFFB8A99E),
                        focusedPlaceholderColor = Color(0xFF8F8177),
                        unfocusedPlaceholderColor = Color(0xFF7D6E64),
                        focusedContainerColor = Color(0xFF241A14),
                        unfocusedContainerColor = Color(0xFF241A14),
                        cursorColor = Color(0xFF84B626),
                        focusedTextColor = Color(0xFFF4EDE6),
                        unfocusedTextColor = Color(0xFFF4EDE6)
                    )
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        batchId = draftBatchId.trim()
                        showBatchIdDialog = false
                    }
                ) {
                    Text("Save", color = Color(0xFF84B626), fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showBatchIdDialog = false }) {
                    Text("Cancel", color = Color(0xFFB8A99E))
                }
            }
        )
    }
}

@Composable
private fun RecentClassificationCard(
    r: RecentClassification,
    onDeleteClick: (() -> Unit)?,
) {
    val isDarkPalette = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val cardColor = if (isDarkPalette) Color(0xFF2D211A) else Color(0xFFFFFFFF)
    val borderColor = if (isDarkPalette) Color(0xFF5A463A) else Color(0xFFD9CEC3)
    val titleColor = if (isDarkPalette) Color(0xFFF4EDE6) else Color(0xFF3E2723)
    val subtitleColor = if (isDarkPalette) Color(0xFFB8A99E) else Color(0xFF7A6A5F)
    Card(
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
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.Image, contentDescription = null, tint = Color(0xFF84B626))
                    Column(modifier = Modifier.padding(start = 8.dp)) {
                        Text(
                            text = r.batchId.ifBlank { "No batch" },
                            color = titleColor,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            r.subtitle,
                            color = subtitleColor,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
                if (onDeleteClick != null) {
                    TextButton(onClick = onDeleteClick) {
                        Text("Delete", color = Color(0xFFFF7A70), fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            val badges = buildList {
                add(r.grade to gradeTone(r.grade))
                if (r.species.isNotBlank() && r.species != "—") {
                    add(r.species to speciesTone(r.species))
                }
            }
            if (badges.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    badges.forEach { (label, tone) ->
                        val colors = badgeColor(tone)
                        Surface(color = colors.first, shape = MaterialTheme.shapes.extraLarge) {
                            Text(
                                text = label,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                color = colors.second,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CherryCard(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector = Icons.Default.LocalFlorist,
    badges: List<Pair<String, String>> = emptyList(),
    trailing: String? = null,
    onClick: () -> Unit = {}
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
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = Color(0xFF84B626))
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 8.dp)
                ) {
                    Text(title, color = titleColor, fontWeight = FontWeight.SemiBold)
                    Text(subtitle, color = subtitleColor)
                }
                if (trailing != null) {
                    Text(trailing, color = Color(0xFF84B626), fontWeight = FontWeight.Bold)
                }
            }

            if (badges.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    badges.forEach { (label, tone) ->
                        val colors = badgeColor(tone)
                        Surface(color = colors.first, shape = MaterialTheme.shapes.extraLarge) {
                            Text(
                                text = label,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                color = colors.second,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun badgeColor(tone: String): Pair<Color, Color> = when (tone.lowercase()) {
    "green", "heavy" -> Color(0xFF234917) to Color(0xFF9AD45E)
    "amber", "medium", "fermenting", "drying" -> Color(0xFF4D2F0E) to Color(0xFFF3B562)
    "yellow" -> Color(0xFF4A4014) to Color(0xFFEAC95C)
    "blue", "light", "milled", "scheduled", "in-progress" -> Color(0xFF133A5E) to Color(0xFF6AB0FF)
    "red", "harvesting" -> Color(0xFF4B1F1F) to Color(0xFFFF7A70)
    "shipped", "done" -> Color(0xFF234917) to Color(0xFF9AD45E)
    else -> Color(0xFF3B3B3B) to Color(0xFFDADADA)
}

private fun gradeTone(label: String): String = when (label) {
    "Green/Unripe" -> "green"
    "Yellow/Near Ripe" -> "yellow"
    "Red/Ripe" -> "red"
    "Overripe/Defective" -> "amber"
    else -> "neutral"
}

private fun speciesTone(displayName: String): String = when (displayName.lowercase()) {
    "liberica" -> "yellow"
    "robusta" -> "blue"
    else -> "neutral"
}

private data class TreesSectionCard(
    val title: String,
    val subtitle: String,
    val badges: List<Pair<String, String>>
)

private fun parseWeightKg(weightText: String): Double {
    val parsed = weightText.filter { it.isDigit() || it == '.' }
    return parsed.toDoubleOrNull() ?: 0.0
}

private fun treeStageToTone(stage: String): String = when (stage.lowercase()) {
    "mature", "flowering" -> "green"
    "fruiting" -> "green"
    "sapling" -> "amber"
    "seedling" -> "yellow"
    "harvesting" -> "red"
    else -> "neutral"
}

/**
 * True when CNN ripeness is ready to pick: **Red/Ripe** or **Overripe/Defective** (and thesis `ripe` / `overripe`).
 * Green/unripe and yellow/near-ripe are excluded.
 */
private fun gradeSuggestsHarvest(grade: String): Boolean {
    val g = grade.trim()
    if (g.isEmpty()) return false
    if (g in HARVESTABLE_RIPENESS_GRADES) return true
    return when (g.lowercase()) {
        "ripe", "overripe" -> true
        else -> false
    }
}

private val HARVESTABLE_RIPENESS_GRADES = setOf(
    "Red/Ripe",
    "Overripe/Defective",
)

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

/** Values from [RecordField] options shaped as `tree:{uuid}|label`. */
private fun parseBatchTreeOption(option: String): String? {
    val o = option.trim()
    if (o == "(No tree link)" || o.isEmpty()) return null
    if (!o.startsWith("tree:")) return null
    return o.removePrefix("tree:").substringBefore("|").trim()
}
