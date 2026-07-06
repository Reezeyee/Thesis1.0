package com.melodypenero.coffeefarm.data.firebase

/**
 * Firestore collection names.
 *
 * **Sync behavior:** [com.melodypenero.coffeefarm.data.store.AppStore] writes (1) the full app snapshot to
 * [APP_STATE]/[SHARED_FARM_DOCUMENT_ID] (`stateJson`) so admin and worker accounts share one dataset, and
 * (2) mirrored lists under [USER_DATA]/[SHARED_FARM_DOCUMENT_ID]/...
 *
 * Documents named [ENTITY_SNAPSHOT_DOC_ID] (`latest`) hold the mirrored list payload.
 */
object FirebaseCollections {
    /** Document id used for the per-collection JSON snapshot of each [com.melodypenero.coffeefarm.data.store.AppState] list. */
    const val ENTITY_SNAPSHOT_DOC_ID = "latest"

    /**
     * Shared Firestore document id for the single farm dataset every role uses (admin + workers).
     * Sync writes [APP_STATE]/[SHARED_FARM_DOCUMENT_ID] and [USER_DATA]/[SHARED_FARM_DOCUMENT_ID]/...
     */
    const val SHARED_FARM_DOCUMENT_ID = "farm"

    /**
     * App snapshots live under [APP_STATE]: legacy `app_state/{authUid}` or shared `app_state/farm`.
     */
    const val APP_STATE = "app_state"
    /** Subcollections under [USER_DATA]/{owner}/ for mirrored list JSON (`farm` or legacy uid). */
    const val USER_DATA = "user_data"
    /** User profile and login history: `users` / {uid} and `users` / {uid} / `login_history` / {id}. */
    const val USERS = "users"
    const val LOGIN_HISTORY = "login_history"
    const val PASSWORD_RESET_REQUESTS = "password_reset_requests"
    const val WORKERS = "workers"
    const val TREES = "trees"
    /** Per-tree ripeness scan samples saved from the mobile CNN scanner. */
    const val TREE_RIPENESS_SCANS = "tree_ripeness_scans"
    const val FARM_SECTIONS = "farm_sections"
    const val TASKS = "tasks"
    const val ATTENDANCE = "attendance"
    /** Cherry harvest weight/picker records (see [com.melodypenero.coffeefarm.data.store.CherryHarvestRecord]). */
    const val HARVEST_RECORDS = "harvest_records"
    /** Planned harvest schedules / calendar (see [com.melodypenero.coffeefarm.data.store.HarvestScheduleRecord]). */
    const val HARVEST_SCHEDULES = "harvest_schedules"
    /** Worker-submitted crop readiness reports for admin review. */
    const val HARVEST_READINESS_REPORTS = "harvest_readiness_reports"
    /** Flowering intensity records per section. */
    const val FLOWERING = "flowering"
    const val BATCHES = "batches"
    /** Saved AI cherry grades (see [com.melodypenero.coffeefarm.data.store.CherryGradeRecord]). */
    const val CNN_CLASSIFICATIONS = "cnn_classifications"
    const val EQUIPMENT = "equipment"
    const val EQUIPMENT_USAGE = "equipment_usage"
    const val MAINTENANCE_LOGS = "maintenance_logs"
    const val EQUIPMENT_REPORTS = "equipment_reports"
    const val SALES = "sales"
    const val EXPENSES = "expenses"
    const val PAYROLL = "payroll"
    const val COFFEE_FIELDS = "coffee_fields"
    const val IRRIGATION_SYSTEMS = "irrigation_systems"
    const val IRRIGATION_DAMAGE_REPORTS = "irrigation_damage_reports"
    const val PEST_CONTROL_LOGS = "pest_control_logs"
    const val CONSUMABLE_SUPPLIES = "consumable_supplies"
    const val CONSUMABLE_REPORTS = "consumable_reports"
    const val ACTIVITY_LOGS = "activity_logs"
    const val PROFIT_SNAPSHOTS = "profit_snapshots"
}
