package com.melodypenero.coffeefarm.data.store

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.staticCompositionLocalOf
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.ListenerRegistration
import com.melodypenero.coffeefarm.data.firebase.FirebaseCollections
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.melodypenero.coffeefarm.domain.FarmFinance
import com.melodypenero.coffeefarm.domain.TreeRipeness
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

@Immutable
data class AppState(
    val workers: List<WorkerRecord> = emptyList(),
    val attendance: List<AttendanceRecord> = emptyList(),
    val tasks: List<TaskRecord> = emptyList(),
    @SerializedName(value = "sections", alternate = ["farmBlocks"])
    val sections: List<SectionRecord> = emptyList(),
    val trees: List<TreeRecord> = emptyList(),
    /** Per-tree cherry scan samples for averaged ripeness (see [TreeRipeness]). */
    val treeRipenessScans: List<TreeRipenessScanRecord> = emptyList(),
    val harvestSchedules: List<HarvestScheduleRecord> = emptyList(),
    val flowering: List<FloweringRecord> = emptyList(),
    val cherryHarvests: List<CherryHarvestRecord> = emptyList(),
    val batches: List<BatchRecord> = emptyList(),
    val cherryGrades: List<CherryGradeRecord> = emptyList(),
    val equipment: List<EquipmentRecord> = emptyList(),
    val usageLogs: List<UsageLogRecord> = emptyList(),
    val maintenanceLogs: List<MaintenanceRecord> = emptyList(),
    val sales: List<SaleRecord> = emptyList(),
    val expenses: List<ExpenseRecord> = emptyList(),
    val payroll: List<PayrollRecord> = emptyList()
)

data class WorkerRecord(
    val name: String,
    val roleRate: String,
    val details: String = "",
    val phoneNumber: String = "",
    val address: String = "",
    val emergencyContact: String = "",
    /** Optional stable id for payroll / reporting (e.g. W-12). */
    val workerId: String = ""
)
data class AttendanceRecord(
    val workerName: String,
    val details: String,
    val hoursWorked: Double? = null,
    val clockIn: String = "",
    val clockOut: String = "",
    /** ISO date or display date string */
    val date: String = "",
    val attendanceId: String = "",
    /** Logged from worker account; awaiting a payroll line from admin. */
    val awaitingPayrollLine: Boolean = false,
    val submittedByStaff: Boolean = false
)
data class TaskRecord(val title: String, val details: String, val status: String)
data class SectionRecord(val name: String, val details: String)
data class TreeRecord(
    @SerializedName(value = "sectionName", alternate = ["farmBlockName"])
    val sectionName: String,
    val details: String,
    val stage: String,
    /** Stable id for multi-scan tree ripeness and harvest batches. */
    val treeId: String = "",
)

/**
 * One cherry (or frame) classification attributed to a tree; many scans build the tree average.
 * [ripenessLabel] is [TreeRipeness] LABEL_* (unripe, semi-ripe, ripe).
 */
data class TreeRipenessScanRecord(
    val treeId: String,
    val ripenessLabel: String,
    val timestampMillis: Long,
    val sourceGrade: String? = null,
)
data class HarvestScheduleRecord(
    @SerializedName(value = "sectionName", alternate = ["farmBlockName"])
    val sectionName: String,
    val details: String,
    val status: String
)

data class FloweringRecord(
    @SerializedName(value = "sectionName", alternate = ["farmBlockName"])
    val sectionName: String,
    val details: String,
    val intensity: String
)
data class CherryHarvestRecord(
    val batchId: String,
    val pickerWorkerName: String? = null,
    val details: String,
    val weightText: String,
    val date: String? = null,
    val harvestId: String = "",
    val farmBlock: String = "",
    val qualityNotes: String = ""
)
data class BatchRecord(
    val batchId: String,
    val label: String,
    val status: String,
    val treeId: String? = null,
    val ripenessScore: Double? = null,
    val createdAtMillis: Long? = null,
)
/**
 * Strings are nullable so Gson / Firestore JSON with missing or null keys does not
 * leave fake non-null fields that crash on [String.isBlank] at runtime.
 */
data class CherryGradeRecord(
    val batchId: String? = null,
    val grade: String? = null,
    val confidence: String? = null,
    val species: String? = null,
    val speciesConfidence: String? = null,
    /** Wall-clock time when the scan was saved (Capture); 0 if unknown (legacy data). */
    val savedAtMillis: Long? = null,
    /** Optional link to [TreeRecord.treeId] when the scan is attributed to a tree. */
    val treeId: String? = null,
)

data class EquipmentRecord(
    val name: String,
    val category: String,
    val status: String,
    val assignedTo: String?,
    val currentValue: Int
)
data class UsageLogRecord(val equipmentName: String, val details: String, val hoursText: String)
data class MaintenanceRecord(
    val equipmentName: String,
    val details: String,
    val costText: String,
    val date: String? = null
)

data class SaleRecord(
    val buyer: String,
    val details: String,
    val date: String,
    val total: Int,
    /** product_type: cherry, green_bean, roasted (legacy: buyer, cafe) */
    val type: String,
    val saleId: String = "",
    val quantityKg: Double = 0.0,
    val pricePerKg: Double = 0.0,
    /** Optional link to a [BatchRecord] from Coffee Cherry. */
    val linkedBatchId: String = ""
)
data class ExpenseRecord(
    val category: String,
    val description: String,
    val amount: Int,
    val date: String? = null,
    val expenseId: String = "",
    /** Optional link to an [EquipmentRecord.name] from Equipment. */
    val linkedEquipmentName: String = ""
)
data class PayrollRecord(
    val workerName: String,
    val period: String,
    val amount: Int,
    val paid: Boolean,
    val date: String? = null,
    val workerId: String = "",
    val dailyRate: Double = 0.0,
    val daysWorked: Int = 0,
    val hourlyRate: Double = 0.0,
    val hoursWorked: Double = 0.0,
    val linkedAttendanceId: String = ""
)

enum class CloudSyncStatus {
    LOCAL_ONLY,
    CONNECTING,
    SYNCING,
    CONNECTED,
    /** Device offline or Firestore unreachable; data is stored locally and will upload when possible. */
    PENDING_UPLOAD,
    ERROR
}

class AppStore(context: Context) {
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private val prefs = context.getSharedPreferences("coffee_farm_store", Context.MODE_PRIVATE)
    private val gson = Gson()
    private var activeUserId: String? = null
    private var boundCloudUserId: String? = null
    private var userLastEditKey = "user_last_edit_wall_ms"
    private var firestoreClient: FirebaseFirestore? = null
    private var cloudListener: ListenerRegistration? = null
    private var networkSyncRegistered = false
    private var lastAutoSyncElapsedMs = 0L
    private var applyingCloudState = false
    private var initializationAttempted = false
    /** Use `val status by store.cloudSyncStatusState` in @Composable so the dashboard updates live. */
    val cloudSyncStatusState = mutableStateOf(CloudSyncStatus.LOCAL_ONLY)
    val cloudSyncStatus get() = cloudSyncStatusState.value
    val lastCloudSyncAtState = mutableStateOf<Long?>(null)
    val lastCloudSyncAt get() = lastCloudSyncAtState.value

    /** Use `val state by store.appState` in @Composable so the screen recomposes when data changes. */
    val appState = mutableStateOf(AppState())
    val state get() = appState.value

    /**
     * Local prefs key for the single farm dataset shared by admin + worker logins on this device.
     * Legacy keys `state_json_{uid}` are migrated on first load (see [loadState]).
     */
    private val localSharedStateKey = "state_json_farm"

    private fun stateJsonKey(): String? = activeUserId?.let { localSharedStateKey }

    /**
     * Call after a Firebase user signs in. Loads the shared farm snapshot and starts Firestore sync
     * under `app_state/farm`. Call with `null` on logout to detach cloud and clear memory.
     */
    fun setActiveUserId(userId: String?) {
        if (userId == activeUserId) return
        cloudListener?.remove()
        cloudListener = null
        boundCloudUserId = null
        activeUserId = userId
        val keyForEdit = if (userId == null) "user_last_edit_wall_ms" else "user_last_edit_${userId}_wall_ms"
        userLastEditKey = keyForEdit
        initializationAttempted = false
        if (userId == null) {
            appState.value = AppState()
            lastCloudSyncAtState.value = null
            cloudSyncStatusState.value = CloudSyncStatus.LOCAL_ONLY
        }
    }

    suspend fun initializeIfNeeded() {
        if (activeUserId.isNullOrBlank()) return
        if (initializationAttempted) return
        initializationAttempted = true

        val loadedState = withContext(Dispatchers.IO) {
            loadState()
        }
        appState.value = loadedState
        ensureCloudSyncConnected()
    }

    fun ensureCloudSyncConnected() {
        connectFirebaseIfAvailable()
    }

    /**
     * Connects to Firestore if needed and uploads the current [state] (same as after any local edit).
     * Use from Settings "Sync now"; safe to call repeatedly.
     */
    fun syncFirebaseNow() {
        if (FirebaseApp.getApps(appContext).isEmpty()) {
            cloudSyncStatusState.value = CloudSyncStatus.LOCAL_ONLY
            return
        }
        connectFirebaseIfAvailable()
        if (applyingCloudState) return
        syncFullStateToCloud(state)
    }

    private fun loadState(): AppState {
        val key = stateJsonKey() ?: return AppState()
        var json = prefs.getString(key, null)
        if (json.isNullOrBlank()) {
            val uid = activeUserId
            if (!uid.isNullOrBlank()) {
                val legacyKey = "state_json_$uid"
                val legacy = prefs.getString(legacyKey, null)
                if (!legacy.isNullOrBlank()) {
                    prefs.edit().putString(key, legacy).apply()
                    json = legacy
                }
            }
        }
        if (json.isNullOrBlank()) return AppState()
        val raw = runCatching { gson.fromJson(json, AppState::class.java) }.getOrElse { AppState() }
        val normalized = normalizeAppState(raw)
        // Persist once if migration added tree IDs or new list fields so the next cold start matches.
        if (normalized != raw) {
            prefs.edit().putString(key, gson.toJson(normalized)).apply()
        }
        return normalized
    }

    private fun normalizeAppState(state: AppState): AppState {
        @Suppress("UNNECESSARY_SAFE_CALL")
        var s = state.copy(treeRipenessScans = state.treeRipenessScans ?: emptyList())
        // First: trim hand-edited Firestore/JSON so section/stage/treeId line up for migration, fruiting, and links.
        s = s.copy(
            trees = s.trees.map { t ->
                TreeRecord(
                    sectionName = t.sectionName.trim(),
                    details = t.details.trim(),
                    stage = t.stage.trim(),
                    treeId = t.treeId.trim()
                )
            },
            treeRipenessScans = s.treeRipenessScans.map { r ->
                TreeRipenessScanRecord(
                    treeId = r.treeId.trim(),
                    ripenessLabel = r.ripenessLabel,
                    timestampMillis = r.timestampMillis,
                    sourceGrade = r.sourceGrade,
                )
            }
        )
        s = normalizeCherryGrades(s)
        s = migrateLegacyTreeIds(s)
        s = ensureTreeIds(s)
        s = normalizeHarvestIds(s)
        s = normalizeAttendanceRecords(s)
        return s
    }

    private fun normalizeAttendanceRecords(state: AppState): AppState = state.copy(
        attendance = state.attendance.map { sanitizeAttendanceRecord(it) }
    )

    /**
     * Gson/Firestore can deserialize JSON nulls into Kotlin non-null [String] fields; rebuild so no field stays null.
     * [awaitingPayrollLineOverride] when set replaces the stored flag without using [AttendanceRecord.copy], which
     * throws if Gson left null in non-null string fields.
     */
    private fun sanitizeAttendanceRecord(
        a: AttendanceRecord,
        awaitingPayrollLineOverride: Boolean? = null
    ): AttendanceRecord {
        val trimmedId = (a.attendanceId ?: "").trim()
        val id = if (trimmedId.isEmpty()) "ATT-${UUID.randomUUID().toString().take(8)}" else trimmedId
        return AttendanceRecord(
            workerName = (a.workerName ?: "").trim(),
            details = (a.details ?: "").trim(),
            hoursWorked = a.hoursWorked,
            clockIn = (a.clockIn ?: "").trim(),
            clockOut = (a.clockOut ?: "").trim(),
            date = (a.date ?: "").trim(),
            attendanceId = id,
            awaitingPayrollLine = awaitingPayrollLineOverride ?: (a.awaitingPayrollLine ?: false),
            submittedByStaff = a.submittedByStaff ?: false
        )
    }

    private fun normalizeHarvestIds(state: AppState): AppState = state.copy(
        cherryHarvests = state.cherryHarvests.mapIndexed { i, h ->
            if (h.harvestId.isNotBlank()) h
            else h.copy(harvestId = "HV-${h.batchId}-$i")
        }
    )

    /**
     * Replaces long legacy ids (e.g. UUID) with `tree-id-01` style ids and updates
     * scans, grades, and batch links that referenced the old id.
     */
    private fun migrateLegacyTreeIds(state: AppState): AppState {
        var max = maxTreeIdNumber(state.trees)
        val idMap = linkedMapOf<String, String>()
        val newTrees = state.trees.map { t ->
            val id = t.treeId.trim()
            when {
                id.isEmpty() -> t
                TREE_ID_PATTERN.matches(id) -> t
                else -> {
                    max += 1
                    val newId = formatTreeIdNumber(max)
                    idMap[id] = newId
                    t.copy(treeId = newId)
                }
            }
        }
        if (idMap.isEmpty()) return state
        return state.copy(
            trees = newTrees,
            treeRipenessScans = state.treeRipenessScans.map { r ->
                idMap[r.treeId]?.let { r.copy(treeId = it) } ?: r
            },
            cherryGrades = state.cherryGrades.map { g ->
                val tid = g.treeId?.trim() ?: return@map g
                idMap[tid]?.let { g.copy(treeId = it) } ?: g
            },
            batches = state.batches.map { b ->
                val tid = b.treeId?.trim() ?: return@map b
                idMap[tid]?.let { b.copy(treeId = it) } ?: b
            }
        )
    }

    private fun ensureTreeIds(state: AppState): AppState {
        if (state.trees.none { it.treeId.isBlank() }) return state
        var max = maxTreeIdNumber(state.trees)
        val withIds = state.trees.map { t ->
            if (t.treeId.isNotBlank()) t
            else {
                max += 1
                t.copy(treeId = formatTreeIdNumber(max))
            }
        }
        return state.copy(trees = withIds)
    }

    /** Max N from existing `tree-id-N` trees (ignores other id formats). */
    private fun maxTreeIdNumber(trees: List<TreeRecord>): Int {
        var max = 0
        for (t in trees) {
            TREE_ID_PATTERN
                .matchEntire(t.treeId.trim())
                ?.groupValues
                ?.getOrNull(1)
                ?.toIntOrNull()
                ?.let { n -> if (n > max) max = n }
        }
        return max
    }

    private fun formatTreeIdNumber(n: Int): String =
        if (n < 100) "tree-id-" + n.toString().padStart(2, '0') else "tree-id-$n"

    private fun allocateNextTreeId(trees: List<TreeRecord>): String =
        formatTreeIdNumber(maxTreeIdNumber(trees) + 1)

    /** Gson can deserialize null into [CherryGradeRecord] string fields; coerce before UI or save. */
    private fun normalizeCherryGrades(state: AppState): AppState = state.copy(
        cherryGrades = state.cherryGrades.map { g ->
            CherryGradeRecord(
                batchId = g.batchId ?: "",
                grade = g.grade ?: "",
                confidence = g.confidence ?: "",
                species = g.species ?: "",
                speciesConfidence = g.speciesConfidence ?: "",
                savedAtMillis = g.savedAtMillis ?: 0L,
                treeId = g.treeId?.trim()?.ifBlank { null },
            )
        }
    )

    private fun cherryGradeDedupeKey(g: CherryGradeRecord): String =
        listOf(
            g.batchId ?: "",
            g.grade ?: "",
            g.confidence ?: "",
            g.species ?: "",
            g.speciesConfidence ?: "",
            "${g.savedAtMillis ?: 0L}",
            g.treeId ?: "",
        ).joinToString("\u0001")

    /**
     * Firestore may deliver an older [stateJson] before the latest local write is visible.
     * Keep local cherry-grade rows that are not present in the remote snapshot so new saves are not lost.
     */
    private fun mergeCherryGradesWithRemote(local: List<CherryGradeRecord>, remote: List<CherryGradeRecord>): List<CherryGradeRecord> {
        val normalizedRemote = remote.map { g ->
            CherryGradeRecord(
                batchId = g.batchId ?: "",
                grade = g.grade ?: "",
                confidence = g.confidence ?: "",
                species = g.species ?: "",
                speciesConfidence = g.speciesConfidence ?: "",
                savedAtMillis = g.savedAtMillis ?: 0L,
                treeId = g.treeId?.ifBlank { null },
            )
        }
        val remoteKeys = normalizedRemote.mapTo(mutableSetOf()) { cherryGradeDedupeKey(it) }
        val normalizedLocal = local.map { g ->
            CherryGradeRecord(
                batchId = g.batchId ?: "",
                grade = g.grade ?: "",
                confidence = g.confidence ?: "",
                species = g.species ?: "",
                speciesConfidence = g.speciesConfidence ?: "",
                savedAtMillis = g.savedAtMillis ?: 0L,
                treeId = g.treeId?.ifBlank { null },
            )
        }
        val extras = normalizedLocal.filter { cherryGradeDedupeKey(it) !in remoteKeys }
        return normalizedRemote + extras
    }

    private fun mergeTreeRipenessScansWithRemote(
        local: List<TreeRipenessScanRecord>,
        remote: List<TreeRipenessScanRecord>
    ): List<TreeRipenessScanRecord> {
        fun key(r: TreeRipenessScanRecord) =
            listOf(r.treeId, "${r.timestampMillis}", r.ripenessLabel, r.sourceGrade ?: "").joinToString("\u0001")
        val remoteKeys = remote.mapTo(mutableSetOf()) { key(it) }
        val normalizedRemote = remote.map { r ->
            TreeRipenessScanRecord(
                treeId = r.treeId,
                ripenessLabel = r.ripenessLabel,
                timestampMillis = r.timestampMillis,
                sourceGrade = r.sourceGrade,
            )
        }
        val extras = local.filter { key(it) !in remoteKeys }
        return normalizedRemote + extras
    }

    private fun mergeRemoteStatePreservingLocalGrades(local: AppState, remoteState: AppState): AppState =
        remoteState.copy(
            cherryGrades = mergeCherryGradesWithRemote(local.cherryGrades, remoteState.cherryGrades),
            treeRipenessScans = mergeTreeRipenessScansWithRemote(local.treeRipenessScans, remoteState.treeRipenessScans)
        )

    /** Count of all list rows; used to avoid clobbering local data with an empty or stale cloud snapshot. */
    private fun AppState.totalItemCount(): Int =
        workers.size + attendance.size + tasks.size + sections.size + trees.size +
            harvestSchedules.size + flowering.size + cherryHarvests.size + batches.size + cherryGrades.size +
            treeRipenessScans.size +
            equipment.size + usageLogs.size + maintenanceLogs.size + sales.size + expenses.size + payroll.size

    private fun isEffectivelyEmpty(state: AppState): Boolean = state.totalItemCount() == 0

    /**
     * If cloud has no rows but this device has data, the snapshot is wrong or never synced.
     * Never replace local (merge would still wipe all non–cherry-grade lists; see mergeRemoteStatePreservingLocalGrades).
     */
    private fun shouldUploadLocalInsteadOfApplyingRemote(
        local: AppState,
        remote: AppState,
        serverUpdatedAtMs: Long,
    ): Boolean {
        if (isEffectivelyEmpty(remote) && !isEffectivelyEmpty(local)) return true
        if (isEffectivelyEmpty(local)) return false
        val lastUserEdit = prefs.getLong(userLastEditKey, 0L)
        // Local edits not yet reflected on server: avoid pulling an older, smaller snapshot.
        if (lastUserEdit > 0L && serverUpdatedAtMs > 0L && lastUserEdit > serverUpdatedAtMs + 1500L) {
            if (local.totalItemCount() > remote.totalItemCount()) return true
        }
        return false
    }

    private fun persist(next: AppState) {
        persist(next, pushToCloud = true)
    }

    private fun persist(next: AppState, pushToCloud: Boolean) {
        val safe = normalizeAppState(next)
        appState.value = safe
        val key = stateJsonKey()
        if (key == null) return
        val editor = prefs.edit().putString(key, gson.toJson(safe))
        if (!applyingCloudState) {
            editor.putLong(userLastEditKey, System.currentTimeMillis())
        }
        editor.apply()
        if (pushToCloud && !applyingCloudState) {
            syncFullStateToCloud(safe)
        }
    }

    fun addWorker(
        name: String,
        roleRate: String,
        details: String = "",
        phoneNumber: String = "",
        address: String = "",
        emergencyContact: String = "",
        workerId: String = ""
    ) = persist(
        state.copy(
            workers = state.workers + WorkerRecord(
                name = name,
                roleRate = roleRate,
                details = details,
                phoneNumber = phoneNumber,
                address = address,
                emergencyContact = emergencyContact,
                workerId = workerId.trim()
            )
        )
    )

    fun addAttendance(
        workerName: String,
        details: String,
        hoursWorked: Double? = null,
        clockIn: String = "",
        clockOut: String = "",
        date: String = "",
        staffSubmission: Boolean = false
    ) {
        val computed = FarmFinance.computeHoursFromClock(clockIn, clockOut)
        val hours = hoursWorked ?: computed
        val aid = "ATT-${UUID.randomUUID().toString().take(8)}"
        val awaiting = staffSubmission && hours != null && hours > 0
        persist(
            state.copy(
                attendance = state.attendance + AttendanceRecord(
                    workerName = workerName.trim(),
                    details = details.trim(),
                    hoursWorked = hours,
                    clockIn = clockIn.trim(),
                    clockOut = clockOut.trim(),
                    date = date.trim(),
                    attendanceId = aid,
                    awaitingPayrollLine = awaiting,
                    submittedByStaff = staffSubmission
                )
            )
        )
    }

    /**
     * Creates a pending payroll row from a worker-submitted attendance line (hourly × hours).
     */
    fun createPayrollFromAttendance(attendanceIndex: Int) {
        val att = state.attendance.getOrNull(attendanceIndex) ?: return
        if (!att.awaitingPayrollLine) return
        val hours = att.hoursWorked ?: return
        if (hours <= 0) return
        val worker = state.workers.find { it.name.equals(att.workerName.trim(), ignoreCase = true) }
        val hourly = FarmFinance.hourlyRateForWorkerRole(worker?.roleRate ?: "")
        if (hourly <= 0) return
        val workerId = worker?.workerId?.trim().orEmpty()
        val periodLabel = "${(att.date ?: "").ifBlank { "Date TBD" }} · ${(att.workerName ?: "").trim()}"
        val row = payrollRecordWithComputedAmount(
            workerName = (att.workerName ?: "").trim(),
            period = periodLabel,
            paid = false,
            date = (att.date ?: "").ifBlank { null },
            workerId = workerId,
            dailyRate = 0.0,
            daysWorked = 0,
            hourlyRate = hourly,
            hoursWorked = hours,
            linkedAttendanceId = att.attendanceId ?: ""
        )
        persist(
            state.copy(
                payroll = state.payroll + row,
                attendance = replaceAt(
                    state.attendance,
                    attendanceIndex,
                    sanitizeAttendanceRecord(att, awaitingPayrollLineOverride = false)
                )
            )
        )
    }

    private fun payrollRecordWithComputedAmount(
        workerName: String,
        period: String,
        paid: Boolean,
        date: String?,
        workerId: String,
        dailyRate: Double,
        daysWorked: Int,
        hourlyRate: Double,
        hoursWorked: Double,
        linkedAttendanceId: String
    ): PayrollRecord {
        val template = PayrollRecord(
            workerName = workerName,
            period = period,
            amount = 0,
            paid = paid,
            date = date,
            workerId = workerId.trim(),
            dailyRate = dailyRate,
            daysWorked = daysWorked,
            hourlyRate = hourlyRate,
            hoursWorked = hoursWorked,
            linkedAttendanceId = (linkedAttendanceId ?: "").trim()
        )
        return template.copy(amount = FarmFinance.payrollLineAmount(template))
    }

    fun addTask(title: String, details: String, status: String) =
        persist(state.copy(tasks = state.tasks + TaskRecord(title, details, status)))

    fun addSection(name: String, details: String) =
        persist(state.copy(sections = state.sections + SectionRecord(name, details)))

    fun addTree(sectionName: String, details: String, stage: String) =
        persist(
            state.copy(
                trees = state.trees + TreeRecord(
                    sectionName = sectionName,
                    details = details,
                    stage = stage,
                    treeId = allocateNextTreeId(state.trees)
                )
            )
        )

    fun addHarvestSchedule(sectionName: String, details: String, status: String) =
        persist(state.copy(harvestSchedules = state.harvestSchedules + HarvestScheduleRecord(sectionName, details, status)))

    fun addFlowering(sectionName: String, details: String, intensity: String) =
        persist(state.copy(flowering = state.flowering + FloweringRecord(sectionName, details, intensity)))

    fun addCherryHarvest(
        batchId: String,
        pickerWorkerName: String? = null,
        details: String,
        weightText: String,
        date: String = "",
        harvestId: String = "",
        farmBlock: String = "",
        qualityNotes: String = ""
    ) = persist(
        state.copy(
            cherryHarvests = state.cherryHarvests + CherryHarvestRecord(
                batchId = batchId,
                pickerWorkerName = pickerWorkerName,
                details = details,
                weightText = weightText,
                date = date,
                harvestId = harvestId.trim().ifBlank { "HV-${UUID.randomUUID().toString().take(8)}" },
                farmBlock = farmBlock.trim(),
                qualityNotes = qualityNotes.trim()
            )
        )
    )

    /**
     * @return false if a [treeId] was set but the tree is not a fruiting-stage tree, or is not yet eligible
     * (10+ scans and average score ≥ 0.80).
     */
    fun addBatch(
        batchId: String,
        label: String,
        status: String,
        treeId: String? = null,
        ripenessScore: Double? = null,
        createdAtMillis: Long? = null,
    ): Boolean {
        val id = batchId.trim()
        if (id.isEmpty()) return false
        if (state.batches.any { it.batchId.trim() == id }) return false
        val tid = treeId?.trim()?.takeIf { it.isNotEmpty() }
        var rScore = ripenessScore
        val at = createdAtMillis ?: System.currentTimeMillis()
        if (tid != null) {
            val tree = state.trees.find { it.treeId == tid } ?: return false
            if (!TreeRipeness.isFruitingStage(tree.stage)) return false
            val scans = state.treeRipenessScans.filter { it.treeId == tid }
            val avg = TreeRipeness.averageScore(scans)
            if (!TreeRipeness.canCreateHarvestBatch(avg, scans.size)) return false
            if (rScore == null) rScore = avg
        }
        persist(
            state.copy(
                batches = state.batches + BatchRecord(
                    batchId = id,
                    label = label.trim(),
                    status = status,
                    treeId = tid,
                    ripenessScore = rScore,
                    createdAtMillis = at
                )
            )
        )
        return true
    }

    private fun isTreeFruitingForCherryWork(treeId: String): Boolean {
        if (treeId.isBlank()) return false
        val tree = state.trees.find { it.treeId == treeId } ?: return false
        return TreeRipeness.isFruitingStage(tree.stage)
    }

    /**
     * Appends a per-tree sample for averaged ripeness. Call after a successful CNN read when attributing
     * the sample to [treeId]. Returns false if [TreeRipenessScanRecord.treeId] is not a fruiting tree.
     */
    fun addTreeRipenessScan(scan: TreeRipenessScanRecord): Boolean {
        if (!isTreeFruitingForCherryWork(scan.treeId)) return false
        persist(state.copy(treeRipenessScans = state.treeRipenessScans + scan))
        return true
    }

    fun treeRipenessScansForTree(treeId: String): List<TreeRipenessScanRecord> =
        state.treeRipenessScans
            .filter { it.treeId == treeId }
            .sortedBy { it.timestampMillis }

    fun treeRipenessAverage(treeId: String): Double? =
        TreeRipeness.averageScore(treeRipenessScansForTree(treeId))

    fun canCreateHarvestBatchForTree(treeId: String): Boolean {
        val tree = state.trees.find { it.treeId == treeId } ?: return false
        if (!TreeRipeness.isFruitingStage(tree.stage)) return false
        val scans = treeRipenessScansForTree(treeId)
        return TreeRipeness.canCreateHarvestBatch(TreeRipeness.averageScore(scans), scans.size)
    }

    /**
     * @return false if [treeId] is set but the tree is not in fruiting stage (cherry scan / harvest rules).
     */
    fun addCherryGrade(
        batchId: String,
        grade: String,
        confidence: String,
        species: String = "",
        speciesConfidence: String = "",
        treeId: String? = null,
    ): Boolean {
        val tid = treeId?.trim()?.takeIf { it.isNotEmpty() }
        if (tid != null && !isTreeFruitingForCherryWork(tid)) return false
        persist(
            state.copy(
                cherryGrades = state.cherryGrades + CherryGradeRecord(
                    batchId = batchId,
                    grade = grade,
                    confidence = confidence,
                    species = species,
                    speciesConfidence = speciesConfidence,
                    savedAtMillis = System.currentTimeMillis(),
                    treeId = tid,
                )
            )
        )
        return true
    }

    /**
     * One write for a capture save: [scan] and matching grade. Fails if the tree is not in fruiting stage.
     */
    fun addTreeRipenessScanWithCherryGrade(
        scan: TreeRipenessScanRecord,
        batchId: String,
        grade: String,
        confidence: String,
        species: String = "",
        speciesConfidence: String = "",
    ): Boolean {
        if (!isTreeFruitingForCherryWork(scan.treeId)) return false
        val tid = scan.treeId.trim().takeIf { it.isNotEmpty() }
        persist(
            state.copy(
                treeRipenessScans = state.treeRipenessScans + scan,
                cherryGrades = state.cherryGrades + CherryGradeRecord(
                    batchId = batchId,
                    grade = grade,
                    confidence = confidence,
                    species = species,
                    speciesConfidence = speciesConfidence,
                    savedAtMillis = System.currentTimeMillis(),
                    treeId = tid,
                )
            )
        )
        return true
    }

    /** Stable id for UI (matches merge/dedupe logic). */
    fun stableKeyForCherryGrade(g: CherryGradeRecord): String = cherryGradeDedupeKey(
        CherryGradeRecord(
            batchId = g.batchId ?: "",
            grade = g.grade ?: "",
            confidence = g.confidence ?: "",
            species = g.species ?: "",
            speciesConfidence = g.speciesConfidence ?: "",
            savedAtMillis = g.savedAtMillis ?: 0L,
            treeId = g.treeId?.ifBlank { null },
        )
    )

    fun deleteCherryGradeByKey(key: String) {
        val idx = state.cherryGrades.indexOfFirst { stableKeyForCherryGrade(it) == key }
        if (idx >= 0) persist(state.copy(cherryGrades = removeAt(state.cherryGrades, idx)))
    }

    fun addEquipment(name: String, category: String, status: String, assignedTo: String?, currentValue: Int) =
        persist(state.copy(equipment = state.equipment + EquipmentRecord(name, category, status, assignedTo, currentValue)))

    fun addUsageLog(equipmentName: String, details: String, hoursText: String) =
        persist(state.copy(usageLogs = state.usageLogs + UsageLogRecord(equipmentName, details, hoursText)))

    fun addMaintenance(equipmentName: String, details: String, costText: String, date: String = "") =
        persist(state.copy(maintenanceLogs = state.maintenanceLogs + MaintenanceRecord(equipmentName, details, costText, date)))

    fun addSale(
        buyer: String,
        details: String,
        date: String,
        total: Int,
        type: String,
        saleId: String = "",
        quantityKg: Double = 0.0,
        pricePerKg: Double = 0.0,
        linkedBatchId: String = ""
    ) = persist(
        state.copy(
            sales = state.sales + SaleRecord(
                buyer = buyer,
                details = details,
                date = date,
                total = FarmFinance.saleLineTotal(
                    SaleRecord(
                        buyer = buyer,
                        details = details,
                        date = date,
                        total = total,
                        type = type,
                        saleId = saleId,
                        quantityKg = quantityKg,
                        pricePerKg = pricePerKg,
                        linkedBatchId = linkedBatchId
                    )
                ),
                type = type,
                saleId = saleId.trim().ifBlank { "SL-${UUID.randomUUID().toString().take(8)}" },
                quantityKg = quantityKg,
                pricePerKg = pricePerKg,
                linkedBatchId = linkedBatchId.trim()
            )
        )
    )

    fun addExpense(
        category: String,
        description: String,
        amount: Int,
        date: String = "",
        expenseId: String = "",
        linkedEquipmentName: String = ""
    ) = persist(
        state.copy(
            expenses = state.expenses + ExpenseRecord(
                category = category,
                description = description,
                amount = amount,
                date = date,
                expenseId = expenseId.trim().ifBlank { "EX-${UUID.randomUUID().toString().take(8)}" },
                linkedEquipmentName = linkedEquipmentName.trim()
            )
        )
    )

    fun addPayroll(
        workerName: String,
        period: String,
        paid: Boolean,
        date: String = "",
        workerId: String = "",
        dailyRate: Double = 0.0,
        daysWorked: Int = 0,
        hourlyRate: Double = 0.0,
        hoursWorked: Double = 0.0,
        linkedAttendanceId: String = ""
    ) {
        val row = payrollRecordWithComputedAmount(
            workerName = workerName,
            period = period,
            paid = paid,
            date = date.ifBlank { null },
            workerId = workerId,
            dailyRate = dailyRate,
            daysWorked = daysWorked,
            hourlyRate = hourlyRate,
            hoursWorked = hoursWorked,
            linkedAttendanceId = linkedAttendanceId
        )
        val linked = (linkedAttendanceId ?: "").trim()
        val nextAttendance =
            if (linked.isNotEmpty()) {
                state.attendance.map { a ->
                    if ((a.attendanceId ?: "").trim() == linked) {
                        sanitizeAttendanceRecord(a, awaitingPayrollLineOverride = false)
                    } else {
                        a
                    }
                }
            } else {
                state.attendance
            }
        persist(state.copy(payroll = state.payroll + row, attendance = nextAttendance))
    }

    private fun <T> replaceAt(list: List<T>, index: Int, item: T): List<T> =
        list.mapIndexed { i, existing -> if (i == index) item else existing }

    private fun <T> removeAt(list: List<T>, index: Int): List<T> =
        list.filterIndexed { i, _ -> i != index }

    fun updateWorker(
        index: Int,
        name: String,
        roleRate: String,
        details: String = "",
        phoneNumber: String = "",
        address: String = "",
        emergencyContact: String = "",
        workerId: String = ""
    ) = persist(
        state.copy(
            workers = replaceAt(
                state.workers,
                index,
                WorkerRecord(
                    name = name,
                    roleRate = roleRate,
                    details = details,
                    phoneNumber = phoneNumber,
                    address = address,
                    emergencyContact = emergencyContact,
                    workerId = workerId.trim()
                )
            )
        )
    )
    fun deleteWorker(index: Int) = persist(state.copy(workers = removeAt(state.workers, index)))

    fun updateAttendance(
        index: Int,
        workerName: String,
        details: String,
        hoursWorked: Double? = null,
        clockIn: String = "",
        clockOut: String = "",
        date: String = "",
        awaitingPayrollLine: Boolean? = null,
        submittedByStaff: Boolean? = null
    ) {
        val prev = state.attendance.getOrNull(index) ?: return
        val computed = FarmFinance.computeHoursFromClock(clockIn, clockOut)
        val hours = hoursWorked ?: computed ?: prev.hoursWorked
        val aid = (prev.attendanceId ?: "").ifBlank { "ATT-${UUID.randomUUID().toString().take(8)}" }
        persist(
            state.copy(
                attendance = replaceAt(
                    state.attendance,
                    index,
                    AttendanceRecord(
                        workerName = workerName.trim(),
                        details = details.trim(),
                        hoursWorked = hours,
                        clockIn = clockIn.trim().ifBlank { prev.clockIn ?: "" },
                        clockOut = clockOut.trim().ifBlank { prev.clockOut ?: "" },
                        date = date.trim().ifBlank { prev.date ?: "" },
                        attendanceId = aid,
                        awaitingPayrollLine = awaitingPayrollLine ?: prev.awaitingPayrollLine,
                        submittedByStaff = submittedByStaff ?: prev.submittedByStaff
                    )
                )
            )
        )
    }
    fun deleteAttendance(index: Int) = persist(state.copy(attendance = removeAt(state.attendance, index)))

    fun updateTask(index: Int, title: String, details: String, status: String) =
        persist(state.copy(tasks = replaceAt(state.tasks, index, TaskRecord(title, details, status))))
    fun deleteTask(index: Int) = persist(state.copy(tasks = removeAt(state.tasks, index)))

    fun updateSection(index: Int, name: String, details: String) =
        persist(state.copy(sections = replaceAt(state.sections, index, SectionRecord(name, details))))
    fun deleteSection(index: Int) = persist(state.copy(sections = removeAt(state.sections, index)))

    fun updateTree(index: Int, sectionName: String, details: String, stage: String) {
        val existing = state.trees.getOrNull(index) ?: return
        val tid = existing.treeId.ifBlank { allocateNextTreeId(state.trees) }
        persist(
            state.copy(
                trees = replaceAt(
                    state.trees,
                    index,
                    TreeRecord(
                        sectionName = sectionName,
                        details = details,
                        stage = stage,
                        treeId = tid
                    )
                )
            )
        )
    }
    fun deleteTree(index: Int) = persist(state.copy(trees = removeAt(state.trees, index)))

    fun updateHarvestSchedule(index: Int, sectionName: String, details: String, status: String) =
        persist(
            state.copy(
                harvestSchedules = replaceAt(
                    state.harvestSchedules,
                    index,
                    HarvestScheduleRecord(sectionName, details, status)
                )
            )
        )
    fun deleteHarvestSchedule(index: Int) = persist(state.copy(harvestSchedules = removeAt(state.harvestSchedules, index)))

    fun updateFlowering(index: Int, sectionName: String, details: String, intensity: String) =
        persist(state.copy(flowering = replaceAt(state.flowering, index, FloweringRecord(sectionName, details, intensity))))
    fun deleteFlowering(index: Int) = persist(state.copy(flowering = removeAt(state.flowering, index)))

    fun updateCherryHarvest(
        index: Int,
        batchId: String,
        pickerWorkerName: String? = null,
        details: String,
        weightText: String,
        date: String = "",
        harvestId: String = "",
        farmBlock: String = "",
        qualityNotes: String = ""
    ) = persist(
        state.copy(
            cherryHarvests = replaceAt(
                state.cherryHarvests,
                index,
                CherryHarvestRecord(
                    batchId = batchId,
                    pickerWorkerName = pickerWorkerName,
                    details = details,
                    weightText = weightText,
                    date = date,
                    harvestId = harvestId.trim().ifBlank {
                        state.cherryHarvests.getOrNull(index)?.harvestId?.trim().orEmpty()
                            .ifBlank { "HV-${UUID.randomUUID().toString().take(8)}" }
                    },
                    farmBlock = farmBlock.trim(),
                    qualityNotes = qualityNotes.trim()
                )
            )
        )
    )
    fun deleteCherryHarvest(index: Int) = persist(state.copy(cherryHarvests = removeAt(state.cherryHarvests, index)))

    /**
     * @return false if the batch would link to a non-fruiting tree or one that does not meet harvest-batch scan rules.
     */
    fun updateBatch(
        index: Int,
        batchId: String,
        label: String,
        status: String,
        treeId: String? = null,
        ripenessScore: Double? = null,
        createdAtMillis: Long? = null,
    ): Boolean {
        val old = state.batches.getOrNull(index) ?: return false
        val newTreeId = treeId?.trim()?.ifBlank { null } ?: old.treeId
        // Only strict-check fruiting + scan score when the tree link is new or changed (allow label-only edits on legacy data).
        if (newTreeId != null && newTreeId != old.treeId) {
            val t = state.trees.find { it.treeId == newTreeId } ?: return false
            if (!TreeRipeness.isFruitingStage(t.stage)) return false
            val scans = state.treeRipenessScans.filter { it.treeId == newTreeId }
            val avg = TreeRipeness.averageScore(scans)
            if (!TreeRipeness.canCreateHarvestBatch(avg, scans.size)) return false
        }
        persist(
            state.copy(
                batches = replaceAt(
                    state.batches,
                    index,
                    BatchRecord(
                        batchId = batchId,
                        label = label,
                        status = status,
                        treeId = newTreeId,
                        ripenessScore = ripenessScore ?: old.ripenessScore,
                        createdAtMillis = createdAtMillis ?: old.createdAtMillis
                    )
                )
            )
        )
        return true
    }
    fun deleteBatch(index: Int) = persist(state.copy(batches = removeAt(state.batches, index)))

    fun updateEquipment(index: Int, name: String, category: String, status: String, assignedTo: String?, currentValue: Int) =
        persist(state.copy(equipment = replaceAt(state.equipment, index, EquipmentRecord(name, category, status, assignedTo, currentValue))))
    fun deleteEquipment(index: Int) = persist(state.copy(equipment = removeAt(state.equipment, index)))

    fun updateUsageLog(index: Int, equipmentName: String, details: String, hoursText: String) =
        persist(state.copy(usageLogs = replaceAt(state.usageLogs, index, UsageLogRecord(equipmentName, details, hoursText))))
    fun deleteUsageLog(index: Int) = persist(state.copy(usageLogs = removeAt(state.usageLogs, index)))

    fun updateMaintenance(index: Int, equipmentName: String, details: String, costText: String, date: String = "") =
        persist(state.copy(maintenanceLogs = replaceAt(state.maintenanceLogs, index, MaintenanceRecord(equipmentName, details, costText, date))))
    fun deleteMaintenance(index: Int) = persist(state.copy(maintenanceLogs = removeAt(state.maintenanceLogs, index)))

    fun updateSale(
        index: Int,
        buyer: String,
        details: String,
        date: String,
        total: Int,
        type: String,
        saleId: String = "",
        quantityKg: Double = 0.0,
        pricePerKg: Double = 0.0,
        linkedBatchId: String = ""
    ) = persist(
        state.copy(
            sales = replaceAt(
                state.sales,
                index,
                SaleRecord(
                    buyer = buyer,
                    details = details,
                    date = date,
                    total = FarmFinance.saleLineTotal(
                        SaleRecord(
                            buyer, details, date, total, type,
                            saleId, quantityKg, pricePerKg, linkedBatchId
                        )
                    ),
                    type = type,
                    saleId = saleId.trim().ifBlank { state.sales.getOrNull(index)?.saleId.orEmpty() }
                        .ifBlank { "SL-${UUID.randomUUID().toString().take(8)}" },
                    quantityKg = quantityKg,
                    pricePerKg = pricePerKg,
                    linkedBatchId = linkedBatchId.trim()
                )
            )
        )
    )
    fun deleteSale(index: Int) = persist(state.copy(sales = removeAt(state.sales, index)))

    fun updateExpense(
        index: Int,
        category: String,
        description: String,
        amount: Int,
        date: String = "",
        expenseId: String = "",
        linkedEquipmentName: String = ""
    ) = persist(
        state.copy(
            expenses = replaceAt(
                state.expenses,
                index,
                ExpenseRecord(
                    category = category,
                    description = description,
                    amount = amount,
                    date = date,
                    expenseId = expenseId.trim().ifBlank { state.expenses.getOrNull(index)?.expenseId.orEmpty() }
                        .ifBlank { "EX-${UUID.randomUUID().toString().take(8)}" },
                    linkedEquipmentName = linkedEquipmentName.trim()
                )
            )
        )
    )
    fun deleteExpense(index: Int) = persist(state.copy(expenses = removeAt(state.expenses, index)))

    fun updatePayroll(
        index: Int,
        workerName: String,
        period: String,
        paid: Boolean,
        date: String = "",
        workerId: String = "",
        hourlyRate: Double = 0.0,
        hoursWorked: Double = 0.0
    ) {
        val prev = state.payroll.getOrNull(index) ?: return
        val useHourly = hourlyRate > 0.0 && hoursWorked > 0.0
        persist(
            state.copy(
                payroll = replaceAt(
                    state.payroll,
                    index,
                    payrollRecordWithComputedAmount(
                        workerName = workerName,
                        period = period,
                        paid = paid,
                        date = date.ifBlank { null },
                        workerId = workerId,
                        dailyRate = if (useHourly) 0.0 else prev.dailyRate,
                        daysWorked = if (useHourly) 0 else prev.daysWorked,
                        hourlyRate = if (useHourly) hourlyRate else prev.hourlyRate,
                        hoursWorked = if (useHourly) hoursWorked else prev.hoursWorked,
                        linkedAttendanceId = prev.linkedAttendanceId ?: ""
                    )
                )
            )
        )
    }

    fun deletePayroll(index: Int) {
        val removed = state.payroll.getOrNull(index) ?: return
        val linked = (removed.linkedAttendanceId ?: "").trim()
        val nextAttendance =
            if (linked.isNotEmpty()) {
                state.attendance.map { a ->
                    val aid = a.attendanceId ?: ""
                    if (aid == linked && a.submittedByStaff == true) {
                        sanitizeAttendanceRecord(a, awaitingPayrollLineOverride = true)
                    } else {
                        a
                    }
                }
            } else {
                state.attendance
            }
        persist(state.copy(payroll = removeAt(state.payroll, index), attendance = nextAttendance))
    }

    private fun getFirestore(): FirebaseFirestore? {
        if (FirebaseApp.getApps(appContext).isEmpty()) return null
        if (firestoreClient == null) {
            firestoreClient = runCatching { FirebaseFirestore.getInstance() }.getOrNull()
        }
        return firestoreClient
    }

    private fun connectFirebaseIfAvailable() {
        if (FirebaseApp.getApps(appContext).isEmpty()) {
            cloudSyncStatusState.value = CloudSyncStatus.LOCAL_ONLY
            return
        }
        val uid = activeUserId
        if (uid.isNullOrBlank()) {
            cloudSyncStatusState.value = CloudSyncStatus.LOCAL_ONLY
            return
        }
        if (boundCloudUserId == uid && cloudListener != null) return
        val db = getFirestore() ?: run {
            cloudSyncStatusState.value = CloudSyncStatus.ERROR
            return
        }
        cloudSyncStatusState.value = CloudSyncStatus.CONNECTING
        // Offline persistence is enabled by default on Android; writes queue locally and sync when online.
        registerAutoSyncWhenOnline()
        cloudListener?.remove()
        boundCloudUserId = uid
        val farmId = FirebaseCollections.SHARED_FARM_DOCUMENT_ID
        val docRef = db.collection(FirebaseCollections.APP_STATE).document(farmId)

        cloudListener = docRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                cloudSyncStatusState.value = CloudSyncStatus.ERROR
                return@addSnapshotListener
            }
            cloudSyncStatusState.value = CloudSyncStatus.CONNECTED
            val s = snapshot ?: return@addSnapshotListener
            val serverUpdatedAt = s.getLong("updatedAt") ?: 0L
            val remoteJson = s.getString("stateJson") ?: return@addSnapshotListener
            val currentJson = gson.toJson(state)
            if (remoteJson == currentJson) return@addSnapshotListener
            val remoteState = runCatching { gson.fromJson(remoteJson, AppState::class.java) }.getOrNull() ?: return@addSnapshotListener
            if (shouldUploadLocalInsteadOfApplyingRemote(state, remoteState,    serverUpdatedAt)) {
                if (!applyingCloudState) syncFullStateToCloud(state)
                return@addSnapshotListener
            }
            applyingCloudState = true
            persist(mergeRemoteStatePreservingLocalGrades(state, remoteState), pushToCloud = false)
            applyingCloudState = false
        }

        docRef.get().addOnSuccessListener { snapshot ->
            cloudSyncStatusState.value = CloudSyncStatus.CONNECTED
            val serverUpdatedAt = snapshot.getLong("updatedAt") ?: 0L
            val remoteJson = snapshot.getString("stateJson")
            if (remoteJson.isNullOrBlank()) {
                syncFullStateToCloud(state)
            } else {
                val remoteState = runCatching { gson.fromJson(remoteJson, AppState::class.java) }.getOrNull()
                if (remoteState != null && remoteJson != gson.toJson(state)) {
                    if (shouldUploadLocalInsteadOfApplyingRemote(state, remoteState, serverUpdatedAt)) {
                        if (!applyingCloudState) syncFullStateToCloud(state)
                    } else {
                        applyingCloudState = true
                        persist(mergeRemoteStatePreservingLocalGrades(state, remoteState), pushToCloud = false)
                        applyingCloudState = false
                    }
                }
            }
        }.addOnFailureListener {
            cloudSyncStatusState.value = CloudSyncStatus.ERROR
        }
    }

    /**
     * Writes the full [AppState] snapshot to Firestore (`app_state/farm`). Called after every
     * domain change so admin and worker accounts stay aligned. Retries [connectFirebaseIfAvailable]
     * when the client was not connected yet (e.g. first save after cold start).
     */
    private fun syncFullStateToCloud(next: AppState) {
        if (FirebaseApp.getApps(appContext).isEmpty()) {
            cloudSyncStatusState.value = CloudSyncStatus.LOCAL_ONLY
            return
        }
        if (activeUserId.isNullOrBlank()) {
            cloudSyncStatusState.value = CloudSyncStatus.LOCAL_ONLY
            return
        }
        if (getFirestore() == null) {
            connectFirebaseIfAvailable()
        }
        val db = getFirestore()
        val uid = activeUserId
        if (db == null || uid.isNullOrBlank()) {
            cloudSyncStatusState.value = CloudSyncStatus.ERROR
            return
        }
        cloudSyncStatusState.value = CloudSyncStatus.SYNCING
        val now = System.currentTimeMillis()
        val batch = db.batch()
        val farmId = FirebaseCollections.SHARED_FARM_DOCUMENT_ID
        val mainRef = db.collection(FirebaseCollections.APP_STATE).document(farmId)
        batch.set(
            mainRef,
            mapOf(
                "stateJson" to gson.toJson(next),
                "updatedAt" to now
            )
        )

        fun mirrorList(collectionName: String, itemsJson: String, itemCount: Int) {
            val ref = db
                .collection(FirebaseCollections.USER_DATA)
                .document(farmId)
                .collection(collectionName)
                .document(FirebaseCollections.ENTITY_SNAPSHOT_DOC_ID)
            batch.set(
                ref,
                mapOf(
                    "itemsJson" to itemsJson,
                    "itemCount" to itemCount,
                    "updatedAt" to now
                )
            )
        }

        mirrorList(FirebaseCollections.WORKERS, gson.toJson(next.workers), next.workers.size)
        mirrorList(FirebaseCollections.ATTENDANCE, gson.toJson(next.attendance), next.attendance.size)
        mirrorList(FirebaseCollections.TASKS, gson.toJson(next.tasks), next.tasks.size)
        mirrorList(FirebaseCollections.FARM_SECTIONS, gson.toJson(next.sections), next.sections.size)
        mirrorList(FirebaseCollections.TREES, gson.toJson(next.trees), next.trees.size)
        mirrorList(FirebaseCollections.HARVEST_SCHEDULES, gson.toJson(next.harvestSchedules), next.harvestSchedules.size)
        mirrorList(FirebaseCollections.FLOWERING, gson.toJson(next.flowering), next.flowering.size)
        mirrorList(FirebaseCollections.HARVEST_RECORDS, gson.toJson(next.cherryHarvests), next.cherryHarvests.size)
        mirrorList(FirebaseCollections.BATCHES, gson.toJson(next.batches), next.batches.size)
        mirrorList(FirebaseCollections.CNN_CLASSIFICATIONS, gson.toJson(next.cherryGrades), next.cherryGrades.size)
        mirrorList(FirebaseCollections.EQUIPMENT, gson.toJson(next.equipment), next.equipment.size)
        mirrorList(FirebaseCollections.EQUIPMENT_USAGE, gson.toJson(next.usageLogs), next.usageLogs.size)
        mirrorList(FirebaseCollections.MAINTENANCE_LOGS, gson.toJson(next.maintenanceLogs), next.maintenanceLogs.size)
        mirrorList(FirebaseCollections.SALES, gson.toJson(next.sales), next.sales.size)
        mirrorList(FirebaseCollections.EXPENSES, gson.toJson(next.expenses), next.expenses.size)
        mirrorList(FirebaseCollections.PAYROLL, gson.toJson(next.payroll), next.payroll.size)

        batch
            .commit()
            .addOnSuccessListener {
                lastCloudSyncAtState.value = System.currentTimeMillis()
                cloudSyncStatusState.value = CloudSyncStatus.CONNECTED
            }
            .addOnFailureListener { e ->
                cloudSyncStatusState.value = when ((e as? FirebaseFirestoreException)?.code) {
                    FirebaseFirestoreException.Code.UNAVAILABLE,
                    FirebaseFirestoreException.Code.DEADLINE_EXCEEDED -> CloudSyncStatus.PENDING_UPLOAD
                    else -> CloudSyncStatus.ERROR
                }
            }
    }

    private fun registerAutoSyncWhenOnline() {
        if (networkSyncRegistered) return
        networkSyncRegistered = true
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        cm.registerDefaultNetworkCallback(
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    mainHandler.post {
                        if (FirebaseApp.getApps(appContext).isEmpty()) return@post
                        if (applyingCloudState) return@post
                        if (!isDeviceOnline(appContext)) return@post
                        val now = SystemClock.elapsedRealtime()
                        if (now - lastAutoSyncElapsedMs < 2500L) return@post
                        lastAutoSyncElapsedMs = now
                        syncFullStateToCloud(state)
                    }
                }
            }
        )
    }

    private companion object {
        val TREE_ID_PATTERN: Regex = Regex("^tree-id-(\\d+)$", RegexOption.IGNORE_CASE)
    }
}

/** True when the device reports validated internet (Wi‑Fi or mobile data). */
fun isDeviceOnline(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}

val LocalAppStore = staticCompositionLocalOf<AppStore> {
    error("AppStore not provided")
}
