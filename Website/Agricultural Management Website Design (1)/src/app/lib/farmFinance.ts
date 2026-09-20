import type {
  AppState,
  CherryHarvestRecord,
  ExpenseRecord,
  MaintenanceRecord,
  PayrollRecord,
  SaleRecord,
} from '../types/appState';

export function saleLineTotal(s: SaleRecord): number {
  if ((s.quantityKg ?? 0) > 0 && (s.pricePerKg ?? 0) > 0) {
    return Math.round((s.quantityKg ?? 0) * (s.pricePerKg ?? 0));
  }
  return s.total;
}

export function parseHarvestKg(h: CherryHarvestRecord): number {
  const t = h.weightText.replace(/[^\d.]/g, '');
  return parseFloat(t) || 0;
}

export function totalIncome(sales: SaleRecord[]): number {
  return sales.reduce((sum, s) => sum + saleLineTotal(s), 0);
}

/** Total kilograms sold across sale records that have a tracked quantity (quantityKg > 0). */
export function totalKgSold(sales: SaleRecord[]): number {
  return sales.reduce((sum, s) => sum + (s.quantityKg && s.quantityKg > 0 ? s.quantityKg : 0), 0);
}

export function totalOperatingExpenses(expenses: ExpenseRecord[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function parseMoneyAmount(raw: string): number {
  const numeric = raw.trim().replace(/,/g, '').replace(/[^\d.]/g, '');
  return Math.round(parseFloat(numeric) || 0);
}

export function totalMaintenanceExpenses(logs: MaintenanceRecord[]): number {
  return logs.reduce((sum, l) => sum + parseMoneyAmount(l.costText), 0);
}

/** Standard paid shift: 8:00 AM-5:00 PM minus a 1-hour unpaid lunch = 8 paid regular hours/day. */
export const STANDARD_SHIFT_HOURS = 8.0;

/** Overtime pay bonus: hours worked beyond STANDARD_SHIFT_HOURS are paid at hourlyRate x this. */
export const OVERTIME_MULTIPLIER = 1.25;

/**
 * Splits totalHours into { regularHours, overtimeHours } against STANDARD_SHIFT_HOURS. Returns
 * null when there is nothing to split yet (null/undefined or non-positive hours), so callers can
 * tell "not clocked out yet" apart from "worked zero hours."
 */
export function splitRegularAndOvertimeHours(
  totalHours: number | null | undefined,
): { regularHours: number; overtimeHours: number } | null {
  const hours = totalHours ?? 0;
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const regularHours = Math.min(hours, STANDARD_SHIFT_HOURS);
  const overtimeHours = Math.max(0, hours - STANDARD_SHIFT_HOURS);
  return { regularHours, overtimeHours };
}

/** e.g. "8.00 h regular + 1.50 h overtime (×1.25 rate)", or just "8.00 h regular" with no overtime. */
export function formatHoursBreakdown(
  regularHours: number | null | undefined,
  overtimeHours?: number | null,
): string | null {
  if (regularHours == null) return null;
  const ot = overtimeHours ?? 0;
  const base = `${regularHours.toFixed(2)} h regular`;
  if (ot <= 0) return base;
  return `${base} + ${ot.toFixed(2)} h overtime (×${OVERTIME_MULTIPLIER.toFixed(2)} rate)`;
}

/** Convenience overload: splits totalHours first, then formats the breakdown. */
export function formatHoursBreakdownFromTotal(totalHours: number | null | undefined): string | null {
  const split = splitRegularAndOvertimeHours(totalHours);
  if (!split) return null;
  return formatHoursBreakdown(split.regularHours, split.overtimeHours);
}

/**
 * When PayrollRecord.regularHours / overtimeHours are present, overtime hours are paid at
 * hourlyRate x OVERTIME_MULTIPLIER; older rows without a split fall back to the flat
 * hourlyRate x hoursWorked (or dailyRate x daysWorked) behavior unchanged.
 */
export function payrollLineAmount(p: PayrollRecord): number {
  const regular = p.regularHours;
  const overtime = p.overtimeHours;
  const hasSplit = (regular ?? 0) > 0 || (overtime ?? 0) > 0;
  if ((p.hourlyRate ?? 0) > 0 && hasSplit) {
    return Math.round((p.hourlyRate ?? 0) * (regular ?? 0) + (p.hourlyRate ?? 0) * OVERTIME_MULTIPLIER * (overtime ?? 0));
  }
  if ((p.hourlyRate ?? 0) > 0 && (p.hoursWorked ?? 0) > 0) {
    return Math.round((p.hourlyRate ?? 0) * (p.hoursWorked ?? 0));
  }
  if ((p.dailyRate ?? 0) > 0 && (p.daysWorked ?? 0) > 0) {
    return Math.round((p.dailyRate ?? 0) * (p.daysWorked ?? 0));
  }
  return p.amount;
}

export function totalPayrollExpenses(payroll: PayrollRecord[]): number {
  return payroll.filter((p) => p.paid).reduce((sum, p) => sum + payrollLineAmount(p), 0);
}

export function totalExpenses(state: AppState): number {
  // Maintenance-log entries with a cost are always paired with a matching `expenses` record
  // (see EquipmentManagement's markReportFixed), so totalMaintenanceExpenses is NOT added here
  // to avoid double-counting the same repair cost twice.
  return totalOperatingExpenses(state.expenses) + totalPayrollExpenses(state.payroll);
}

export function netProfit(state: AppState): number {
  return totalIncome(state.sales) - totalExpenses(state);
}

export function totalHarvestKgToday(state: AppState, todayLabel: string): number {
  return state.cherryHarvests
    .filter((h) => (h.date ?? '').includes(todayLabel) || h.date === todayLabel)
    .reduce((sum, h) => sum + parseHarvestKg(h), 0);
}

export function distinctRoles(workers: AppState['workers']): number {
  return new Set(workers.map((w) => w.roleRate)).size;
}

export function hourlyRateForWorkerRole(roleRate: string): number {
  const key = roleRate.trim().toLowerCase();
  if (key === 'picker' || key.includes('harvester')) return 50;
  if (key.includes('farm assist')) return 150;
  if (key.includes('maintenance')) return 180;
  if (key.includes('farm manager')) return 250;
  return 0;
}

/** Job responsibilities shown to admin when assigning a role, and on a worker's profile. */
export const ROLE_RESPONSIBILITIES: Record<string, string[]> = {
  Picker: ['Harvesting ripe coffee/cacao cherries and other fruit from the trees'],
  Maintenance: [
    'Upkeep and repair of farm and resort equipment',
    'Reporting and fixing broken equipment',
  ],
  'Farm Manager': [
    'Oversees the upkeep of the resort and the farm',
    'Recommends strategies to improve the farm produce',
    'Plans for marketing activities to advertise the resort',
  ],
  'Farm Assist': [
    'Grasscutting and cleaning of the premises, both the farm and the resort grounds',
    'Dogkeeper (feed them, clean their cages, etc)',
    'Pruning/weeding of Coffee and Cacao trees and all other fruitbearing trees of the land',
    'Composting (Vermi/Milli)',
    'Upkeep of the nursery',
    'Planting of crops/trees as needed',
    'Application of Fertilizer/insecticide as need be',
  ],
};

export function responsibilitiesForWorkerRole(roleRate: string): string[] {
  const key = roleRate.trim().toLowerCase();
  const match = Object.keys(ROLE_RESPONSIBILITIES).find((r) => key.includes(r.toLowerCase()));
  return match ? ROLE_RESPONSIBILITIES[match] : [];
}

export function estimateWorkerGross(roleRate: string, daysWorked = 22): number {
  const hourly = hourlyRateForWorkerRole(roleRate);
  if (hourly > 0) return Math.round(hourly * 8 * daysWorked);
  return 0;
}
