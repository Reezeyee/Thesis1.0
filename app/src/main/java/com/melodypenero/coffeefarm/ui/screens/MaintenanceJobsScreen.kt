package com.melodypenero.coffeefarm.ui.screens

import android.widget.Toast
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.melodypenero.coffeefarm.auth.AuthSession
import com.melodypenero.coffeefarm.data.repairs.RepairJobsRepository
import com.melodypenero.coffeefarm.domain.MAX_FIX_NOTE_CHARS
import com.melodypenero.coffeefarm.domain.RepairJob
import com.melodypenero.coffeefarm.domain.RepairKind
import com.melodypenero.coffeefarm.domain.RepairStatus
import com.melodypenero.coffeefarm.domain.isValidFixNote
import com.melodypenero.coffeefarm.domain.MAX_PARTS_PER_JOB
import com.melodypenero.coffeefarm.domain.MAX_PART_NAME_CHARS
import com.melodypenero.coffeefarm.domain.PartUsed
import com.melodypenero.coffeefarm.domain.parsePartsUsed
import com.melodypenero.coffeefarm.domain.partsSummary
import com.melodypenero.coffeefarm.domain.sanitizePartQuantity
import com.melodypenero.coffeefarm.ui.components.FarmCard
import com.melodypenero.coffeefarm.ui.components.FarmEmptyState
import com.melodypenero.coffeefarm.ui.components.FarmInfoBanner
import com.melodypenero.coffeefarm.ui.components.FarmLazyScreen
import com.melodypenero.coffeefarm.ui.components.FarmPrimaryButton
import com.melodypenero.coffeefarm.ui.components.FarmSectionTitle
import com.melodypenero.coffeefarm.ui.components.farmPalette
import com.melodypenero.coffeefarm.ui.components.farmTextFieldColors
import kotlinx.coroutines.launch

/**
 * Home screen for a signed-in Maintenance worker (replaces the field-tool dashboard): the repair jobs the admin
 * assigned to them -- which equipment or sprinkler, what the reporting worker said was wrong -- with buttons to
 * start a repair and to mark it fixed with a note. The admin is notified when a job is marked fixed.
 */
@Composable
fun MaintenanceJobsScreen(session: AuthSession) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var jobs by remember { mutableStateOf<List<RepairJob>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(session.userId) {
        RepairJobsRepository.observe(session.userId).collect { result ->
            loading = false
            result
                .onSuccess { jobs = it; error = null }
                .onFailure { error = "Couldn't load your repair jobs. Check your connection and try again." }
        }
    }

    MaintenanceJobsContent(
        workerName = session.displayName,
        jobs = jobs,
        loading = loading,
        error = error,
        saving = saving,
        onStart = { job ->
            scope.launch {
                saving = true
                runCatching { RepairJobsRepository.startRepair(job.jobId) }
                    .onFailure { Toast.makeText(context, "Couldn't update the job. Try again.", Toast.LENGTH_LONG).show() }
                saving = false
            }
        },
        onFixed = { job, note, parts ->
            scope.launch {
                saving = true
                runCatching { RepairJobsRepository.markFixed(job.jobId, note, parts) }
                    .onSuccess { Toast.makeText(context, "The admin has been told it's fixed.", Toast.LENGTH_SHORT).show() }
                    .onFailure { Toast.makeText(context, "Couldn't save. Your note wasn't sent -- try again.", Toast.LENGTH_LONG).show() }
                saving = false
            }
        }
    )
}

@Composable
fun MaintenanceJobsContent(
    workerName: String,
    jobs: List<RepairJob>,
    loading: Boolean,
    error: String?,
    onStart: (RepairJob) -> Unit,
    onFixed: (RepairJob, String, List<PartUsed>) -> Unit,
    saving: Boolean = false
) {
    val palette = farmPalette()
    val todo = jobs.filter { !it.isFixed }
    val fixed = jobs.filter { it.isFixed }
    var fixing by remember { mutableStateOf<RepairJob?>(null) }
    var note by remember { mutableStateOf("") }
    var partRows by remember { mutableStateOf(listOf("" to "")) }

    FarmLazyScreen {
        item {
            FarmSectionTitle(
                title = "My Repair Jobs",
                subtitle = when {
                    loading -> "Loading your repair jobs…"
                    todo.isEmpty() -> "Hi ${workerName.substringBefore(' ')}, nothing to repair right now."
                    else -> "Hi ${workerName.substringBefore(' ')} — ${todo.size} to repair"
                }
            )
        }
        if (error != null) item { FarmInfoBanner(text = error) }
        if (loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = palette.accent)
                }
            }
        } else if (jobs.isEmpty() && error == null) {
            item {
                FarmEmptyState(
                    title = "No repair jobs",
                    subtitle = "When the admin sends you a broken equipment or sprinkler report, it shows up here with what needs fixing.",
                    icon = Icons.Default.Build
                )
            }
        }
        if (todo.isNotEmpty()) {
            item { JobsLabel("To repair (${todo.size})") }
            items(todo.size) { i ->
                JobCard(todo[i], saving = saving, onStart = onStart, onFixed = { fixing = it; note = ""; partRows = listOf("" to "") })
            }
        }
        if (fixed.isNotEmpty()) {
            item { JobsLabel("Fixed (${fixed.size})") }
            items(fixed.size) { i ->
                JobCard(fixed[i], saving = saving, onStart = onStart, onFixed = {})
            }
        }
    }

    fixing?.let { job ->
        AlertDialog(
            onDismissRequest = { fixing = null },
            containerColor = palette.surface,
            title = { Text("Mark \"${job.title}\" as fixed?", color = palette.textPrimary, fontWeight = FontWeight.SemiBold) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Tell the admin what you did and which parts you used. They'll be notified right away.", color = palette.textSecondary)
                    OutlinedTextField(
                        value = note,
                        onValueChange = { note = it.take(MAX_FIX_NOTE_CHARS) },
                        label = { Text("What did you do?") },
                        placeholder = { Text("e.g. Replaced the cracked nozzle and tested it") },
                        supportingText = { Text("${note.trim().length} / $MAX_FIX_NOTE_CHARS") },
                        minLines = 3,
                        colors = farmTextFieldColors(),
                        modifier = Modifier.fillMaxWidth().testTag("fix-note")
                    )
                    Text("Parts / materials used (optional)", color = palette.textPrimary, fontWeight = FontWeight.SemiBold)
                    Text("e.g. 4 screws. The admin takes these out of the supplies.", style = MaterialTheme.typography.bodySmall, color = palette.textSecondary)
                    partRows.forEachIndexed { i, row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = row.first,
                                onValueChange = { v -> partRows = partRows.toMutableList().also { it[i] = v.take(MAX_PART_NAME_CHARS) to row.second } },
                                label = { Text("Part") },
                                singleLine = true,
                                colors = farmTextFieldColors(),
                                modifier = Modifier.weight(1f).testTag("part-name-$i")
                            )
                            OutlinedTextField(
                                value = row.second,
                                onValueChange = { v -> partRows = partRows.toMutableList().also { it[i] = row.first to sanitizePartQuantity(v) } },
                                label = { Text("Qty") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                colors = farmTextFieldColors(),
                                modifier = Modifier.width(84.dp).testTag("part-qty-$i")
                            )
                            if (partRows.size > 1) {
                                IconButton(onClick = { partRows = partRows.toMutableList().also { it.removeAt(i) } }, modifier = Modifier.testTag("part-remove-$i")) {
                                    Icon(Icons.Default.Close, contentDescription = "Remove part", tint = palette.textSecondary)
                                }
                            }
                        }
                    }
                    if (partRows.size < MAX_PARTS_PER_JOB) {
                        TextButton(onClick = { partRows = partRows + ("" to "") }, modifier = Modifier.testTag("add-part")) {
                            Text("+ Add another part", color = palette.accent)
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { parsePartsUsed(partRows)?.let { onFixed(job, note.trim(), it) }; fixing = null },
                    enabled = isValidFixNote(note) && parsePartsUsed(partRows) != null && !saving,
                    modifier = Modifier.testTag("confirm-fixed")
                ) {
                    val ready = isValidFixNote(note) && parsePartsUsed(partRows) != null
                    Text("Yes, it's fixed", color = if (ready) palette.accent else palette.textSecondary, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = { TextButton(onClick = { fixing = null }) { Text("Not yet", color = palette.textSecondary) } }
        )
    }
}

@Composable
private fun JobsLabel(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = farmPalette().textSecondary,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
private fun JobCard(job: RepairJob, saving: Boolean, onStart: (RepairJob) -> Unit, onFixed: (RepairJob) -> Unit) {
    val palette = farmPalette()
    FarmCard(modifier = Modifier.fillMaxWidth().testTag("job-${job.jobId}")) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(palette.accentContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        if (job.kind == RepairKind.SPRINKLER) Icons.Default.WaterDrop else Icons.Default.Build,
                        contentDescription = null, tint = palette.accent, modifier = Modifier.size(22.dp)
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(job.title, style = MaterialTheme.typography.titleMedium, color = palette.textPrimary, fontWeight = FontWeight.Bold)
                    Text(
                        listOf(job.kindLabel, job.subtitle).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.labelMedium, color = palette.textSecondary
                    )
                }
            }
            JobStatusChip(job)
        }

        // What is wrong
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(palette.accentContainer).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text("What's wrong", style = MaterialTheme.typography.labelMedium, color = palette.textSecondary)
            Text(job.details.ifBlank { "No details were given." }, style = MaterialTheme.typography.bodyMedium, color = palette.textPrimary)
        }
        Text(
            listOf(
                if (job.reportedBy.isNotBlank()) "Reported by ${job.reportedBy}" else "",
                job.reportedAt
            ).filter { it.isNotBlank() }.joinToString(" · "),
            style = MaterialTheme.typography.bodySmall, color = palette.textSecondary
        )

        when (job.status) {
            RepairStatus.ASSIGNED -> FarmPrimaryButton(text = "Start repair", onClick = { onStart(job) }, enabled = !saving, icon = Icons.Default.PlayArrow)
            RepairStatus.IN_PROGRESS -> FarmPrimaryButton(text = "Mark fixed", onClick = { onFixed(job) }, enabled = !saving, icon = Icons.Default.CheckCircle)
            else -> if (job.fixNote.isNotBlank()) {
                Text("You fixed it: ${job.fixNote}", style = MaterialTheme.typography.bodyMedium, color = palette.textPrimary)
                if (job.partsUsed.isNotEmpty()) Text("Parts used: ${partsSummary(job.partsUsed)}", style = MaterialTheme.typography.bodySmall, color = palette.textSecondary)
            }
        }
    }
}

@Composable
private fun JobStatusChip(job: RepairJob) {
    val (label, color) = when (job.status) {
        RepairStatus.FIXED -> "Fixed" to Color(0xFF84B626)
        RepairStatus.IN_PROGRESS -> "Repairing" to Color(0xFFE0A030)
        else -> "To do" to farmPalette().textSecondary
    }
    Text(
        label,
        color = color,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.15f)).padding(horizontal = 10.dp, vertical = 4.dp)
    )
}
