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
    val timesheetCorrections: List<TimesheetCorrectionRequest> = emptyList(),
    val leaveRequests: List<LeaveRequestRecord> = emptyList(),
    val tasks: List<TaskRecord> = emptyList(),
    @SerializedName(value = "sections", alternate = ["farmBlocks"])
    val sections: List<SectionRecord> = emptyList(),
    val trees: List<TreeRecord> = emptyList(),
    /** Per-tree cherry scan samples for averaged ripeness (see [TreeRipeness]). */
    val treeRipenessScans: List<TreeRipenessScanRecord> = emptyList(),
    val harvestSchedules: List<HarvestScheduleRecord> = emptyList(),
    val harvestReadinessReports: List<HarvestReadinessReportRecord> = emptyList(),
    val flowering: List<FloweringRecord> = emptyList(),
    val cherryHarvests: List<CherryHarvestRecord> = emptyList(),
    val batches: List<BatchRecord> = emptyList(),
    val cherryGrades: List<CherryGradeRecord> = emptyList(),
    val equipment: List<EquipmentRecord> = emptyList(),
    val usageLogs: List<UsageLogRecord> = emptyList(),
    val maintenanceLogs: List<MaintenanceRecord> = emptyList(),
    val equipmentReports: List<EquipmentConditionReport> = emptyList(),
    val sales: List<SaleRecord> = emptyList(),
    val expenses: List<ExpenseRecord> = emptyList(),
    val payroll: List<PayrollRecord> = emptyList(),
    val coffeeFields: List<CoffeeFieldRecord> = emptyList(),
    val irrigationSystems: List<IrrigationSystemRecord> = emptyList(),
    /** Worker-submitted damage reports for sprinklers/zones (visible to admins on the website). */
    val irrigationDamageReports: List<IrrigationDamageReportRecord> = emptyList(),
    val pestControlLogs: List<PestControlRecord> = emptyList(),
    val consumableSupplies: List<ConsumableSupplyRecord> = emptyList(),
    val consumableReports: List<ConsumableSupplyReportRecord> = emptyList(),
    val smsMessages: List<SmsMessageRecord> = emptyList()
)

data class TimesheetAuditEntry(
    val actorName: String = "",
    val action: String = "",
    val remarks: String = "",
    val timestamp: String = ""
)

data class TimesheetCorrectionRequest(
    val correctionId: String = "",
    val attendanceId: String = "",
    val workerName: String = "",
    val date: String = "",
    val field: String = "both",
    val originalClockIn: String = "",
    val originalClockOut: String = "",
    val requestedClockIn: String = "",
    val requestedClockOut: String = "",
    val reason: String = "",
    val status: String = "Pending",
    val submittedAt: String = "",
    val submittedBy: String = "",
    val reviewedAt: String = "",
    val reviewedBy: String = "",
    val managerRemarks: String = "",
    val auditTrail: List<TimesheetAuditEntry> = emptyList()
)

data class LeaveRequestRecord(
    val leaveId: String = "",
    val workerName: String = "",
    val leaveType: String = "Sick Leave",
    val startDate: String = "",
    val endDate: String = "",
    val leaveDays: Int = 1,
    val reason: String = "",
    val status: String = "Pending",
    val submittedAt: String = "",
    val submittedBy: String = "",
    val reviewedAt: String = "",
    val reviewedBy: String = "",
    val managerRemarks: String = ""
)

data class SmsMessageRecord(
    val messageId: String = "",
    val senderName: String = "",
    val senderRole: String = "", // "Admin" or "Worker"
    val recipientName: String = "",
    val recipientPhoneNumber: String = "",
    val messageBody: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    val sentViaCellularSms: Boolean = false
)

data class WorkerRecord(
    val name: String,
    val roleRate: String,
    val details: String = "",
    val phoneNumber: String = "",
    val address: String = "",
    val emergencyContact: String = "",
    /** Optional stable id for payroll / reporting (e.g. W-12). */
    val workerId: String = "",
    val birthday: String = "",
    val sex: String = "",
    /** Firebase Auth email generated by the web admin when creating the worker account. */
    val accountEmail: String = "",
    /** Temporary password generated by the web admin for the worker's first mobile sign-in. */
    val accountPassword: String = "",
    val authUid: String = ""
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
    val submittedByStaff: Boolean = false,
    val timeInLatitude: Double? = null,
    val timeInLongitude: Double? = null,
    val timeInLocationName: String = "",
    val faceSnapshotBase64: String = "",
    val isGeofenceVerified: Boolean? = null
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

data class HarvestReadinessReportRecord(
    val reportId: String = "",
    val zone: String = "",
    val expectedWeight: String = "",
    val reportedBy: String = "",
    val reportedAt: String = "",
    val status: String = "Pending Review",
    val notes: String = "",
    val reviewedAt: String = "",
    val reviewedBy: String = ""
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
    /** Worker account that saved the mobile scan, when signed in from a generated employee login. */
    val scannedByWorkerName: String? = null,
    val scannedByEmail: String? = null,
    val scannedByAuthUid: String? = null,
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

/** Worker-submitted wreck / OK / fixed report; synced to the admin website. */
data class EquipmentConditionReport(
    val reportId: String = "",
    val equipmentName: String,
    val isWrecked: Boolean,
    val notes: String = "",
    val reportedAt: String = "",
    val reportedBy: String? = null,
    val reviewed: Boolean = false,
    val isFixedReport: Boolean = false,
    val fixedAt: String? = null,
    val fixedBy: String? = null
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

data class CoffeeFieldRecord(
    val fieldId: String = "",
    val name: String,
    val area: String,
    val trees: Int = 0,
    val status: String,
    val variety: String,
    val age: String,
    val nextHarvest: String,
    val productivity: Int = 0,
    val lat: Double? = null,
    val lng: Double? = null
)

data class IrrigationSystemRecord(
    val irrigationId: String = "",
    val zone: String,
    val type: String,
    val status: String,
    val coverage: String,
    val efficiency: Int = 0,
    val lastMaintenance: String
)

data class IrrigationDamageReportRecord(
    val reportId: String = "",
    /** Links to [IrrigationSystemRecord.irrigationId] when available. */
    val irrigationId: String = "",
    /** Human-friendly zone label for admin visibility even if the irrigation record changes later. */
    val zone: String = "",
    /** Worker-entered identifier (e.g. "Sprinkler #12" / "Near gate"). */
    val sprinklerLabel: String,
    val details: String,
    /** ISO date string (yyyy-MM-dd). */
    val reportedAt: String,
    /** Free-form worker name for display in admin portal. */
    val reportedBy: String,
    /** Firebase auth uid when available (for audit / linking). */
    val reportedByAuthUid: String = "",
    /** Admin status (e.g. Pending / Resolved). */
    val status: String = "Pending"
)

data class PestControlRecord(
    val pestControlId: String = "",
    val date: String,
    val field: String,
    val issue: String,
    val treatment: String,
    val status: String
)

data class ConsumableSupplyRecord(
    val supplyId: String = "",
    val name: String,
    val category: String,
    val stock: Int = 0,
    val unit: String,
    val status: String,
    val lastRestocked: String
)

/** Worker-submitted consumable availability report; admins review it on the website. */
data class ConsumableSupplyReportRecord(
    val reportId: String = "",
    val supplyId: String = "",
    val supplyName: String,
    val isRunOut: Boolean,
    val notes: String = "",
    val reportedAt: String = "",
    val reportedBy: String = "",
    val reportedByAuthUid: String = "",
    val reviewed: Boolean = false,
    val reviewedAt: String = "",
    val reviewedBy: String = ""
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
    val activeAuthUid: String? get() = activeUserId
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
        var s = state.copy(
            treeRipenessScans = state.treeRipenessScans ?: emptyList(),
            harvestReadinessReports = state.harvestReadinessReports ?: emptyList(),
            irrigationDamageReports = state.irrigationDamageReports ?: emptyList(),
            consumableSupplies = state.consumableSupplies ?: emptyList(),
            consumableReports = state.consumableReports ?: emptyList(),
            smsMessages = state.smsMessages ?: emptyList()
        )
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
        s = normalizeHarvestReadinessReports(s)
        s = normalizeWorkers(s)
        s = normalizePayrollRecords(s)
        s = normalizeIrrigationDamageReports(s)
        s = normalizeConsumableReports(s)
        s = normalizeSmsMessages(s)
        return s
    }

    private fun normalizeSmsMessages(state: AppState): AppState = state.copy(
        smsMessages = state.smsMessages.map { m ->
            SmsMessageRecord(
                messageId = (m.messageId ?: "").trim(),
                senderName = (m.senderName ?: "").trim(),
                senderRole = (m.senderRole ?: "").trim(),
                recipientName = (m.recipientName ?: "").trim(),
                recipientPhoneNumber = (m.recipientPhoneNumber ?: "").trim(),
                messageBody = (m.messageBody ?: "").trim(),
                timestamp = m.timestamp,
                sentViaCellularSms = m.sentViaCellularSms ?: false
            )
        }
    )

    private fun normalizeConsumableReports(state: AppState): AppState = state.copy(
        consumableReports = state.consumableReports.map { r ->
            ConsumableSupplyReportRecord(
                reportId = (r.reportId ?: "").trim(),
                supplyId = (r.supplyId ?: "").trim(),
                supplyName = (r.supplyName ?: "").trim(),
                isRunOut = r.isRunOut ?: false,
                notes = (r.notes ?: "").trim(),
                reportedAt = (r.reportedAt ?: "").trim(),
                reportedBy = (r.reportedBy ?: "").trim(),
                reportedByAuthUid = (r.reportedByAuthUid ?: "").trim(),
                reviewed = r.reviewed ?: false,
                reviewedAt = (r.reviewedAt ?: "").trim(),
                reviewedBy = (r.reviewedBy ?: "").trim()
            )
        }
    )

    private fun normalizeIrrigationDamageReports(state: AppState): AppState = state.copy(
        irrigationDamageReports = state.irrigationDamageReports.map { r ->
            IrrigationDamageReportRecord(
                reportId = (r.reportId ?: "").trim(),
                irrigationId = (r.irrigationId ?: "").trim(),
                zone = (r.zone ?: "").trim(),
                sprinklerLabel = (r.sprinklerLabel ?: "").trim(),
                details = (r.details ?: "").trim(),
                reportedAt = (r.reportedAt ?: "").trim(),
                reportedBy = (r.reportedBy ?: "").trim(),
                reportedByAuthUid = (r.reportedByAuthUid ?: "").trim(),
                status = (r.status ?: "Pending").trim().ifBlank { "Pending" }
            )
        }
    )

    private fun normalizeHarvestReadinessReports(state: AppState): AppState = state.copy(
        harvestReadinessReports = state.harvestReadinessReports.mapIndexed { index, r ->
            HarvestReadinessReportRecord(
                reportId = (r.reportId ?: "").trim().ifBlank { "HR-${index + 1}" },
                zone = (r.zone ?: "").trim(),
                expectedWeight = (r.expectedWeight ?: "").trim(),
                reportedBy = (r.reportedBy ?: "").trim(),
                reportedAt = (r.reportedAt ?: "").trim(),
                status = (r.status ?: "Pending Review").trim().ifBlank { "Pending Review" },
                notes = (r.notes ?: "").trim(),
                reviewedAt = (r.reviewedAt ?: "").trim(),
                reviewedBy = (r.reviewedBy ?: "").trim()
            )
        }
    )

    private fun normalizePayrollRecords(state: AppState): AppState = state.copy(
        payroll = state.payroll.map { sanitizePayrollRecord(it) }
    )

    private fun sanitizePayrollRecord(p: PayrollRecord): PayrollRecord {
        return PayrollRecord(
            workerName = (p.workerName ?: "").trim(),
            period = (p.period ?: "").trim(),
            amount = p.amount ?: 0,
            paid = p.paid ?: false,
            date = p.date?.trim(),
            workerId = (p.workerId ?: "").trim(),
            dailyRate = p.dailyRate ?: 0.0,
            daysWorked = p.daysWorked ?: 0,
            hourlyRate = p.hourlyRate ?: 0.0,
            hoursWorked = p.hoursWorked ?: 0.0,
            linkedAttendanceId = (p.linkedAttendanceId ?: "").trim()
        )
    }

    private fun normalizeWorkers(state: AppState): AppState = state.copy(
        workers = state.workers.map { sanitizeWorkerRecord(it) }
    )

    private fun sanitizeWorkerRecord(w: WorkerRecord): WorkerRecord {
        return WorkerRecord(
            name = (w.name ?: "").trim(),
            roleRate = (w.roleRate ?: "").trim(),
            details = (w.details ?: "").trim(),
            phoneNumber = (w.phoneNumber ?: "").trim(),
            address = (w.address ?: "").trim(),
            emergencyContact = (w.emergencyContact ?: "").trim(),
            workerId = (w.workerId ?: "").trim(),
            birthday = (w.birthday ?: "").trim(),
            sex = (w.sex ?: "").trim(),
            accountEmail = (w.accountEmail ?: "").trim(),
            accountPassword = (w.accountPassword ?: "").trim(),
            authUid = (w.authUid ?: "").trim()
        )
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
            submittedByStaff = a.submittedByStaff ?: false,
            timeInLatitude = a.timeInLatitude,
            timeInLongitude = a.timeInLongitude,
            timeInLocationName = (a.timeInLocationName ?: "").trim(),
            faceSnapshotBase64 = (a.faceSnapshotBase64 ?: "").trim(),
            isGeofenceVerified = a.isGeofenceVerified
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
                scannedByWorkerName = g.scannedByWorkerName?.trim()?.ifBlank { null },
                scannedByEmail = g.scannedByEmail?.trim()?.ifBlank { null },
                scannedByAuthUid = g.scannedByAuthUid?.trim()?.ifBlank { null },
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
                scannedByWorkerName = g.scannedByWorkerName?.trim()?.ifBlank { null },
                scannedByEmail = g.scannedByEmail?.trim()?.ifBlank { null },
                scannedByAuthUid = g.scannedByAuthUid?.trim()?.ifBlank { null },
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
                scannedByWorkerName = g.scannedByWorkerName?.trim()?.ifBlank { null },
                scannedByEmail = g.scannedByEmail?.trim()?.ifBlank { null },
                scannedByAuthUid = g.scannedByAuthUid?.trim()?.ifBlank { null },
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

    private fun equipmentReportKey(r: EquipmentConditionReport): String =
        r.reportId.ifBlank {
            listOf(r.equipmentName, r.reportedAt, r.reportedBy.orEmpty(), r.isWrecked.toString(), r.notes).joinToString("\u0001")
        }

    private fun mergeEquipmentReportsWithRemote(
        local: List<EquipmentConditionReport>,
        remote: List<EquipmentConditionReport>
    ): List<EquipmentConditionReport> {
        val merged = remote.associateBy { equipmentReportKey(it) }.toMutableMap()
        local.forEach { report ->
            val key = equipmentReportKey(report)
            val remoteReport = merged[key]
            merged[key] = if (remoteReport == null) {
                report
            } else {
                remoteReport.copy(
                    isWrecked = report.isWrecked,
                    notes = report.notes,
                    reportedAt = report.reportedAt,
                    reportedBy = report.reportedBy,
                    reviewed = report.reviewed,
                    isFixedReport = report.isFixedReport,
                    fixedAt = report.fixedAt,
                    fixedBy = report.fixedBy
                )
            }
        }
        return merged.values.toList()
    }

    private fun preferLongerList(local: List<*>, remote: List<*>): Boolean = remote.size > local.size

    private fun <T> mergeByKey(
        local: List<T>,
        remote: List<T>,
        keyFor: (T) -> String
    ): List<T> {
        val remoteKeys = remote.mapTo(mutableSetOf()) { keyFor(it) }
        val extras = local.filter { keyFor(it) !in remoteKeys }
        return remote + extras
    }

    private fun <T> preferLongerListValue(local: List<T>, remote: List<T>): List<T> =
        if (preferLongerList(local, remote)) remote else local

    private fun workerKey(w: WorkerRecord): String =
        w.workerId.trim().ifBlank { listOf(w.name, w.roleRate, w.phoneNumber).joinToString("\u0001") }

    private fun attendanceKey(a: AttendanceRecord): String =
        (a.attendanceId ?: "").trim().ifBlank {
            listOf(a.workerName, a.date ?: "", a.clockIn ?: "", a.clockOut ?: "", a.details).joinToString("\u0001")
        }

    private fun treeKey(t: TreeRecord): String =
        t.treeId.trim().ifBlank { listOf(t.sectionName, t.details, t.stage).joinToString("\u0001") }

    private fun harvestKey(h: CherryHarvestRecord): String =
        h.harvestId.trim().ifBlank { listOf(h.batchId, h.date ?: "", h.weightText, h.details).joinToString("\u0001") }

    private fun harvestReadinessReportKey(r: HarvestReadinessReportRecord): String =
        r.reportId.trim().ifBlank { listOf(r.zone, r.expectedWeight, r.reportedBy, r.reportedAt).joinToString("\u0001") }

    private fun batchKey(b: BatchRecord): String =
        b.batchId.trim().ifBlank { listOf(b.label, b.status, b.treeId.orEmpty()).joinToString("\u0001") }

    private fun equipmentKey(e: EquipmentRecord): String =
        e.name.trim().lowercase()

    private fun saleKey(s: SaleRecord): String =
        s.saleId.trim().ifBlank { listOf(s.buyer, s.date, s.type, s.total.toString(), s.details).joinToString("\u0001") }

    private fun expenseKey(e: ExpenseRecord): String =
        e.expenseId.trim().ifBlank { listOf(e.category, e.description, e.amount.toString(), e.date.orEmpty()).joinToString("\u0001") }

    private fun payrollKey(p: PayrollRecord): String =
        (p.linkedAttendanceId ?: "").trim().ifBlank {
            listOf(p.workerId, p.workerName, p.period, p.date.orEmpty(), p.amount.toString()).joinToString("\u0001")
        }

    private fun coffeeFieldKey(f: CoffeeFieldRecord): String =
        f.fieldId.trim().ifBlank { listOf(f.name, f.area, f.variety).joinToString("\u0001") }

    private fun irrigationKey(i: IrrigationSystemRecord): String =
        i.irrigationId.trim().ifBlank { listOf(i.zone, i.type, i.coverage).joinToString("\u0001") }

    private fun irrigationDamageReportKey(r: IrrigationDamageReportRecord): String =
        r.reportId.trim().ifBlank { listOf(r.irrigationId, r.zone, r.sprinklerLabel, r.reportedAt, r.reportedBy).joinToString("\u0001") }

    private fun pestControlKey(p: PestControlRecord): String =
        p.pestControlId.trim().ifBlank { listOf(p.date, p.field, p.issue, p.treatment).joinToString("\u0001") }

    private fun consumableSupplyKey(s: ConsumableSupplyRecord): String =
        s.supplyId.trim().ifBlank { listOf(s.name, s.category, s.unit).joinToString("\u0001") }

    private fun consumableReportKey(r: ConsumableSupplyReportRecord): String =
        r.reportId.trim().ifBlank { listOf(r.supplyId, r.supplyName, r.reportedAt, r.reportedBy).joinToString("\u0001") }

    private fun smsMessageKey(m: SmsMessageRecord): String =
        m.messageId.trim().ifBlank { listOf(m.senderName, m.recipientPhoneNumber, m.timestamp.toString()).joinToString("\u0001") }

    private fun mergeRemoteStatePreservingLocalGrades(local: AppState, remoteState: AppState): AppState =
        normalizeAppState(remoteState.copy(
            workers = mergeByKey(local.workers, remoteState.workers, ::workerKey),
            attendance = mergeByKey(local.attendance, remoteState.attendance, ::attendanceKey),
            tasks = preferLongerListValue(local.tasks, remoteState.tasks),
            sections = preferLongerListValue(local.sections, remoteState.sections),
            trees = mergeByKey(local.trees, remoteState.trees, ::treeKey),
            cherryGrades = mergeCherryGradesWithRemote(local.cherryGrades, remoteState.cherryGrades),
            treeRipenessScans = mergeTreeRipenessScansWithRemote(local.treeRipenessScans, remoteState.treeRipenessScans),
            harvestSchedules = preferLongerListValue(local.harvestSchedules, remoteState.harvestSchedules),
            harvestReadinessReports = mergeByKey(local.harvestReadinessReports, remoteState.harvestReadinessReports, ::harvestReadinessReportKey),
            flowering = preferLongerListValue(local.flowering, remoteState.flowering),
            cherryHarvests = mergeByKey(local.cherryHarvests, remoteState.cherryHarvests, ::harvestKey),
            batches = mergeByKey(local.batches, remoteState.batches, ::batchKey),
            equipment = mergeByKey(local.equipment, remoteState.equipment, ::equipmentKey),
            usageLogs = preferLongerListValue(local.usageLogs, remoteState.usageLogs),
            maintenanceLogs = preferLongerListValue(local.maintenanceLogs, remoteState.maintenanceLogs),
            equipmentReports = mergeEquipmentReportsWithRemote(local.equipmentReports, remoteState.equipmentReports),
            sales = mergeByKey(local.sales, remoteState.sales, ::saleKey),
            expenses = mergeByKey(local.expenses, remoteState.expenses, ::expenseKey),
            payroll = mergeByKey(local.payroll, remoteState.payroll, ::payrollKey),
            coffeeFields = mergeByKey(local.coffeeFields, remoteState.coffeeFields, ::coffeeFieldKey),
            irrigationSystems = mergeByKey(local.irrigationSystems, remoteState.irrigationSystems, ::irrigationKey),
            irrigationDamageReports = mergeByKey(local.irrigationDamageReports, remoteState.irrigationDamageReports, ::irrigationDamageReportKey),
            pestControlLogs = mergeByKey(local.pestControlLogs, remoteState.pestControlLogs, ::pestControlKey),
            consumableSupplies = mergeByKey(local.consumableSupplies, remoteState.consumableSupplies, ::consumableSupplyKey),
            consumableReports = mergeByKey(local.consumableReports, remoteState.consumableReports, ::consumableReportKey),
            smsMessages = mergeByKey(local.smsMessages, remoteState.smsMessages, ::smsMessageKey)
        ))

    private fun mergeStateForCloudUpload(local: AppState, remote: AppState): AppState {
        if (isEffectivelyEmpty(remote)) return normalizeAppState(local)
        return mergeRemoteStatePreservingLocalGrades(local, remote)
    }

    /** Count of all list rows; used to avoid clobbering local data with an empty or stale cloud snapshot. */
    private fun AppState.totalItemCount(): Int =
        workers.size + attendance.size + tasks.size + sections.size + trees.size +
            harvestSchedules.size + harvestReadinessReports.size + flowering.size + cherryHarvests.size + batches.size + cherryGrades.size +
            treeRipenessScans.size +
            equipment.size + usageLogs.size + maintenanceLogs.size + equipmentReports.size + sales.size + expenses.size + payroll.size +
            coffeeFields.size + irrigationSystems.size + irrigationDamageReports.size + pestControlLogs.size + consumableSupplies.size +
            consumableReports.size + smsMessages.size

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
        workerId: String = "",
        birthday: String = "",
        sex: String = "",
        accountEmail: String = "",
        accountPassword: String = "",
        authUid: String = ""
    ) = persist(
        state.copy(
            workers = state.workers + WorkerRecord(
                name = name,
                roleRate = roleRate,
                details = details,
                phoneNumber = phoneNumber,
                address = address,
                emergencyContact = emergencyContact,
                workerId = workerId.trim().ifBlank { "EMP-${UUID.randomUUID().toString().take(8).uppercase()}" },
                birthday = birthday.trim(),
                sex = sex.trim(),
                accountEmail = accountEmail.trim(),
                accountPassword = accountPassword.trim(),
                authUid = authUid.trim()
            )
        )
    )

    fun addSmsMessage(
        senderName: String,
        senderRole: String,
        recipientName: String,
        recipientPhoneNumber: String,
        messageBody: String,
        sentViaCellularSms: Boolean
    ) = persist(
        state.copy(
            smsMessages = state.smsMessages + SmsMessageRecord(
                messageId = "MSG-${UUID.randomUUID().toString().take(8).uppercase()}",
                senderName = senderName.trim(),
                senderRole = senderRole.trim(),
                recipientName = recipientName.trim(),
                recipientPhoneNumber = recipientPhoneNumber.trim(),
                messageBody = messageBody.trim(),
                timestamp = System.currentTimeMillis(),
                sentViaCellularSms = sentViaCellularSms
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
        staffSubmission: Boolean = false,
        timeInLatitude: Double? = null,
        timeInLongitude: Double? = null,
        timeInLocationName: String = "",
        faceSnapshotBase64: String = "",
        isGeofenceVerified: Boolean? = null
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
                    submittedByStaff = staffSubmission,
                    timeInLatitude = timeInLatitude,
                    timeInLongitude = timeInLongitude,
                    timeInLocationName = timeInLocationName.trim(),
                    faceSnapshotBase64 = faceSnapshotBase64.trim(),
                    isGeofenceVerified = isGeofenceVerified
                )
            )
        )
    }

    fun addTimesheetCorrection(
        workerName: String,
        date: String,
        requestedClockIn: String,
        requestedClockOut: String,
        reason: String,
        originalClockIn: String = "",
        originalClockOut: String = "",
        attendanceId: String = ""
    ) {
        val cid = "TC-${System.currentTimeMillis().toString().takeLast(7)}"
        val now = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("M/d/yyyy, h:mm:ss a"))
        val request = TimesheetCorrectionRequest(
            correctionId = cid,
            attendanceId = attendanceId,
            workerName = workerName.trim(),
            date = date.trim(),
            field = if (requestedClockIn.isNotBlank() && requestedClockOut.isNotBlank()) "both" else if (requestedClockIn.isNotBlank()) "clockIn" else "clockOut",
            originalClockIn = originalClockIn.trim(),
            originalClockOut = originalClockOut.trim(),
            requestedClockIn = requestedClockIn.trim(),
            requestedClockOut = requestedClockOut.trim(),
            reason = reason.trim(),
            status = "Pending",
            submittedAt = now,
            submittedBy = workerName.trim(),
            auditTrail = listOf(
                TimesheetAuditEntry(
                    actorName = workerName.trim(),
                    action = "Submitted timesheet correction request",
                    remarks = reason.trim(),
                    timestamp = now
                )
            )
        )
        persist(
            state.copy(
                timesheetCorrections = listOf(request) + state.timesheetCorrections
            )
        )
    }

    fun addLeaveRequest(
        workerName: String,
        leaveType: String,
        startDate: String,
        endDate: String,
        leaveDays: Int,
        reason: String
    ) {
        val lid = "LV-${System.currentTimeMillis().toString().takeLast(7)}"
        val now = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("M/d/yyyy, h:mm:ss a"))
        val request = LeaveRequestRecord(
            leaveId = lid,
            workerName = workerName.trim(),
            leaveType = leaveType.trim(),
            startDate = startDate.trim(),
            endDate = endDate.trim(),
            leaveDays = leaveDays,
            reason = reason.trim(),
            status = "Pending",
            submittedAt = now,
            submittedBy = workerName.trim()
        )
        persist(
            state.copy(
                leaveRequests = listOf(request) + state.leaveRequests
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

    fun addCoffeeField(
        name: String,
        area: String,
        trees: Int,
        status: String,
        variety: String,
        age: String,
        nextHarvest: String,
        productivity: Int,
        fieldId: String = ""
    ) = persist(
        state.copy(
            coffeeFields = state.coffeeFields + CoffeeFieldRecord(
                fieldId = fieldId.ifBlank { UUID.randomUUID().toString() },
                name = name,
                area = area,
                trees = trees,
                status = status,
                variety = variety,
                age = age,
                nextHarvest = nextHarvest,
                productivity = productivity.coerceIn(0, 100)
            )
        )
    )

    fun addIrrigationSystem(
        zone: String,
        type: String,
        status: String,
        coverage: String,
        efficiency: Int,
        lastMaintenance: String,
        irrigationId: String = ""
    ) = persist(
        state.copy(
            irrigationSystems = state.irrigationSystems + IrrigationSystemRecord(
                irrigationId = irrigationId.ifBlank { UUID.randomUUID().toString() },
                zone = zone,
                type = type,
                status = status,
                coverage = coverage,
                efficiency = efficiency.coerceIn(0, 100),
                lastMaintenance = lastMaintenance
            )
        )
    )

    /** Worker field report: visible on admin website. */
    fun reportDamagedSprinkler(
        irrigationId: String,
        zone: String,
        sprinklerLabel: String,
        details: String,
        reportedBy: String,
        reportedByAuthUid: String = "",
        reportedAt: String = ""
    ) {
        val label = sprinklerLabel.trim()
        if (label.isBlank()) return
        val reporter = reportedBy.trim()
        val date = reportedAt.trim().ifBlank { java.time.LocalDate.now().toString() }
        val report = IrrigationDamageReportRecord(
            reportId = UUID.randomUUID().toString(),
            irrigationId = irrigationId.trim(),
            zone = zone.trim(),
            sprinklerLabel = label,
            details = details.trim(),
            reportedAt = date,
            reportedBy = reporter.ifBlank { "Unknown worker" },
            reportedByAuthUid = reportedByAuthUid.trim(),
            status = "Pending"
        )
        persist(state.copy(irrigationDamageReports = state.irrigationDamageReports + report))
    }

    fun updateIrrigationDamageReportStatus(reportId: String, status: String) {
        val id = reportId.trim()
        if (id.isBlank()) return
        val nextStatus = status.trim().ifBlank { return }
        val idx = state.irrigationDamageReports.indexOfFirst { it.reportId == id }
        if (idx < 0) return
        val current = state.irrigationDamageReports[idx]
        val next = current.copy(status = nextStatus)
        persist(state.copy(irrigationDamageReports = state.irrigationDamageReports.toMutableList().also { it[idx] = next }))
    }

    fun addPestControlLog(
        date: String,
        field: String,
        issue: String,
        treatment: String,
        status: String,
        pestControlId: String = ""
    ) = persist(
        state.copy(
            pestControlLogs = state.pestControlLogs + PestControlRecord(
                pestControlId = pestControlId.ifBlank { UUID.randomUUID().toString() },
                date = date,
                field = field,
                issue = issue,
                treatment = treatment,
                status = status
            )
        )
    )

    /** Worker field report: visible on admin website under consumable supplies. */
    fun reportConsumableSupply(
        supplyId: String,
        supplyName: String,
        isRunOut: Boolean,
        notes: String,
        reportedBy: String,
        reportedByAuthUid: String = "",
        reportedAt: String = ""
    ) {
        val name = supplyName.trim()
        if (name.isBlank()) return
        val today = reportedAt.trim().ifBlank { java.time.LocalDate.now().toString() }
        val report = ConsumableSupplyReportRecord(
            reportId = UUID.randomUUID().toString(),
            supplyId = supplyId.trim(),
            supplyName = name,
            isRunOut = isRunOut,
            notes = notes.trim(),
            reportedAt = today,
            reportedBy = reportedBy.trim().ifBlank { "Unknown worker" },
            reportedByAuthUid = reportedByAuthUid.trim(),
            reviewed = false
        )
        persist(state.copy(consumableReports = state.consumableReports + report))
    }

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

    fun submitHarvestReadinessReport(
        zone: String,
        expectedWeight: String,
        reportedBy: String,
        reportedAt: String,
        notes: String = ""
    ) = persist(
        state.copy(
            harvestReadinessReports = state.harvestReadinessReports + HarvestReadinessReportRecord(
                reportId = "HR-${UUID.randomUUID().toString().take(8).uppercase()}",
                zone = zone.trim(),
                expectedWeight = expectedWeight.trim(),
                reportedBy = reportedBy.trim(),
                reportedAt = reportedAt.trim(),
                status = "Pending Review",
                notes = notes.trim()
            )
        )
    )

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
        scannedByWorkerName: String? = null,
        scannedByEmail: String? = null,
        scannedByAuthUid: String? = null,
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
                    scannedByWorkerName = scannedByWorkerName?.trim()?.ifBlank { null },
                    scannedByEmail = scannedByEmail?.trim()?.ifBlank { null },
                    scannedByAuthUid = scannedByAuthUid?.trim()?.ifBlank { null },
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
        scannedByWorkerName: String? = null,
        scannedByEmail: String? = null,
        scannedByAuthUid: String? = null,
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
                    scannedByWorkerName = scannedByWorkerName?.trim()?.ifBlank { null },
                    scannedByEmail = scannedByEmail?.trim()?.ifBlank { null },
                    scannedByAuthUid = scannedByAuthUid?.trim()?.ifBlank { null },
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

    fun addMaintenance(
        equipmentName: String,
        details: String,
        costText: String,
        date: String = "",
        reportedBy: String? = null,
        isWrecked: Boolean = true
    ) {
        val name = equipmentName.trim()
        if (name.isEmpty()) return
        val log = MaintenanceRecord(name, details.trim(), costText, date.ifBlank { java.time.LocalDate.now().toString() })
        val reporter = reportedBy?.trim().orEmpty()
        val reports =
            if (reporter.isNotEmpty()) {
                state.equipmentReports + EquipmentConditionReport(
                    reportId = UUID.randomUUID().toString(),
                    equipmentName = name,
                    isWrecked = isWrecked,
                    notes = details.trim(),
                    reportedAt = log.date.orEmpty().ifBlank { java.time.LocalDate.now().toString() },
                    reportedBy = reporter,
                    reviewed = false
                )
            } else {
                state.equipmentReports
            }
        persist(
            state.copy(
                maintenanceLogs = state.maintenanceLogs + log,
                equipmentReports = reports
            )
        )
    }

    /** Worker field report: visible on admin website and stored as a maintenance note. */
    fun reportEquipmentIssue(
        equipmentName: String,
        details: String,
        isWrecked: Boolean,
        reportedBy: String,
        isFixedReport: Boolean = false
    ) {
        val name = equipmentName.trim()
        if (name.isEmpty()) return
        val today = java.time.LocalDate.now().toString()
        val reporter = reportedBy.trim().ifBlank { null }
        val report = EquipmentConditionReport(
            reportId = UUID.randomUUID().toString(),
            equipmentName = name,
            isWrecked = isWrecked,
            notes = details.trim(),
            reportedAt = today,
            reportedBy = reporter,
            reviewed = false,
            isFixedReport = isFixedReport,
            fixedAt = if (isFixedReport) today else null,
            fixedBy = if (isFixedReport) reporter else null
        )
        val defaultDetails = when {
            isFixedReport -> "Reported fixed / repaired"
            isWrecked -> "Reported wrecked / broken"
            else -> "Reported working OK"
        }
        val maintenance = MaintenanceRecord(
            equipmentName = name,
            details = details.trim().ifBlank { defaultDetails },
            costText = "—",
            date = today
        )
        persist(
            state.copy(
                equipmentReports = state.equipmentReports + report,
                maintenanceLogs = state.maintenanceLogs + maintenance
            )
        )
    }

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
        workerId: String = "",
        birthday: String = "",
        sex: String = "",
        accountEmail: String = "",
        accountPassword: String = "",
        authUid: String = ""
    ) = persist(
        state.copy(
            workers = replaceAt(
                state.workers,
                index,
                state.workers.getOrNull(index).let { existing ->
                    WorkerRecord(
                        name = name,
                        roleRate = roleRate,
                        details = details,
                        phoneNumber = phoneNumber,
                        address = address,
                        emergencyContact = emergencyContact,
                        workerId = workerId.trim().ifBlank {
                            state.workers.getOrNull(index)?.workerId?.trim().orEmpty()
                                .ifBlank { "EMP-${UUID.randomUUID().toString().take(8).uppercase()}" }
                        },
                        birthday = birthday.trim(),
                        sex = sex.trim(),
                        accountEmail = accountEmail.trim().ifBlank { existing?.accountEmail.orEmpty() },
                        accountPassword = accountPassword.trim().ifBlank { existing?.accountPassword.orEmpty() },
                        authUid = authUid.trim().ifBlank { existing?.authUid.orEmpty() }
                    )
                }
            )
        )
    )
    fun deleteWorker(index: Int) = persist(state.copy(workers = removeAt(state.workers, index)))

    fun deactivateWorker(index: Int) {
        val existing = state.workers.getOrNull(index) ?: return
        val inactiveDetails = if (existing.details.contains("\"status\"")) {
            existing.details.replace(Regex("\"status\"\\s*:\\s*\"[^\"]*\""), "\"status\":\"inactive\"")
        } else {
            val trimmed = existing.details.trim()
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                trimmed.dropLast(1) + ",\"status\":\"inactive\"}"
            } else {
                "{\"status\":\"inactive\"}"
            }
        }
        persist(state.copy(workers = replaceAt(state.workers, index, existing.copy(details = inactiveDetails))))
    }

    fun updateAttendance(
        index: Int,
        workerName: String,
        details: String,
        hoursWorked: Double? = null,
        clockIn: String = "",
        clockOut: String = "",
        date: String = "",
        awaitingPayrollLine: Boolean? = null,
        submittedByStaff: Boolean? = null,
        timeInLatitude: Double? = null,
        timeInLongitude: Double? = null,
        timeInLocationName: String = "",
        faceSnapshotBase64: String = "",
        isGeofenceVerified: Boolean? = null
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
                        submittedByStaff = submittedByStaff ?: prev.submittedByStaff,
                        timeInLatitude = timeInLatitude ?: prev.timeInLatitude,
                        timeInLongitude = timeInLongitude ?: prev.timeInLongitude,
                        timeInLocationName = timeInLocationName.trim().ifBlank { (prev.timeInLocationName ?: "") },
                        faceSnapshotBase64 = faceSnapshotBase64.trim().ifBlank { (prev.faceSnapshotBase64 ?: "") },
                        isGeofenceVerified = isGeofenceVerified ?: prev.isGeofenceVerified
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

    fun updateCoffeeField(
        index: Int,
        name: String,
        area: String,
        trees: Int,
        status: String,
        variety: String,
        age: String,
        nextHarvest: String,
        productivity: Int
    ) {
        val existing = state.coffeeFields.getOrNull(index) ?: return
        persist(
            state.copy(
                coffeeFields = replaceAt(
                    state.coffeeFields,
                    index,
                    existing.copy(
                        name = name,
                        area = area,
                        trees = trees,
                        status = status,
                        variety = variety,
                        age = age,
                        nextHarvest = nextHarvest,
                        productivity = productivity.coerceIn(0, 100)
                    )
                )
            )
        )
    }

    fun deleteCoffeeField(index: Int) = persist(state.copy(coffeeFields = removeAt(state.coffeeFields, index)))

    fun updateIrrigationSystem(
        index: Int,
        zone: String,
        type: String,
        status: String,
        coverage: String,
        efficiency: Int,
        lastMaintenance: String
    ) {
        val existing = state.irrigationSystems.getOrNull(index) ?: return
        persist(
            state.copy(
                irrigationSystems = replaceAt(
                    state.irrigationSystems,
                    index,
                    existing.copy(
                        zone = zone,
                        type = type,
                        status = status,
                        coverage = coverage,
                        efficiency = efficiency.coerceIn(0, 100),
                        lastMaintenance = lastMaintenance
                    )
                )
            )
        )
    }

    fun deleteIrrigationSystem(index: Int) =
        persist(state.copy(irrigationSystems = removeAt(state.irrigationSystems, index)))

    fun updatePestControlLog(
        index: Int,
        date: String,
        field: String,
        issue: String,
        treatment: String,
        status: String
    ) {
        val existing = state.pestControlLogs.getOrNull(index) ?: return
        persist(
            state.copy(
                pestControlLogs = replaceAt(
                    state.pestControlLogs,
                    index,
                    existing.copy(
                        date = date,
                        field = field,
                        issue = issue,
                        treatment = treatment,
                        status = status
                    )
                )
            )
        )
    }

    fun deletePestControlLog(index: Int) = persist(state.copy(pestControlLogs = removeAt(state.pestControlLogs, index)))

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

    fun reviewHarvestReadinessReport(index: Int, status: String, reviewedBy: String, reviewedAt: String) {
        val existing = state.harvestReadinessReports.getOrNull(index) ?: return
        persist(
            state.copy(
                harvestReadinessReports = replaceAt(
                    state.harvestReadinessReports,
                    index,
                    existing.copy(
                        status = status.trim().ifBlank { existing.status },
                        reviewedBy = reviewedBy.trim(),
                        reviewedAt = reviewedAt.trim()
                    )
                )
            )
        )
    }

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
        val farmId = FirebaseCollections.SHARED_FARM_DOCUMENT_ID
        val mainRef = db.collection(FirebaseCollections.APP_STATE).document(farmId)
        mainRef.get()
            .addOnSuccessListener { snapshot ->
                val remoteJson = snapshot.getString("stateJson")
                val remoteState = remoteJson
                    ?.takeIf { it.isNotBlank() }
                    ?.let { runCatching { gson.fromJson(it, AppState::class.java) }.getOrNull() }
                val merged = if (remoteState == null) normalizeAppState(next) else mergeStateForCloudUpload(next, remoteState)
                commitStateSnapshotToCloud(db, merged)
            }
            .addOnFailureListener {
                // Firestore may be offline; still enqueue the local snapshot so it syncs when connectivity returns.
                commitStateSnapshotToCloud(db, normalizeAppState(next))
            }
    }

    private fun commitStateSnapshotToCloud(db: FirebaseFirestore, next: AppState) {
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
        mirrorList(FirebaseCollections.TREE_RIPENESS_SCANS, gson.toJson(next.treeRipenessScans), next.treeRipenessScans.size)
        mirrorList(FirebaseCollections.HARVEST_SCHEDULES, gson.toJson(next.harvestSchedules), next.harvestSchedules.size)
        mirrorList(FirebaseCollections.HARVEST_READINESS_REPORTS, gson.toJson(next.harvestReadinessReports), next.harvestReadinessReports.size)
        mirrorList(FirebaseCollections.FLOWERING, gson.toJson(next.flowering), next.flowering.size)
        mirrorList(FirebaseCollections.HARVEST_RECORDS, gson.toJson(next.cherryHarvests), next.cherryHarvests.size)
        mirrorList(FirebaseCollections.BATCHES, gson.toJson(next.batches), next.batches.size)
        mirrorList(FirebaseCollections.CNN_CLASSIFICATIONS, gson.toJson(next.cherryGrades), next.cherryGrades.size)
        mirrorList(FirebaseCollections.EQUIPMENT, gson.toJson(next.equipment), next.equipment.size)
        mirrorList(FirebaseCollections.EQUIPMENT_USAGE, gson.toJson(next.usageLogs), next.usageLogs.size)
        mirrorList(FirebaseCollections.MAINTENANCE_LOGS, gson.toJson(next.maintenanceLogs), next.maintenanceLogs.size)
        mirrorList(FirebaseCollections.EQUIPMENT_REPORTS, gson.toJson(next.equipmentReports), next.equipmentReports.size)
        mirrorList(FirebaseCollections.SALES, gson.toJson(next.sales), next.sales.size)
        mirrorList(FirebaseCollections.EXPENSES, gson.toJson(next.expenses), next.expenses.size)
        mirrorList(FirebaseCollections.PAYROLL, gson.toJson(next.payroll), next.payroll.size)
        mirrorList(FirebaseCollections.COFFEE_FIELDS, gson.toJson(next.coffeeFields), next.coffeeFields.size)
        mirrorList(FirebaseCollections.IRRIGATION_SYSTEMS, gson.toJson(next.irrigationSystems), next.irrigationSystems.size)
        mirrorList(FirebaseCollections.IRRIGATION_DAMAGE_REPORTS, gson.toJson(next.irrigationDamageReports), next.irrigationDamageReports.size)
        mirrorList(FirebaseCollections.PEST_CONTROL_LOGS, gson.toJson(next.pestControlLogs), next.pestControlLogs.size)
        mirrorList(FirebaseCollections.CONSUMABLE_SUPPLIES, gson.toJson(next.consumableSupplies), next.consumableSupplies.size)
        mirrorList(FirebaseCollections.CONSUMABLE_REPORTS, gson.toJson(next.consumableReports), next.consumableReports.size)
        mirrorList(FirebaseCollections.SMS_MESSAGES, gson.toJson(next.smsMessages), next.smsMessages.size)

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
