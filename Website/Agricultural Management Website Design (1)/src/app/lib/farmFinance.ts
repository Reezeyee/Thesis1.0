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

export function payrollLineAmount(p: PayrollRecord): number {
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
  return (
    totalOperatingExpenses(state.expenses) +
    totalMaintenanceExpenses(state.maintenanceLogs) +
    totalPayrollExpenses(state.payroll)
  );
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
  if (key.includes('operator')) return 150;
  if (key.includes('maintenance')) return 180;
  if (key.includes('sorter')) return 200;
  if (key.includes('field manager') || key.includes('supervisor')) return 250;
  if (key.includes('quality') || key.includes('inspector')) return 300;
  if (key.includes('agronomist')) return 350;
  return 0;
}

export function estimateWorkerGross(roleRate: string, daysWorked = 22): number {
  const hourly = hourlyRateForWorkerRole(roleRate);
  if (hourly > 0) return Math.round(hourly * 8 * daysWorked);
  return 0;
}
