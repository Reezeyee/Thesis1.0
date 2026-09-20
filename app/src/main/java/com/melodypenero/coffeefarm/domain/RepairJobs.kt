package com.melodypenero.coffeefarm.domain

import com.melodypenero.coffeefarm.data.store.WorkerRecord

/** Kinds of report the admin can turn into a repair job. Add another here (and on the website) to support more. */
object RepairKind {
    const val EQUIPMENT = "equipment"
    const val SPRINKLER = "sprinkler"
}

/** Progress a Maintenance worker reports on a job. `assigned` is set by the admin; the worker sets the other two. */
object RepairStatus {
    const val ASSIGNED = "assigned"
    const val IN_PROGRESS = "in_progress"
    const val FIXED = "fixed"
}

/** A fixed job needs a note saying what was done; firestore.rules enforces the same 1-500 character limit. */
const val MAX_FIX_NOTE_CHARS = 500

fun isValidFixNote(note: String): Boolean = note.trim().let { it.isNotEmpty() && it.length <= MAX_FIX_NOTE_CHARS }

/** A part or material the worker used up in a repair (e.g. 4 screws); the admin deducts it from the supplies. */
data class PartUsed(val name: String, val quantity: Double)

const val MAX_PARTS_PER_JOB = 10
const val MAX_PART_NAME_CHARS = 60
const val MAX_PART_QUANTITY = 100_000.0

/**
 * Keeps only what a quantity can contain while typing or pasting: digits and one decimal point, at most 2 decimals
 * and 6 whole digits. Letters, symbols, commas, minus signs and a second "." are dropped.
 */
fun sanitizePartQuantity(raw: String): String {
    val cleaned = raw.filter { it in '0'..'9' || it == '.' }
    val dot = cleaned.indexOf('.')
    if (dot < 0) return cleaned.take(6)
    val whole = cleaned.substring(0, dot).take(6)
    val decimals = cleaned.substring(dot + 1).filter { it != '.' }.take(2)
    return "$whole.$decimals"
}

/** The typed quantity, or null if it isn't more than 0 and at most [MAX_PART_QUANTITY]. */
fun parsePartQuantity(text: String): Double? {
    val v = text.trim().takeIf { it.isNotEmpty() && it != "." }?.toDoubleOrNull() ?: return null
    return v.takeIf { it > 0.0 && it <= MAX_PART_QUANTITY }
}

/**
 * Turns the rows typed in the fix dialog (name, quantity) into the parts to send. Fully blank rows are ignored.
 * Returns null while any other row is incomplete or invalid (a name without a valid quantity, or a quantity
 * without a name) -- the dialog keeps "Yes, it's fixed" disabled until that is sorted out.
 */
fun parsePartsUsed(rows: List<Pair<String, String>>): List<PartUsed>? {
    val parts = mutableListOf<PartUsed>()
    for ((rawName, rawQty) in rows) {
        val name = rawName.trim().replace(Regex("\\s+"), " ")
        if (name.isEmpty() && rawQty.isBlank()) continue
        val qty = parsePartQuantity(rawQty)
        if (name.isEmpty() || name.length > MAX_PART_NAME_CHARS || qty == null) return null
        parts += PartUsed(name, qty)
    }
    return if (parts.size <= MAX_PARTS_PER_JOB) parts else null
}

/** "4 × Screw, 1 × Nozzle" -- how a list of parts reads on a card. */
fun partsSummary(parts: List<PartUsed>): String =
    parts.joinToString(", ") { "${formatPartQuantity(it.quantity)} × ${it.name}" }

fun formatPartQuantity(q: Double): String = if (q == Math.floor(q)) q.toLong().toString() else "%.2f".format(java.util.Locale.US, q).trimEnd('0').trimEnd('.')

/**
 * A repair job assigned to the signed-in Maintenance worker (a `repair_jobs` document). It carries a copy of
 * the report -- the worker can't read other workers' private report documents -- so everything they need to
 * know what to fix is here.
 */
data class RepairJob(
    val jobId: String,
    val kind: String,
    val reportId: String,
    /** Equipment name or sprinkler label. */
    val title: String,
    /** e.g. "Broken / wrecked" or "Zone: Zone B". */
    val subtitle: String,
    /** What the reporting worker said was wrong. */
    val details: String,
    val reportedBy: String,
    val reportedAt: String,
    val assignedToName: String,
    val assignedAt: String,
    val status: String,
    val startedAt: String,
    val fixedAt: String,
    val fixNote: String,
    /** Parts / materials the worker reported using; the admin deducts them from the supplies. */
    val partsUsed: List<PartUsed> = emptyList()
) {
    val isFixed: Boolean get() = status == RepairStatus.FIXED
    val kindLabel: String get() = if (kind == RepairKind.SPRINKLER) "Sprinkler" else "Equipment"
}

/** Builds a [RepairJob] from a raw Firestore document map. Tolerant of missing fields. */
fun parseRepairJob(jobId: String, data: Map<String, Any?>): RepairJob {
    fun str(key: String) = data[key]?.toString().orEmpty()
    return RepairJob(
        jobId = jobId,
        kind = str("kind").ifBlank { RepairKind.EQUIPMENT },
        reportId = str("reportId"),
        title = str("title").ifBlank { "Repair job" },
        subtitle = str("subtitle"),
        details = str("details"),
        reportedBy = str("reportedBy"),
        reportedAt = str("reportedAt"),
        assignedToName = str("assignedToName"),
        assignedAt = str("assignedAt"),
        status = str("status").ifBlank { RepairStatus.ASSIGNED },
        startedAt = str("startedAt"),
        fixedAt = str("fixedAt"),
        fixNote = str("fixNote"),
        partsUsed = (data["partsUsed"] as? List<*>).orEmpty().mapNotNull { item ->
            val m = item as? Map<*, *> ?: return@mapNotNull null
            val name = m["name"]?.toString()?.trim().orEmpty()
            val qty = (m["quantity"] as? Number)?.toDouble()
            if (name.isEmpty() || qty == null || qty <= 0.0) null else PartUsed(name, qty)
        }
    )
}

/** Jobs to do first (already-started ones on top, then oldest assignment first); fixed jobs after, newest first. */
fun sortRepairJobs(jobs: List<RepairJob>): List<RepairJob> {
    val (done, todo) = jobs.partition { it.isFixed }
    val ordered = todo.sortedWith(
        compareBy<RepairJob> { if (it.status == RepairStatus.IN_PROGRESS) 0 else 1 }.thenBy { it.assignedAt }
    )
    return ordered + done.sortedByDescending { it.fixedAt.ifBlank { it.assignedAt } }
}

/**
 * The worker record for this login if -- and only if -- they are an active Maintenance worker. Matched by the login's
 * Firebase uid (set when the admin created the worker account) or the account email.
 */
fun findMaintenanceWorker(userId: String, email: String, workers: List<WorkerRecord>): WorkerRecord? =
    workers.firstOrNull { w ->
        w.isActive && FarmFinance.isMaintenanceRole(w.roleRate) &&
            ((w.authUid.isNotBlank() && w.authUid == userId) ||
                (w.accountEmail.isNotBlank() && w.accountEmail.equals(email.trim(), ignoreCase = true)))
    }
