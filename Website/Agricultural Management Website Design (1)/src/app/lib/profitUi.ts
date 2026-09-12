import type {
  AppState,
  AttendanceRecord,
  ExpenseRecord,
  PayrollPaymentMethod,
  PayrollRecord,
  SaleRecord,
  WorkerRecord,
} from '../types/appState';
import { accumulateMonthChartRows } from './monthChartBuckets';
import { parseWorkerDetails } from './workerUi';
import {
  estimateWorkerGross,
  hourlyRateForWorkerRole,
  payrollLineAmount,
  saleLineTotal,
  totalExpenses,
  totalIncome,
} from './farmFinance';

export type ProfitTransaction = {
  id: number;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  buyer?: string;
};

export function transactionsFromAppState(state: AppState): ProfitTransaction[] {
  const income: ProfitTransaction[] = state.sales.map((s, i) => ({
    id: i + 1,
    date: s.date,
    type: 'income' as const,
    category: s.type || 'Sale',
    description: buyerDetailsLabel(s.details),
    amount: saleLineTotal(s),
    buyer: s.buyer,
  }));
  const expenseStart = income.length;
  const expenses: ProfitTransaction[] = state.expenses.map((e, i) => ({
    id: expenseStart + i + 1,
    date: e.date ?? '—',
    type: 'expense' as const,
    category: e.category,
    description: e.description,
    amount: e.amount,
  }));
  const payrollStart = expenseStart + expenses.length;
  const payrollExpenses: ProfitTransaction[] = state.payroll
    .filter((p) => p.paid)
    .map((p, i) => ({
      id: payrollStart + i + 1,
      date: p.date ?? '—',
      type: 'expense' as const,
      category: 'Payroll & wages',
      description: payrollTransactionDescription(p),
      amount: payrollLineAmount(p),
    }));
  return [...income, ...expenses, ...payrollExpenses];
}

export type ProfitBuyer = {
  id: number;
  name: string;
  location: string;
  totalPurchases: number;
  lastOrder: string;
  status: 'active' | 'inactive';
  role?: string;
  category: 'channel' | 'cafe' | 'custom';
  hubIndex?: number;
  osmNodeId?: number;
  lat?: number;
  lng?: number;
  addressLine?: string;
  municipalityLabel?: string;
};

export type BuyerSaleMeta = {
  location?: string;
  status?: 'active' | 'inactive';
  addressLine?: string;
  lat?: number;
  lng?: number;
  role?: string;
  category?: ProfitBuyer['category'];
  hubIndex?: number;
  osmNodeId?: number;
  municipalityLabel?: string;
};

/** Parse sale.details — plain text (legacy) or JSON with buyer profile fields. */
export function parseBuyerSaleDetails(details: string): { location: string; meta: BuyerSaleMeta } {
  const trimmed = details?.trim() ?? '';
  if (!trimmed) return { location: 'Bataan', meta: { status: 'active' } };
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const status = parsed.status === 'inactive' ? 'inactive' : 'active';
      const location = String(parsed.location ?? parsed.addressLine ?? '').trim();
      return {
        location: location || 'Bataan',
        meta: {
          status,
          location,
          addressLine: parsed.addressLine != null ? String(parsed.addressLine) : undefined,
          lat: typeof parsed.lat === 'number' ? parsed.lat : undefined,
          lng: typeof parsed.lng === 'number' ? parsed.lng : undefined,
          role: parsed.role != null ? String(parsed.role) : undefined,
          category:
            parsed.category === 'channel' || parsed.category === 'cafe' || parsed.category === 'custom'
              ? parsed.category
              : undefined,
          hubIndex: typeof parsed.hubIndex === 'number' ? parsed.hubIndex : undefined,
          osmNodeId: typeof parsed.osmNodeId === 'number' ? parsed.osmNodeId : undefined,
          municipalityLabel: parsed.municipalityLabel != null ? String(parsed.municipalityLabel) : undefined,
        },
      };
    } catch {
      /* legacy plain text */
    }
  }
  return { location: trimmed, meta: { status: 'active', location: trimmed } };
}

export function buyerDetailsLabel(details: string): string {
  return parseBuyerSaleDetails(details).location;
}

/** Encode buyer profile into sale.details (JSON when status or extra fields are set). */
export function encodeBuyerSaleDetails(meta: BuyerSaleMeta): string {
  const location = meta.location?.trim() || meta.addressLine?.trim() || '';
  const hasExtra =
    meta.status === 'inactive' ||
    Boolean(meta.addressLine?.trim()) ||
    meta.lat != null ||
    meta.lng != null ||
    Boolean(meta.role?.trim()) ||
    meta.category != null ||
    meta.hubIndex != null ||
    meta.osmNodeId != null ||
    Boolean(meta.municipalityLabel?.trim());
  if (!hasExtra) return location;
  return JSON.stringify({
    location,
    status: meta.status === 'inactive' ? 'inactive' : 'active',
    ...(meta.addressLine?.trim() ? { addressLine: meta.addressLine.trim() } : {}),
    ...(meta.lat != null && !Number.isNaN(meta.lat) ? { lat: meta.lat } : {}),
    ...(meta.lng != null && !Number.isNaN(meta.lng) ? { lng: meta.lng } : {}),
    ...(meta.role?.trim() ? { role: meta.role.trim() } : {}),
    ...(meta.category ? { category: meta.category } : {}),
    ...(meta.hubIndex != null ? { hubIndex: meta.hubIndex } : {}),
    ...(meta.osmNodeId != null ? { osmNodeId: meta.osmNodeId } : {}),
    ...(meta.municipalityLabel?.trim() ? { municipalityLabel: meta.municipalityLabel.trim() } : {}),
  });
}

export function buyersFromSales(sales: SaleRecord[]): ProfitBuyer[] {
  const map = new Map<string, { total: number; lastOrder: string; count: number; details: string }>();
  for (const s of sales) {
    const cur = map.get(s.buyer) ?? { total: 0, lastOrder: s.date, count: 0, details: s.details };
    cur.total += saleLineTotal(s);
    cur.count += 1;
    if (s.date >= cur.lastOrder) {
      cur.lastOrder = s.date;
      if (s.details) cur.details = s.details;
    }
    map.set(s.buyer, cur);
  }
  return [...map.entries()].map(([name, v], id) => {
    const { location, meta } = parseBuyerSaleDetails(v.details);
    return {
      id: id + 1,
      category: meta.category ?? 'custom',
      name,
      location,
      totalPurchases: v.total,
      lastOrder: v.lastOrder,
      status: meta.status === 'inactive' ? 'inactive' : 'active',
      role: meta.role ?? `${v.count} order${v.count === 1 ? '' : 's'}`,
      hubIndex: meta.hubIndex,
      osmNodeId: meta.osmNodeId,
      lat: meta.lat,
      lng: meta.lng,
      addressLine: meta.addressLine,
      municipalityLabel: meta.municipalityLabel,
    };
  });
}

export function saleRecordFromBuyerForm(
  name: string,
  details: string,
  date: string,
  amount: number,
): SaleRecord {
  return {
    buyer: name,
    details,
    date,
    total: amount,
    type: 'green_bean',
    saleId: crypto.randomUUID(),
    quantityKg: 0,
    pricePerKg: 0,
  };
}

export function expenseRecordFromTx(tx: ProfitTransaction): ExpenseRecord {
  return {
    category: tx.category,
    description: tx.description,
    amount: tx.amount,
    date: tx.date,
    expenseId: crypto.randomUUID(),
  };
}

export type PayrollStaffRow = {
  id: number;
  name: string;
  role: string;
  monthlyGross: number;
  workerId: string;
  status: 'active' | 'inactive';
  calculationType?: 'estimate' | 'attendance' | 'paid_payroll';
  actualHours?: number;
};

export function payrollRosterFromWorkers(
  workers: WorkerRecord[],
  payroll: PayrollRecord[],
  attendance: AttendanceRecord[] = [],
  currentPeriod: string = currentPayPeriodLabel()
): PayrollStaffRow[] {
  return workers.map((w, id) => {
    const meta = parseWorkerDetails(w.details);
    const status = meta.status === 'inactive' ? 'inactive' : 'active';
    const rate = hourlyRateForWorkerRole(w.roleRate);

    // Find all payroll records for this worker in this period
    const workerPayroll = payroll.filter(
      (p) => p.workerName === w.name && p.period === currentPeriod
    );

    const paidRecord = workerPayroll.find((p) => p.paid);

    let gross = 0;
    let calculationType: 'estimate' | 'attendance' | 'paid_payroll' = 'estimate';
    let actualHours = 0;

    if (paidRecord) {
      gross = payrollLineAmount(paidRecord);
      calculationType = 'paid_payroll';
      actualHours = paidRecord.hoursWorked ?? 0;
    } else {
      const unpaidPayroll = workerPayroll.filter((p) => !p.paid);
      if (unpaidPayroll.length > 0) {
        gross = unpaidPayroll.reduce((sum, p) => sum + payrollLineAmount(p), 0);
        calculationType = 'attendance';
        actualHours = unpaidPayroll.reduce((sum, p) => sum + (p.hoursWorked ?? 0), 0);
      } else {
        // Look at their actual attendance logs for this period
        const workerAttendance = attendance.filter((a) => {
          if (a.workerName.trim().toLowerCase() !== w.name.trim().toLowerCase()) return false;
          if (!a.date) return false;
          const parsed = Date.parse(a.date);
          if (!Number.isFinite(parsed)) return false;
          const periodLabel = new Date(parsed).toLocaleString('en-US', { month: 'long', year: 'numeric' });
          return periodLabel === currentPeriod;
        });

        if (workerAttendance.length > 0) {
          actualHours = workerAttendance.reduce((sum, a) => sum + (a.hoursWorked ?? 0), 0);
          gross = Math.round(rate * actualHours);
          calculationType = 'attendance';
        } else {
          gross = status === 'inactive' ? 0 : estimateWorkerGross(w.roleRate);
          calculationType = 'estimate';
          actualHours = status === 'inactive' ? 0 : 22 * 8;
        }
      }
    }

    return {
      id,
      name: w.name,
      role: w.roleRate,
      monthlyGross: gross,
      workerId: w.workerId || `w-${id}`,
      status,
      calculationType,
      actualHours,
    };
  });
}

export type PayrollHistoryUi = {
  id: string;
  coverPeriodLabel: string;
  paycheckDateLabel: string;
  recordedAtLabel: string;
  referenceNumber: string;
  transcriptLines: {
    workerId: number;
    name: string;
    role: string;
    amount: number;
    paidAtLabel?: string;
    slipRef?: string;
  }[];
  total: number;
};

export function payrollHistoryFromRecords(payroll: PayrollRecord[]): PayrollHistoryUi[] {
  const paid = payroll.filter((p) => p.paid);
  const byPeriod = new Map<string, PayrollRecord[]>();
  for (const p of paid) {
    const key = p.period?.trim() || 'Payroll';
    const list = byPeriod.get(key) ?? [];
    list.push(p);
    byPeriod.set(key, list);
  }
  return [...byPeriod.entries()].map(([period, lines], idx) => ({
    id: `pay-${idx}-${period.replace(/\s+/g, '-')}`,
    coverPeriodLabel: period,
    paycheckDateLabel: lines[0]?.date ?? '—',
    recordedAtLabel: lines[0]?.date ?? '—',
    referenceNumber: lines[0]?.receiptNumber || lines[0]?.workerId || `PAY-${idx + 1}`,
    transcriptLines: lines.map((p, workerId) => ({
      workerId,
      name: p.workerName,
      role: '',
      amount: payrollLineAmount(p),
      paidAtLabel: p.date ?? undefined,
      slipRef: p.receiptNumber || p.workerId || undefined,
    })),
    total: lines.reduce((sum, p) => sum + payrollLineAmount(p), 0),
  }));
}

export function currentPayPeriodLabel(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function isWorkerPaidForPeriod(payroll: PayrollRecord[], workerName: string, period: string): boolean {
  return payroll.some((p) => p.workerName === workerName && p.period === period && p.paid);
}

/**
 * Wages already earned for the current pay period but not yet disbursed -- an accrued liability.
 * Excludes inactive workers (no current obligation) and anyone already paid for the period.
 * This is what keeps "Net Profit" honest: a big sale shouldn't look like pure profit if the
 * labor that produced it is still owed.
 */
export function accruedUnpaidPayrollTotal(
  roster: PayrollStaffRow[],
  payroll: PayrollRecord[],
  currentPeriod: string,
): number {
  return roster
    .filter((r) => r.status !== 'inactive' && !isWorkerPaidForPeriod(payroll, r.name, currentPeriod))
    .reduce((sum, r) => sum + r.monthlyGross, 0);
}

export function payrollPaymentMethodLabel(method: PayrollPaymentMethod): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'bank':
      return 'Bank transfer';
    case 'e-money':
      return 'E-money';
    default:
      return method;
  }
}

export function payrollTransactionDescription(p: PayrollRecord): string {
  const base = `Payroll — ${p.workerName} · ${p.period}`;
  if (!p.paymentMethod) return base;
  return `${base} · ${payrollPaymentMethodLabel(p.paymentMethod)}`;
}

export function payrollRecordForWorker(
  worker: WorkerRecord,
  period: string,
  paid: boolean,
  date: string,
  slipRef?: string,
  paymentMethod?: PayrollPaymentMethod,
): PayrollRecord {
  const hourlyRate = hourlyRateForWorkerRole(worker.roleRate);
  const daysWorked = 22;
  const hoursWorked = 8 * daysWorked;
  const amount =
    hourlyRate > 0 ? Math.round(hourlyRate * hoursWorked) : estimateWorkerGross(worker.roleRate);
  return {
    workerName: worker.name,
    period,
    amount,
    paid,
    date,
    workerId: worker.workerId?.trim() || '',
    receiptNumber: slipRef || undefined,
    hourlyRate,
    hoursWorked,
    daysWorked,
    dailyRate: 0,
    paymentMethod: paymentMethod ?? null,
  };
}

export function buildExpensePieSlices(
  transactions: ProfitTransaction[],
  colors: readonly string[],
): { name: string; value: number; color: string }[] {
  const byCat = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  }
  return [...byCat.entries()].map(([name, value], i) => ({
    name,
    value,
    color: colors[i % colors.length] ?? '#4a2c2a',
  }));
}

export function buildBuyerSalesDataFromBuyers(
  buyers: ProfitBuyer[],
): { name: string; sales: number }[] {
  return [...buyers]
    .filter((b) => b.totalPurchases > 0)
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 12)
    .map((b) => ({ name: b.name, sales: b.totalPurchases }));
}

export function revenueChartFromState(state: AppState): { month: string; revenue: number; expenses: number; profit: number }[] {
  const rows = accumulateMonthChartRows(state);
  if (rows.length === 0) {
    const rev = totalIncome(state.sales);
    const exp = totalExpenses(state);
    return [{ month: 'All time', revenue: rev, expenses: exp, profit: rev - exp }];
  }
  return rows.map(({ month, sales, expenses, profit }) => ({
    month,
    revenue: sales,
    expenses,
    profit,
  }));
}
