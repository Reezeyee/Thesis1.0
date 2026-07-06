import type { AppState, EquipmentConditionReport, MaintenanceRecord, UsageLogRecord } from '../types/appState';
import { parseMoneyAmount } from './farmFinance';
import { currentMonthSortKey, monthLabelFromSortKey, monthSortKeyFromDate } from './chartTheme';
import { CHART_EQUIPMENT_STATUS } from './chartTheme';

export type EquipmentUiStatus = 'available' | 'in-use' | 'maintenance' | 'damaged';

export function mapEquipStatus(s: string): EquipmentUiStatus {
  const k = s.toLowerCase();
  if (k.includes('use')) return 'in-use';
  if (k.includes('maint')) return 'maintenance';
  if (k.includes('damage') || k.includes('repair') || k.includes('broken') || k.includes('wreck'))
    return 'damaged';
  return 'available';
}

/** Parse "3.5h", "3.5 h", "4" into hours (supports decimals). */
export function parseUsageHours(hoursText: string): number {
  const numeric = hoursText.trim().replace(/,/g, '').replace(/[^\d.]/g, '');
  const n = parseFloat(numeric);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

export function maintenanceLogKey(log: MaintenanceRecord): string {
  return [log.equipmentName.trim().toLowerCase(), log.date ?? '', log.details.trim()].join('\u0001');
}

export function equipmentReportKey(report: EquipmentConditionReport): string {
  return [
    report.equipmentName.trim().toLowerCase(),
    report.reportedAt || '',
    report.notes.trim(),
  ].join('\u0001');
}

export function latestMaintenanceLabel(
  logs: MaintenanceRecord[],
  equipmentName: string,
): string {
  const target = equipmentName.trim().toLowerCase();
  let bestKey: string | null = null;
  let bestDate = '';
  for (const log of logs) {
    if (log.equipmentName.trim().toLowerCase() !== target) continue;
    const sortKey = monthSortKeyFromDate(log.date);
    const key = sortKey ?? `z-${log.date ?? ''}`;
    if (bestKey === null || key > bestKey) {
      bestKey = key;
      bestDate = log.date ?? '';
    }
  }
  if (!bestDate) return '—';
  const sortKey = monthSortKeyFromDate(bestDate);
  return sortKey ? monthLabelFromSortKey(sortKey) : bestDate;
}

export function sumUsageHoursForEquipment(
  logs: UsageLogRecord[],
  equipmentName: string,
): number {
  const target = equipmentName.trim().toLowerCase();
  return logs
    .filter((u) => u.equipmentName.trim().toLowerCase() === target)
    .reduce((sum, u) => sum + parseUsageHours(u.hoursText), 0);
}

export type MonthMaintenanceChartRow = {
  sortKey: string;
  month: string;
  /** Maintenance log + worker report count for the month */
  logs: number;
  /** Equipment currently marked maintenance (snapshot on current month only) */
  inMaintenance: number;
  costPeso: number;
};

function resolveMaintenanceMonthKey(date: string | null | undefined): string {
  return monthSortKeyFromDate(date) ?? currentMonthSortKey();
}

function padMonthRows<T extends { sortKey: string; month: string }>(
  rows: T[],
  slotCount: number,
  emptyRow: (sortKey: string, month: string) => T,
): T[] {
  const dated = rows.filter((r) => r.sortKey !== '0000-00');
  if (dated.length === 0) return rows;

  const latestKey = dated.map((r) => r.sortKey).sort().at(-1)!;
  const [y, m] = latestKey.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return dated;

  const end = new Date(y, m - 1, 1);
  const start = new Date(end);
  start.setMonth(start.getMonth() - (slotCount - 1));

  const byKey = new Map(dated.map((r) => [r.sortKey, r]));
  const out: T[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const sortKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    out.push(byKey.get(sortKey) ?? emptyRow(sortKey, monthLabelFromSortKey(sortKey)));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Maintenance spend (₱) and log counts per month from real cost fields. */
export function buildMaintenanceMonthlyChart(
  state: AppState,
  slotCount = 6,
): MonthMaintenanceChartRow[] {
  const map = new Map<string, { logs: number; costPeso: number }>();

  const addLog = (date: string | null | undefined, costPeso: number) => {
    const key = resolveMaintenanceMonthKey(date);
    const cur = map.get(key) ?? { logs: 0, costPeso: 0 };
    cur.logs += 1;
    cur.costPeso += costPeso;
    map.set(key, cur);
  };

  for (const log of state.maintenanceLogs) {
    const cost = parseMoneyAmount(log.costText);
    addLog(log.date, cost);
  }

  for (const report of state.equipmentReports) {
    const hasMatchingLog = state.maintenanceLogs.some(
      (log) =>
        report.equipmentName.trim().toLowerCase() === log.equipmentName.trim().toLowerCase() &&
        (report.reportedAt || '') === (log.date ?? '') &&
        report.notes.trim() === log.details.trim(),
    );
    if (!hasMatchingLog) {
      addLog(report.reportedAt, 0);
    }
  }

  const fleetInMaintenance = state.equipment.filter(
    (e) => mapEquipStatus(e.status) === 'maintenance',
  ).length;

  if (map.size === 0 && fleetInMaintenance > 0) {
    map.set(currentMonthSortKey(), { logs: 0, costPeso: 0 });
  }

  const rows = [...map.entries()]
    .map(([sortKey, v]) => ({
      sortKey,
      month: monthLabelFromSortKey(sortKey),
      logs: v.logs,
      inMaintenance: 0,
      costPeso: v.costPeso,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const padded = padMonthRows(rows, slotCount, (sortKey, month) => ({
    sortKey,
    month,
    logs: 0,
    inMaintenance: 0,
    costPeso: 0,
  }));

  const currentKey = currentMonthSortKey();
  return padded.map((row) =>
    row.sortKey === currentKey
      ? { ...row, inMaintenance: fleetInMaintenance }
      : row,
  );
}

/** True when the maintenance chart should render (logs, spend, or fleet in maintenance). */
export function maintenanceChartHasData(
  rows: MonthMaintenanceChartRow[],
  state: AppState,
): boolean {
  if (rows.some((r) => r.logs > 0 || r.costPeso > 0 || r.inMaintenance > 0)) return true;
  return (
    state.maintenanceLogs.length > 0 ||
    state.equipmentReports.length > 0 ||
    state.equipment.some((e) => mapEquipStatus(e.status) === 'maintenance')
  );
}

export type StatusSlice = { name: string; value: number; color: string };

/** App maintenance notes that mean broken / needs repair (incl. Tagalog). */
export function maintenanceLogIndicatesDamage(details: string): boolean {
  const k = details.toLowerCase().trim();
  if (!k) return false;
  return (
    /nasira|sira|broken|wreck|damage|damaged|repair|defect|fault|not\s*working|hindi\s*gana|sira na/.test(k) ||
    k.includes('wala') && k.includes('gana')
  );
}

/**
 * Status for charts and badges: inventory plus worker reports and maintenance notes from the app.
 */
export function effectiveEquipmentStatus(
  equipmentName: string,
  inventoryStatus: string,
  state: AppState,
): EquipmentUiStatus {
  const name = equipmentName.trim().toLowerCase();
  const base = mapEquipStatus(inventoryStatus);

  const eqReports = state.equipmentReports
    .filter((r) => r.equipmentName.trim().toLowerCase() === name)
    .sort((a, b) => (b.reportedAt || '').localeCompare(a.reportedAt || ''));
  const latestReport = eqReports[0];
  if (latestReport) {
    if (latestReport.fixedAt || latestReport.isFixedReport) return 'available';
    if (latestReport.isWrecked && !latestReport.fixedAt) return 'damaged';
  }

  const openBroken = state.equipmentReports.some(
    (r) =>
      r.isWrecked &&
      !r.isFixedReport &&
      !r.fixedAt &&
      r.equipmentName.trim().toLowerCase() === name,
  );
  if (openBroken) return 'damaged';

  const logs = state.maintenanceLogs.filter(
    (l) => l.equipmentName.trim().toLowerCase() === name,
  );
  if (logs.some((l) => maintenanceLogIndicatesDamage(l.details))) return 'damaged';

  if (logs.length > 0 && base === 'available') return 'maintenance';

  return base;
}

/** Fleet status from inventory, app maintenance notes, and worker reports. */
export function buildEquipmentStatusSlices(state: AppState): StatusSlice[] {
  const counts = { available: 0, 'in-use': 0, maintenance: 0, damaged: 0 };

  for (const e of state.equipment) {
    counts[effectiveEquipmentStatus(e.name, e.status, state)] += 1;
  }

  const slices: StatusSlice[] = [
    { name: 'Available', value: counts.available, color: CHART_EQUIPMENT_STATUS.available },
    { name: 'In Use', value: counts['in-use'], color: CHART_EQUIPMENT_STATUS['in-use'] },
    { name: 'Maintenance', value: counts.maintenance, color: CHART_EQUIPMENT_STATUS.maintenance },
    { name: 'Damaged', value: counts.damaged, color: CHART_EQUIPMENT_STATUS.damaged },
  ];
  return slices.filter((s) => s.value > 0);
}

export function buildUsageByEquipmentChart(
  state: AppState,
): { equipment: string; hours: number }[] {
  const map = new Map<string, number>();
  for (const u of state.usageLogs) {
    const name = u.equipmentName.trim() || 'Unknown';
    map.set(name, (map.get(name) ?? 0) + parseUsageHours(u.hoursText));
  }
  return [...map.entries()]
    .map(([equipment, hours]) => ({ equipment, hours }))
    .filter((row) => row.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);
}

export function pendingMaintenanceIssueCount(state: AppState): number {
  let n = 0;
  for (const e of state.equipment) {
    const effective = effectiveEquipmentStatus(e.name, e.status, state);
    if (effective === 'damaged' || effective === 'maintenance') n += 1;
  }
  return n;
}
