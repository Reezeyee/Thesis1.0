import {
  normalizeAppState,
  totalItemCount,
  type AppState,
  type CherryGradeRecord,
  type ConsumableSupplyReportRecord,
  type EquipmentConditionReport,
  type HarvestReadinessReportRecord,
  type IrrigationDamageReportRecord,
  type LeaveRequestRecord,
  type PestControlRecord,
  type TreeRipenessScanRecord,
  type SmsMessageRecord,
  type TimesheetCorrectionRequest,
} from '../types/appState';

function mergeByKey<T>(local: T[], remote: T[], keyFor: (item: T) => string): T[] {
  const remoteKeys = new Set(remote.map(keyFor));
  const extras = local.filter((item) => !remoteKeys.has(keyFor(item)));
  return [...remote, ...extras];
}

/**
 * A plain union merge (mergeByKey above) can only ever ADD rows: an item present in `remote`
 * but missing from `local` is indistinguishable from "a genuinely new row added elsewhere" and
 * from "the admin just deleted this row locally, and the deletion hasn't reached the server
 * yet" -- both look identical from local/remote alone, so a bare union always resurrects the
 * second case, meaning nothing using it could ever be deleted through the website (the very
 * next save -- of anything, not just that row -- would bring it right back). `baseline` (this
 * tab's own state immediately before the edit that produced `local`, i.e. what it last knew to
 * be true) breaks that ambiguity: a key present in `baseline` but missing from `local` is a
 * deliberate deletion this tab just made, so it's dropped from `remote` too even if remote
 * hasn't caught up yet. A key that was never in `baseline` and isn't in `local` either is a
 * genuinely new row from elsewhere and is kept. Local wins for a key present in both `local`
 * and `remote` (an edit to an existing row beats a possibly-stale remote copy of it).
 */
function mergeByKeyRespectingDeletion<T>(
  baseline: T[],
  local: T[],
  remote: T[],
  keyFor: (item: T) => string,
): T[] {
  const baselineKeys = new Set(baseline.map(keyFor));
  const localKeys = new Set(local.map(keyFor));
  const deletedKeys = new Set([...baselineKeys].filter((k) => !localKeys.has(k)));
  const remoteSurvivors = remote.filter((item) => !deletedKeys.has(keyFor(item)));
  const remoteExtras = remoteSurvivors.filter((item) => !localKeys.has(keyFor(item)));
  return [...local, ...remoteExtras];
}

function cherryGradeDedupeKey(g: CherryGradeRecord): string {
  return [
    g.batchId ?? '',
    g.grade ?? '',
    g.confidence ?? '',
    g.species ?? '',
    g.speciesConfidence ?? '',
    String(g.savedAtMillis ?? 0),
    g.treeId ?? '',
  ].join('');
}

export function mergeCherryGrades(
  local: CherryGradeRecord[],
  remote: CherryGradeRecord[],
): CherryGradeRecord[] {
  const remoteKeys = new Set(remote.map(cherryGradeDedupeKey));
  const extras = local.filter((g) => !remoteKeys.has(cherryGradeDedupeKey(g)));
  return [...remote, ...extras];
}

function scanKey(r: TreeRipenessScanRecord): string {
  return [r.treeId, String(r.timestampMillis), r.ripenessLabel, r.sourceGrade ?? ''].join('');
}

export function mergeTreeRipenessScans(
  local: TreeRipenessScanRecord[],
  remote: TreeRipenessScanRecord[],
): TreeRipenessScanRecord[] {
  const remoteKeys = new Set(remote.map(scanKey));
  const extras = local.filter((r) => !remoteKeys.has(scanKey(r)));
  return [...remote, ...extras];
}

/** Prefer the longer list (keeps Android field rows when the web tab is stale). */
function preferLongerList<T>(local: T[], remote: T[]): T[] {
  return remote.length > local.length ? remote : local;
}

function equipmentReportKey(r: EquipmentConditionReport): string {
  if (r.reportId) return r.reportId;
  return [r.equipmentName, r.reportedAt, r.reportedBy ?? '', String(r.isWrecked), r.notes].join('');
}

function harvestReadinessReportKey(r: HarvestReadinessReportRecord): string {
  if (r.reportId) return r.reportId;
  return [(r.section ?? r.zone ?? ''), (r.workerName ?? r.reportedBy ?? ''), (r.date ?? r.reportedAt ?? ''), (r.time ?? '')].join('');
}

export function mergeHarvestReadinessReports(
  local: HarvestReadinessReportRecord[],
  remote: HarvestReadinessReportRecord[],
): HarvestReadinessReportRecord[] {
  const merged = new Map(remote.map((r) => [harvestReadinessReportKey(r), r]));
  local.forEach((r) => {
    const key = harvestReadinessReportKey(r);
    const remoteReport = merged.get(key);
    merged.set(key, remoteReport ? { ...remoteReport, ...r } : r);
  });
  return Array.from(merged.values());
}

function pestControlLogKey(p: PestControlRecord): string {
  if (p.pestControlId) return p.pestControlId;
  return [(p.field ?? ''), (p.issue ?? ''), (p.date ?? ''), (p.reportedBy ?? ''), (p.treeNumber ?? '')].join('');
}

export function mergePestControlLogs(
  local: PestControlRecord[],
  remote: PestControlRecord[],
): PestControlRecord[] {
  const merged = new Map(remote.map((r) => [pestControlLogKey(r), r]));
  local.forEach((r) => {
    const key = pestControlLogKey(r);
    const remoteReport = merged.get(key);
    merged.set(key, remoteReport ? { ...remoteReport, ...r } : r);
  });
  return Array.from(merged.values());
}

function consumableReportKey(r: ConsumableSupplyReportRecord): string {
  if (r.reportId) return r.reportId;
  return [r.supplyId ?? '', r.supplyName, r.reportedAt, r.reportedBy].join('');
}

function irrigationDamageReportKey(r: IrrigationDamageReportRecord): string {
  if (r.reportId) return r.reportId;
  return [(r.irrigationId ?? '').trim(), r.zone ?? '', r.sprinklerLabel, r.reportedAt, r.reportedBy].join('');
}

function timesheetCorrectionKey(r: TimesheetCorrectionRequest): string {
  return r.correctionId || [r.workerName, r.date, r.submittedAt, r.field].join('');
}

function leaveRequestKey(r: LeaveRequestRecord): string {
  return r.leaveId || [r.workerName, r.leaveType, r.startDate, r.endDate, r.submittedAt].join('');
}

export function mergeEquipmentReports(
  local: EquipmentConditionReport[],
  remote: EquipmentConditionReport[],
): EquipmentConditionReport[] {
  const merged = new Map(remote.map((r) => [equipmentReportKey(r), r]));
  local.forEach((r) => {
    const key = equipmentReportKey(r);
    const remoteReport = merged.get(key);
    merged.set(key, remoteReport ? { ...remoteReport, ...r } : r);
  });
  return Array.from(merged.values());
}

function workerKey(w: { workerId?: string; name: string; roleRate: string; phoneNumber?: string }): string {
  return (w.workerId ?? '').trim() || [w.name, w.roleRate, w.phoneNumber ?? ''].join('');
}

function attendanceKey(a: { attendanceId?: string; workerName: string; date?: string; clockIn?: string; clockOut?: string; details: string }): string {
  return (a.attendanceId ?? '').trim() ||
    [a.workerName, a.date ?? '', a.clockIn ?? '', a.clockOut ?? '', a.details].join('');
}

function treeKey(t: { treeId?: string; sectionName: string; details: string; stage: string }): string {
  return (t.treeId ?? '').trim() || [t.sectionName, t.details, t.stage].join('');
}

function cherryHarvestKey(h: { harvestId?: string; batchId: string; date?: string | null; weightText: string; details: string }): string {
  return (h.harvestId ?? '').trim() || [h.batchId, h.date ?? '', h.weightText, h.details].join('');
}

function batchKey(b: { batchId: string; label: string; status: string; treeId?: string | null }): string {
  return b.batchId.trim() || [b.label, b.status, b.treeId ?? ''].join('');
}

function equipmentKey(e: { name: string }): string {
  return e.name.trim().toLowerCase();
}

function productListingKey(p: { listingId: string }): string {
  return p.listingId.trim();
}

function saleKey(s: { saleId?: string; buyer: string; date: string; type: string; total: number; details: string }): string {
  return (s.saleId ?? '').trim() || [s.buyer, s.date, s.type, String(s.total), s.details].join('');
}

function expenseKey(e: { expenseId?: string; category: string; description: string; amount: number; date?: string | null }): string {
  return (e.expenseId ?? '').trim() || [e.category, e.description, String(e.amount), e.date ?? ''].join('');
}

function payrollKey(p: { linkedAttendanceId?: string; workerId?: string; workerName: string; period: string; date?: string | null; amount: number }): string {
  return (p.linkedAttendanceId ?? '').trim() ||
    [p.workerId ?? '', p.workerName, p.period, p.date ?? '', String(p.amount)].join('');
}

function coffeeFieldKey(f: { fieldId?: string; name: string; area: string; variety: string }): string {
  return (f.fieldId ?? '').trim() || [f.name, f.area, f.variety].join('');
}

function irrigationSystemKey(i: { irrigationId?: string; zone: string; type: string; coverage: string }): string {
  return (i.irrigationId ?? '').trim() || [i.zone, i.type, i.coverage].join('');
}

function consumableSupplyKey(s: { supplyId: string; name: string; category: string; unit: string }): string {
  return s.supplyId.trim() || [s.name, s.category, s.unit].join('');
}

function smsMessageKey(m: { messageId?: string; senderName: string; recipientPhoneNumber?: string; timestamp: number }): string {
  return m.messageId || [m.senderName, m.recipientPhoneNumber, String(m.timestamp)].join('');
}

/**
 * Apply a Firestore snapshot to in-memory state.
 * Remote is the source of truth for admin-edited lists, except we union scans/grades
 * and never drop a longer local workers list during an in-flight save.
 */
export function mergeRemoteStatePreservingLocalGrades(
  local: AppState,
  remote: AppState,
): AppState {
  return normalizeAppState({
    ...remote,
    workers: mergeByKey(local.workers, remote.workers, workerKey),
    attendance: mergeByKey(local.attendance, remote.attendance, attendanceKey),
    timesheetCorrections: mergeByKey(local.timesheetCorrections, remote.timesheetCorrections, timesheetCorrectionKey),
    leaveRequests: mergeByKey(local.leaveRequests, remote.leaveRequests, leaveRequestKey),
    tasks: preferLongerList(local.tasks, remote.tasks),
    sections: preferLongerList(local.sections, remote.sections),
    trees: mergeByKey(local.trees, remote.trees, treeKey),
    cherryGrades: mergeCherryGrades(local.cherryGrades, remote.cherryGrades),
    treeRipenessScans: mergeTreeRipenessScans(local.treeRipenessScans, remote.treeRipenessScans),
    harvestSchedules: preferLongerList(local.harvestSchedules, remote.harvestSchedules),
    harvestReadinessReports: mergeHarvestReadinessReports(local.harvestReadinessReports, remote.harvestReadinessReports),
    flowering: preferLongerList(local.flowering, remote.flowering),
    cherryHarvests: mergeByKey(local.cherryHarvests, remote.cherryHarvests, cherryHarvestKey),
    batches: mergeByKey(local.batches, remote.batches, batchKey),
    equipment: mergeByKey(local.equipment, remote.equipment, equipmentKey),
    productListings: mergeByKey(local.productListings, remote.productListings, productListingKey),
    usageLogs: preferLongerList(local.usageLogs, remote.usageLogs),
    maintenanceLogs: preferLongerList(local.maintenanceLogs, remote.maintenanceLogs),
    equipmentReports: mergeEquipmentReports(local.equipmentReports, remote.equipmentReports),
    sales: mergeByKey(local.sales, remote.sales, saleKey),
    expenses: mergeByKey(local.expenses, remote.expenses, expenseKey),
    payroll: mergeByKey(local.payroll, remote.payroll, payrollKey),
    coffeeFields: mergeByKey(local.coffeeFields, remote.coffeeFields, coffeeFieldKey),
    irrigationSystems: mergeByKey(local.irrigationSystems, remote.irrigationSystems, irrigationSystemKey),
    irrigationDamageReports: mergeByKey(local.irrigationDamageReports, remote.irrigationDamageReports, irrigationDamageReportKey),
    pestControlLogs: mergePestControlLogs(local.pestControlLogs, remote.pestControlLogs),
    consumableSupplies: mergeByKey(local.consumableSupplies, remote.consumableSupplies, consumableSupplyKey),
    consumableReports: mergeByKey(local.consumableReports, remote.consumableReports, consumableReportKey),
    smsMessages: mergeByKey(local.smsMessages, remote.smsMessages, smsMessageKey),
  });
}

/**
 * Before uploading from the web portal, start from the editor state (local) so new
 * workers and other admin edits are not replaced by an older Firestore snapshot.
 *
 * `baseline` is this browser tab's own state immediately before the edit that produced `local`
 * (i.e. what this tab last knew from Firestore) -- see mergeByKeyRespectingDeletion for why it's
 * required: without it, a plain union merge can only ever add rows, because "in remote but not
 * in local" is indistinguishable between "added elsewhere" and "the admin just deleted this,"
 * and defaulting to the union always resurrects the second case. That made a coffee field (or a
 * worker, equipment row, sale, etc.) impossible to actually delete through the website -- the
 * very next save of anything would silently bring it back, whether or not any tab's data was
 * stale. Every field below is merged with baseline-aware deletion handling for that reason; do
 * not swap any of these back to a bare union merge or a bare `local.<field>` override.
 */
export function mergeStateForCloudUpload(local: AppState, remote: AppState, baseline: AppState): AppState {
  if (totalItemCount(remote) === 0) return normalizeAppState(local);

  return normalizeAppState({
    ...local,
    workers: mergeByKeyRespectingDeletion(baseline.workers, local.workers, remote.workers, workerKey),
    attendance: mergeByKeyRespectingDeletion(baseline.attendance, local.attendance, remote.attendance, attendanceKey),
    timesheetCorrections: mergeByKeyRespectingDeletion(baseline.timesheetCorrections, local.timesheetCorrections, remote.timesheetCorrections, timesheetCorrectionKey),
    leaveRequests: mergeByKeyRespectingDeletion(baseline.leaveRequests, local.leaveRequests, remote.leaveRequests, leaveRequestKey),
    tasks: mergeByKeyRespectingDeletion(baseline.tasks, local.tasks, remote.tasks, (t) => JSON.stringify(t)),
    sections: mergeByKeyRespectingDeletion(baseline.sections, local.sections, remote.sections, (s) => JSON.stringify(s)),
    trees: mergeByKeyRespectingDeletion(baseline.trees, local.trees, remote.trees, treeKey),
    cherryGrades: mergeCherryGrades(local.cherryGrades, remote.cherryGrades),
    treeRipenessScans: mergeTreeRipenessScans(local.treeRipenessScans, remote.treeRipenessScans),
    harvestSchedules: mergeByKeyRespectingDeletion(baseline.harvestSchedules, local.harvestSchedules, remote.harvestSchedules, (h) => JSON.stringify(h)),
    harvestReadinessReports: mergeHarvestReadinessReports(local.harvestReadinessReports, remote.harvestReadinessReports),
    flowering: mergeByKeyRespectingDeletion(baseline.flowering, local.flowering, remote.flowering, (f) => JSON.stringify(f)),
    cherryHarvests: mergeByKeyRespectingDeletion(baseline.cherryHarvests, local.cherryHarvests, remote.cherryHarvests, cherryHarvestKey),
    batches: mergeByKeyRespectingDeletion(baseline.batches, local.batches, remote.batches, batchKey),
    equipment: mergeByKeyRespectingDeletion(baseline.equipment, local.equipment, remote.equipment, equipmentKey),
    productListings: mergeByKeyRespectingDeletion(baseline.productListings, local.productListings, remote.productListings, productListingKey),
    usageLogs: mergeByKeyRespectingDeletion(baseline.usageLogs, local.usageLogs, remote.usageLogs, (u) => JSON.stringify(u)),
    maintenanceLogs: mergeByKeyRespectingDeletion(baseline.maintenanceLogs, local.maintenanceLogs, remote.maintenanceLogs, (m) => JSON.stringify(m)),
    equipmentReports: mergeEquipmentReports(local.equipmentReports, remote.equipmentReports),
    sales: mergeByKeyRespectingDeletion(baseline.sales, local.sales, remote.sales, saleKey),
    expenses: mergeByKeyRespectingDeletion(baseline.expenses, local.expenses, remote.expenses, expenseKey),
    payroll: mergeByKeyRespectingDeletion(baseline.payroll, local.payroll, remote.payroll, payrollKey),
    coffeeFields: mergeByKeyRespectingDeletion(baseline.coffeeFields, local.coffeeFields, remote.coffeeFields, coffeeFieldKey),
    irrigationSystems: mergeByKeyRespectingDeletion(baseline.irrigationSystems, local.irrigationSystems, remote.irrigationSystems, irrigationSystemKey),
    irrigationDamageReports: mergeByKeyRespectingDeletion(baseline.irrigationDamageReports, local.irrigationDamageReports, remote.irrigationDamageReports, irrigationDamageReportKey),
    pestControlLogs: mergePestControlLogs(local.pestControlLogs, remote.pestControlLogs),
    consumableSupplies: mergeByKeyRespectingDeletion(baseline.consumableSupplies, local.consumableSupplies, remote.consumableSupplies, consumableSupplyKey),
    consumableReports: mergeByKeyRespectingDeletion(baseline.consumableReports, local.consumableReports, remote.consumableReports, consumableReportKey),
    smsMessages: mergeByKeyRespectingDeletion(baseline.smsMessages, local.smsMessages, remote.smsMessages, smsMessageKey),
  });
}
