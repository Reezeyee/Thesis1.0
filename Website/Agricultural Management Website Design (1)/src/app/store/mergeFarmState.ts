import {
  normalizeAppState,
  totalItemCount,
  type AppState,
  type CherryGradeRecord,
  type ConsumableSupplyReportRecord,
  type EquipmentConditionReport,
  type HarvestReadinessReportRecord,
  type TreeRipenessScanRecord,
} from '../types/appState';

function mergeByKey<T>(local: T[], remote: T[], keyFor: (item: T) => string): T[] {
  const remoteKeys = new Set(remote.map(keyFor));
  const extras = local.filter((item) => !remoteKeys.has(keyFor(item)));
  return [...remote, ...extras];
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
  ].join('\u0001');
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
  return [r.treeId, String(r.timestampMillis), r.ripenessLabel, r.sourceGrade ?? ''].join('\u0001');
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
  return [r.equipmentName, r.reportedAt, r.reportedBy ?? '', String(r.isWrecked), r.notes].join('\u0001');
}

function harvestReadinessReportKey(r: HarvestReadinessReportRecord): string {
  if (r.reportId) return r.reportId;
  return [r.zone, r.expectedWeight, r.reportedBy, r.reportedAt].join('\u0001');
}

function consumableReportKey(r: ConsumableSupplyReportRecord): string {
  if (r.reportId) return r.reportId;
  return [r.supplyId ?? '', r.supplyName, r.reportedAt, r.reportedBy].join('\u0001');
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
    workers: mergeByKey(local.workers, remote.workers, (w) =>
      (w.workerId ?? '').trim() || [w.name, w.roleRate, w.phoneNumber ?? ''].join('\u0001'),
    ),
    attendance: mergeByKey(local.attendance, remote.attendance, (a) =>
      (a.attendanceId ?? '').trim() ||
      [a.workerName, a.date ?? '', a.clockIn ?? '', a.clockOut ?? '', a.details].join('\u0001'),
    ),
    tasks: preferLongerList(local.tasks, remote.tasks),
    sections: preferLongerList(local.sections, remote.sections),
    trees: mergeByKey(local.trees, remote.trees, (t) =>
      (t.treeId ?? '').trim() || [t.sectionName, t.details, t.stage].join('\u0001'),
    ),
    cherryGrades: mergeCherryGrades(local.cherryGrades, remote.cherryGrades),
    treeRipenessScans: mergeTreeRipenessScans(local.treeRipenessScans, remote.treeRipenessScans),
    harvestSchedules: preferLongerList(local.harvestSchedules, remote.harvestSchedules),
    harvestReadinessReports: mergeByKey(local.harvestReadinessReports, remote.harvestReadinessReports, harvestReadinessReportKey),
    flowering: preferLongerList(local.flowering, remote.flowering),
    cherryHarvests: mergeByKey(local.cherryHarvests, remote.cherryHarvests, (h) =>
      (h.harvestId ?? '').trim() || [h.batchId, h.date ?? '', h.weightText, h.details].join('\u0001'),
    ),
    batches: mergeByKey(local.batches, remote.batches, (b) =>
      b.batchId.trim() || [b.label, b.status, b.treeId ?? ''].join('\u0001'),
    ),
    equipment: mergeByKey(local.equipment, remote.equipment, (e) => e.name.trim().toLowerCase()),
    usageLogs: preferLongerList(local.usageLogs, remote.usageLogs),
    maintenanceLogs: preferLongerList(local.maintenanceLogs, remote.maintenanceLogs),
    equipmentReports: mergeEquipmentReports(local.equipmentReports, remote.equipmentReports),
    sales: mergeByKey(local.sales, remote.sales, (s) =>
      (s.saleId ?? '').trim() || [s.buyer, s.date, s.type, String(s.total), s.details].join('\u0001'),
    ),
    expenses: mergeByKey(local.expenses, remote.expenses, (e) =>
      (e.expenseId ?? '').trim() || [e.category, e.description, String(e.amount), e.date ?? ''].join('\u0001'),
    ),
    payroll: mergeByKey(local.payroll, remote.payroll, (p) =>
      (p.linkedAttendanceId ?? '').trim() ||
      [p.workerId ?? '', p.workerName, p.period, p.date ?? '', String(p.amount)].join('\u0001'),
    ),
    coffeeFields: mergeByKey(local.coffeeFields, remote.coffeeFields, (f) =>
      (f.fieldId ?? '').trim() || [f.name, f.area, f.variety].join('\u0001'),
    ),
    irrigationSystems: mergeByKey(local.irrigationSystems, remote.irrigationSystems, (i) =>
      (i.irrigationId ?? '').trim() || [i.zone, i.type, i.coverage].join('\u0001'),
    ),
    pestControlLogs: mergeByKey(local.pestControlLogs, remote.pestControlLogs, (p) =>
      (p.pestControlId ?? '').trim() || [p.date, p.field, p.issue, p.treatment].join('\u0001'),
    ),
    consumableSupplies: mergeByKey(local.consumableSupplies, remote.consumableSupplies, (s) =>
      s.supplyId.trim() || [s.name, s.category, s.unit].join('\u0001'),
    ),
    consumableReports: mergeByKey(local.consumableReports, remote.consumableReports, consumableReportKey),
  });
}

/**
 * Before uploading from the web portal, start from the editor state (local) so new
 * workers and other admin edits are not replaced by an older Firestore snapshot.
 */
export function mergeStateForCloudUpload(local: AppState, remote: AppState): AppState {
  if (totalItemCount(remote) === 0) return normalizeAppState(local);

  return normalizeAppState({
    ...mergeRemoteStatePreservingLocalGrades(local, remote),
    attendance: local.attendance,
    workers: mergeByKey(remote.workers, local.workers, (w) =>
      (w.workerId ?? '').trim() || [w.name, w.roleRate, w.phoneNumber ?? ''].join('\u0001'),
    ),
    cherryGrades: mergeCherryGrades(local.cherryGrades, remote.cherryGrades),
    treeRipenessScans: mergeTreeRipenessScans(local.treeRipenessScans, remote.treeRipenessScans),
    harvestReadinessReports: mergeByKey(remote.harvestReadinessReports, local.harvestReadinessReports, harvestReadinessReportKey),
    coffeeFields: local.coffeeFields,
    irrigationSystems: local.irrigationSystems,
    pestControlLogs: local.pestControlLogs,
    sales: local.sales,
    expenses: local.expenses,
    payroll: local.payroll,
    equipment: local.equipment,
    consumableSupplies: local.consumableSupplies,
    consumableReports: mergeByKey(remote.consumableReports, local.consumableReports, consumableReportKey),
  });
}
