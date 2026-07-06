import { useMemo, useState } from 'react';
import { useFarmData } from '../store/FarmDataProvider';
import { saleLineTotal, hourlyRateForWorkerRole } from '../lib/farmFinance';
import { runSave, showSaveError } from '../lib/saveFeedback';
import {
  buildBuyerSalesDataFromBuyers,
  buildExpensePieSlices,
  buyersFromSales,
  currentPayPeriodLabel,
  isWorkerPaidForPeriod,
  payrollHistoryFromRecords,
  payrollRecordForWorker,
  payrollRosterFromWorkers,
  revenueChartFromState,
  transactionsFromAppState,
} from '../lib/profitUi';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  MapPin,
  Calendar,
  Plus,
  Banknote,
  CheckCircle2,
  Edit2,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  CHART_COLORS,
  CHART_LINE_SERIES,
  CHART_LINE_WIDTH,
  chartSeriesEmpty,
  compactAxisFormatter,
  pesoFormatter,
  PIE_COLORS,
} from '../lib/chartTheme';
import {
  categoryXAxisProps,
  ChartLegendList,
  ChartPanel,
  ColoredDonutChart,
  farmAxisTick,
  farmChartBottomMargin,
  farmMonthXAxisProps,
  farmTooltipProps,
  pesoTooltipFormatter,
} from './charts/FarmCharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LUZON_BBOX } from '../data/luzonAddressCatalog';
import { PayrollPayFlowDialog, type PayrollPayTarget } from './PayrollPayFlowDialog';
import type { PayrollPaymentMethod } from '../types/appState';
import { payrollPaymentMethodLabel } from '../lib/profitUi';

/** Exhaustive expense types for sales & farm finance (used in forms and recorded transactions). */
export const EXPENSE_CATEGORY_OPTIONS = [
  'Transport & freight',
  'Fuel & logistics',
  'Packaging & materials',
  'Marketing & commissions',
  'Payroll & wages',
  'Supplies & farm inputs',
  'Equipment & maintenance',
  'Utilities',
  'Rent / land lease',
  'Insurance',
  'Licenses & permits',
  'Taxes & regulatory',
  'Bank & transaction fees',
  'Professional & legal fees',
  'Processing & drying',
  'Quality & certifications',
  'Warehousing & storage',
  'Other',
] as const;

export type BuyerCategory = 'channel' | 'cafe' | 'custom';

export interface Buyer {
  id: number;
  category: BuyerCategory;
  /** Set for coop / wholesale hubs (aligned with `BATAAN_MAP_HUBS`). */
  hubIndex?: number;
  /** OSM node id when category is café. */
  osmNodeId?: number;
  name: string;
  location: string;
  totalPurchases: number;
  lastOrder: string;
  status: 'active' | 'inactive';
  role?: string;
  lat?: number;
  lng?: number;
  addressLine?: string;
  /** Sub-area label for map popups (cafés). */
  municipalityLabel?: string;
}

interface Transaction {
  id: number;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  buyer?: string;
}

const PAYROLL_PAYDAY_NOTE =
  'Wages follow farm roles (hourly rates aligned with the Android app). Mark each worker Paid when disbursed; payroll lines sync to Firebase and appear in Transaction history.';

function dateLabel(d = new Date()): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseOptionalCoord(raw: string): number | undefined {
  const n = Number.parseFloat(raw.trim());
  return Number.isFinite(n) ? n : undefined;
}

function clampToLuzonBBox(lat: number, lng: number): { lat: number; lng: number } | null {
  if (lat < LUZON_BBOX.minLat || lat > LUZON_BBOX.maxLat || lng < LUZON_BBOX.minLng || lng > LUZON_BBOX.maxLng) {
    return null;
  }
  return { lat, lng };
}

export interface PayrollTranscriptLine {
  workerId: number;
  name: string;
  role: string;
  amount: number;
  paidAtLabel?: string;
  slipRef?: string;
}

export interface PayrollPaymentRecord {
  id: string;
  coverPeriodLabel: string;
  paycheckDateLabel: string;
  recordedAtLabel: string;
  referenceNumber: string;
  transcriptLines: PayrollTranscriptLine[];
  total: number;
}

export function ProfitManagement() {
  const { state, loading, updateState, saving } = useFarmData();
  const currentPeriod = currentPayPeriodLabel();

  const transactions = useMemo(() => transactionsFromAppState(state) as Transaction[], [state]);
  const buyers = useMemo(() => buyersFromSales(state.sales) as Buyer[], [state.sales]);
  const payrollRoster = useMemo(
    () => payrollRosterFromWorkers(state.workers, state.payroll, state.attendance, currentPeriod),
    [state.workers, state.payroll, state.attendance, currentPeriod],
  );
  const payrollHistory = useMemo(
    () => payrollHistoryFromRecords(state.payroll) as PayrollPaymentRecord[],
    [state.payroll],
  );
  const revenueData = useMemo(() => revenueChartFromState(state), [state]);
  const monthlyPayrollTotal = useMemo(
    () => payrollRoster.reduce((sum, r) => sum + r.monthlyGross, 0),
    [payrollRoster],
  );

  const [expandedPayId, setExpandedPayId] = useState<string | null>(null);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: EXPENSE_CATEGORY_OPTIONS[0] as string,
    description: '',
    amount: '',
    date: dateLabel(),
  });
  const [payFlowTarget, setPayFlowTarget] = useState<PayrollPayTarget | null>(null);
  const [payFlowOpen, setPayFlowOpen] = useState(false);

  const currentDue = useMemo(() => {
    if (payrollRoster.length === 0) return null;
    const hasUnpaid = payrollRoster.some(
      (r) => !isWorkerPaidForPeriod(state.payroll, r.name, currentPeriod),
    );
    if (!hasUnpaid) return null;
    return {
      coverPeriodLabel: currentPeriod,
      paycheckDateLabel: dateLabel(),
    };
  }, [payrollRoster, state.payroll, currentPeriod]);

  const paidThisRunCount = payrollRoster.filter((r) =>
    isWorkerPaidForPeriod(state.payroll, r.name, currentPeriod),
  ).length;

  const slipForWorker = (workerName: string) => {
    const row = state.payroll.find(
      (p) => p.workerName === workerName && p.period === currentPeriod && p.paid,
    );
    if (!row) return null;
    return {
      slipRef: row.receiptNumber?.trim() || row.workerId?.trim() || `PAY-${workerName.replace(/\s+/g, '-')}`,
      recordedAtLabel: row.date ?? '—',
      paymentMethod: row.paymentMethod ?? null,
    };
  };

  const openPayFlow = (workerId: number) => {
    if (!currentDue) return;
    const row = payrollRoster.find((w) => w.id === workerId);
    if (!row || isWorkerPaidForPeriod(state.payroll, row.name, currentPeriod)) return;
    setPayFlowTarget({
      workerId,
      name: row.name,
      role: row.role,
      amount: row.monthlyGross,
      periodLabel: currentDue.coverPeriodLabel,
      paycheckDateLabel: currentDue.paycheckDateLabel,
    });
    setPayFlowOpen(true);
  };

  const completePayWithMethod = async (method: PayrollPaymentMethod) => {
    if (!currentDue || !payFlowTarget) return null;
    const row = payrollRoster.find((w) => w.id === payFlowTarget.workerId);
    if (!row || isWorkerPaidForPeriod(state.payroll, row.name, currentPeriod)) return null;
    const worker = state.workers.find((w) => w.name === row.name);
    if (!worker) return null;

    const slipRef = `PCF-BW${payFlowTarget.workerId}-${Date.now().toString(36).toUpperCase().slice(-10)}`;
    const paycheckDate = currentDue.paycheckDateLabel;

    // Check if worker has any unpaid payroll records in state.payroll for this period
    const unpaidRecords = state.payroll.filter(
      (p) => p.workerName === worker.name && p.period === currentPeriod && !p.paid
    );

    const paidOk = await runSave('Payroll', () =>
      updateState((prev) => {
        let nextPayroll = [...prev.payroll];
        let nextAttendance = [...prev.attendance];

        if (unpaidRecords.length > 0) {
          // 1. Mark existing unpaid records as paid
          nextPayroll = nextPayroll.map((p) => {
            if (p.workerName === worker.name && p.period === currentPeriod && !p.paid) {
              return {
                ...p,
                paid: true,
                date: paycheckDate,
                paymentMethod: method,
                workerId: worker.workerId?.trim() || '',
                receiptNumber: slipRef,
              };
            }
            return p;
          });
        } else {
          // 2. Convert unlinked attendance records in the current pay period to paid payroll lines
          const workerAttendance = prev.attendance.filter((a) => {
            if (a.workerName.trim().toLowerCase() !== worker.name.trim().toLowerCase()) return false;
            if (!a.date) return false;
            const parsed = Date.parse(a.date);
            if (!Number.isFinite(parsed)) return false;
            const periodLabel = new Date(parsed).toLocaleString('en-US', { month: 'long', year: 'numeric' });
            return periodLabel === currentPeriod;
          });

          const existingLinkedIds = new Set(
            prev.payroll
              .map((p) => p.linkedAttendanceId?.trim())
              .filter(Boolean)
          );

          const unlinkedAttendance = workerAttendance.filter(
            (a) => !a.attendanceId || !existingLinkedIds.has(a.attendanceId.trim())
          );

          if (unlinkedAttendance.length > 0) {
            const newPayrollLines = unlinkedAttendance.map((a) => {
              const rate = hourlyRateForWorkerRole(worker.roleRate);
              const hoursWorked = a.hoursWorked ?? 0;
              return {
                workerName: a.workerName,
                period: currentPeriod,
                amount: rate > 0 && hoursWorked > 0 ? Math.round(rate * hoursWorked) : 0,
                paid: true,
                date: paycheckDate,
                workerId: worker.workerId?.trim() || '',
                receiptNumber: slipRef,
                hourlyRate: rate,
                hoursWorked,
                daysWorked: 0,
                dailyRate: 0,
                linkedAttendanceId: a.attendanceId || '',
                paymentMethod: method,
              };
            });

            nextPayroll = [...nextPayroll, ...newPayrollLines];

            const unlinkedAttendanceIds = new Set(
              unlinkedAttendance.map((a) => a.attendanceId?.trim()).filter(Boolean)
            );
            nextAttendance = nextAttendance.map((a) => {
              if (a.attendanceId && unlinkedAttendanceIds.has(a.attendanceId.trim())) {
                return { ...a, awaitingPayrollLine: false };
              }
              return a;
            });
          } else {
            // 3. Fallback: single estimated record
            const fallbackRecord = payrollRecordForWorker(
              worker,
              currentPeriod,
              true,
              paycheckDate,
              slipRef,
              method
            );
            nextPayroll = [...nextPayroll, fallbackRecord];
          }
        }

        return {
          ...prev,
          payroll: nextPayroll,
          attendance: nextAttendance,
        };
      })
    );
    if (!paidOk) return null;

    const allPaid = payrollRoster.every(
      (r) => r.id === payFlowTarget.workerId || isWorkerPaidForPeriod(state.payroll, r.name, currentPeriod),
    );
    if (allPaid) {
      setExpandedPayId(`pay-${currentPeriod.replace(/\s+/g, '-')}`);
    }
    return { slipRef };
  };

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const incomeCount = transactions.filter((t) => t.type === 'income').length;

  const expenseBreakdown = useMemo(
    () => buildExpensePieSlices(transactions, PIE_COLORS),
    [transactions],
  );
  const buyerSalesData = useMemo(() => buildBuyerSalesDataFromBuyers(buyers), [buyers]);

  const addExpense = async () => {
    const amount = Math.max(0, Math.round(Number.parseFloat(expenseForm.amount.replace(/,/g, '')) || 0));
    if (!expenseForm.description.trim() || amount <= 0) {
      showSaveError('Enter a description and amount greater than zero.');
      return;
    }
    const ok = await runSave('Expense', () =>
      updateState((prev) => ({
        ...prev,
        expenses: [
          ...prev.expenses,
          {
            category: expenseForm.category,
            description: expenseForm.description.trim(),
            amount,
            date: expenseForm.date.trim() || new Date().toLocaleDateString(),
            expenseId: crypto.randomUUID(),
          },
        ],
      })),
    );
    if (!ok) return;
    setExpenseForm((f) => ({
      ...f,
      description: '',
      amount: '',
    }));
    setAddExpenseOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Profit Management</h1>
        <p className="text-muted-foreground">Loading from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1>Profit Management</h1>
          <p className="text-muted-foreground">
            Typical coffee farm cash flow—parchment, green, and cherry sales vs payroll (monthly, paid every 1st) and other costs (~25–30% net margin in good months).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            onClick={() => setAddExpenseOpen(true)}
            className="bg-[#2d5016] hover:bg-[#234010] text-white shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add expense
          </Button>
        </div>
      </div>

      <PayrollPayFlowDialog
        target={payFlowTarget}
        open={payFlowOpen}
        onOpenChange={setPayFlowOpen}
        saving={saving}
        onComplete={completePayWithMethod}
      />

      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent className="max-w-lg border-[#4a2c2a]/20 bg-[#fefdfb]">
          <DialogHeader>
            <DialogTitle>Record expense</DialogTitle>
            <DialogDescription>Choose category (transport, marketing, warehousing, regulatory, …), describe the cost, enter amount.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="expense-category">Expense category</Label>
              <select
                id="expense-category"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[#4a2c2a]/25 bg-white px-3 py-2 text-sm text-[#3e2723] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {EXPENSE_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-desc">Description</Label>
              <Input
                id="expense-desc"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g., Truck freight to Dumaguete"
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-amt">Amount (₱)</Label>
              <Input
                id="expense-amt"
                type="text"
                inputMode="decimal"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-date">Date (label)</Label>
              <Input
                id="expense-date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                placeholder={dateLabel()}
                className="bg-white border-[#4a2c2a]/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddExpenseOpen(false)} className="border-[#4a2c2a]/30">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void addExpense()}
              disabled={
                saving ||
                !expenseForm.description.trim() ||
                Math.round(Number.parseFloat(expenseForm.amount.replace(/,/g, '')) || 0) <= 0
              }
              className="bg-[#2d5016] hover:bg-[#234010] text-white"
            >
              Save expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#2d5016]/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#2d5016]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl">₱{totalIncome.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#d4a574]/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-[#d4a574]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl">₱{totalExpenses.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#4a2c2a]/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#4a2c2a]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className="text-2xl text-[#2d5016]">₱{netProfit.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-[#4a2c2a]/15 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-[#4a2c2a]" />
                </div>
                <h3>Worker payroll</h3>
              </div>
              {currentDue ? (
                <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-950 border border-amber-200/90">
                  Due · {currentDue.coverPeriodLabel} → paycheck {currentDue.paycheckDateLabel}
                  {paidThisRunCount > 0 ? (
                    <span className="font-medium"> · {paidThisRunCount}/{payrollRoster.length} paid</span>
                  ) : null}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#2d5016]/12 text-[#1b3310] border border-[#2d5016]/25 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Paid — scheduled runs completed
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-3xl">{PAYROLL_PAYDAY_NOTE}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0 items-stretch sm:items-start">
            <div className="rounded-xl border border-[#2d5016]/25 bg-[#2d5016]/8 px-4 py-3 text-sm min-w-[210px]">
              <p className="font-medium text-[#3e2723] mb-2">Schedule</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-start gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#2d5016] shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium text-[#5d4037]">Next due: </span>
                    {currentDue ? `${currentDue.paycheckDateLabel} (${currentDue.coverPeriodLabel})` : '—'}
                  </span>
                </p>
                <p className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2d5016] shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium text-[#5d4037]">Last paid: </span>
                    {payrollHistory[0]
                      ? `${payrollHistory[0].paycheckDateLabel} · ${payrollHistory[0].coverPeriodLabel}`
                      : '—'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-[#5d4037] mb-3">Pay roster</p>
          <div className="max-h-[380px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#4a2c2a]/25">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {payrollRoster.map((row) => {
                const slip = slipForWorker(row.name);
                const paid = !!slip;
                return (
                  <div
                    key={row.id}
                    className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
                      paid ? 'border-[#2d5016]/45 bg-[#2d5016]/10' : 'border-[#4a2c2a]/12 bg-[#fefdfb]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-[#3e2723]">{row.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-snug">{row.role}</p>
                        {row.calculationType === 'attendance' ? (
                          <p className="text-xs text-[#2d5016] font-medium mt-1">
                            Based on attendance: {row.actualHours?.toFixed(1)} hours worked
                          </p>
                        ) : row.calculationType === 'paid_payroll' ? (
                          <p className="text-xs text-[#2d5016] font-medium mt-1">
                            Based on paid logs: {row.actualHours?.toFixed(1)} hours worked
                          </p>
                        ) : row.status !== 'inactive' ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Estimated (no attendance logged)
                          </p>
                        ) : null}
                      </div>
                      {row.status === 'inactive' ? (
                        <span className="inline-flex items-center text-xs font-semibold text-[#8b6f47] bg-[#8b6f47]/15 px-2 py-0.5 rounded-full shrink-0">
                          Inactive
                        </span>
                      ) : paid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1b4332] shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-[#2d5016]" />
                          Paid
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-2 pt-2 border-t border-[#4a2c2a]/10 mt-auto">
                      <p className="text-lg tabular-nums font-semibold text-[#4a2c2a]">₱{row.monthlyGross.toLocaleString()}</p>
                      {currentDue && !paid && row.status !== 'inactive' ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openPayFlow(row.id)}
                          className="bg-[#2d5016] hover:bg-[#234010] text-white shrink-0"
                        >
                          Pay now
                        </Button>
                      ) : null}
                    </div>
                    {paid ? (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>
                          Receipt <span className="font-mono font-medium text-[#5d4037]">{slip.slipRef}</span>
                        </p>
                        {slip.paymentMethod ? (
                          <p>
                            Paid via{' '}
                            <span className="font-medium text-[#3e2723]">
                              {payrollPaymentMethodLabel(slip.paymentMethod)}
                            </span>
                          </p>
                        ) : null}
                        <p>Recorded {slip.recordedAtLabel}</p>
                      </div>
                    ) : row.status === 'inactive' ? (
                      <p className="text-xs text-muted-foreground">Inactive employee — no current payment required.</p>
                    ) : currentDue ? (
                      <p className="text-xs text-muted-foreground">Awaiting payment for {currentDue.coverPeriodLabel}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No open paycheck run — next cycle picks up automatically.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-[#4a2c2a]/15 bg-[#f5f1ed]/90 px-4 py-3 text-sm font-medium mb-6">
          <span className="text-[#5d4037]">Typical roster total (this period)</span>
          <span className="tabular-nums text-[#2d5016] text-lg">₱{monthlyPayrollTotal.toLocaleString()}</span>
        </div>

        <div className="border-t border-[#4a2c2a]/10 pt-6">
          <h4 className="text-base font-medium mb-1">Pay history & payment transcripts</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Each worker pays out separately (<span className="font-medium text-[#5d4037]">Pay now</span>
            ); their card shows <span className="font-medium text-[#5d4037]">Paid</span> with a wage receipt code. After the{' '}
            <span className="font-medium text-[#5d4037]">last</span> worker on the roster is Paid, this run archives below and
            all wage rows are already listed in Transaction history as individual Payroll &amp; wages lines plus one combined
            transcript per period.
          </p>
          <div className="space-y-3">
            {payrollHistory.map((pay) => {
              const open = expandedPayId === pay.id;
              return (
                <div
                  key={pay.id}
                  className={`rounded-xl border transition-colors ${
                    open ? 'border-[#2d5016]/40 bg-[#2d5016]/6' : 'border-[#4a2c2a]/12 bg-[#fefdfb]'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d5016]/15 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-[#2d5016]" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold uppercase tracking-wide text-[#2d5016]">Paid</span>
                          <span className="text-sm font-medium text-[#3e2723]">{pay.coverPeriodLabel} wages</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Paycheck <span className="font-medium text-[#5d4037]">{pay.paycheckDateLabel}</span> · Recorded{' '}
                          <span className="font-medium text-[#5d4037]">{pay.recordedAtLabel}</span> · Ref{' '}
                          <span className="font-mono text-[#5d4037]">{pay.referenceNumber}</span>
                        </p>
                        <p className="text-sm font-medium text-[#4a2c2a] mt-2 tabular-nums">₱{pay.total.toLocaleString()} total net to roster</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#4a2c2a]/25 shrink-0 self-start sm:self-center"
                      onClick={() => setExpandedPayId((id) => (id === pay.id ? null : pay.id))}
                    >
                      {open ? 'Hide transcript' : 'View transcript'}
                    </Button>
                  </div>
                  {open ? (
                    <div className="px-4 pb-4 pt-0 space-y-3">
                      <div className="rounded-lg border border-[#4a2c2a]/12 overflow-hidden bg-white/90">
                        <table className="w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-[#f5f1ed] text-left border-b border-[#4a2c2a]/10">
                              <th className="py-2 px-3 font-medium">Worker</th>
                              <th className="py-2 px-3 font-medium hidden sm:table-cell">Role</th>
                              <th className="py-2 px-3 font-medium text-right">Gross (₱)</th>
                              <th className="py-2 px-3 font-medium hidden md:table-cell">Paid</th>
                              <th className="py-2 px-3 font-medium hidden lg:table-cell">Receipt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pay.transcriptLines.map((line) => (
                              <tr key={line.workerId} className="border-b border-[#4a2c2a]/8 last:border-0">
                                <td className="py-2 px-3 font-medium">{line.name}</td>
                                <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{line.role}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{line.amount.toLocaleString()}</td>
                                <td className="py-2 px-3 text-muted-foreground hidden md:table-cell text-xs">
                                  {line.paidAtLabel ?? '—'}
                                </td>
                                <td className="py-2 px-3 font-mono text-xs text-[#5d4037] hidden lg:table-cell">
                                  {line.slipRef ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-[#f5f1ed] font-medium border-t border-[#4a2c2a]/10">
                              <td className="py-2 px-3" colSpan={2}>
                                Period total (all workers)
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums text-[#2d5016]">
                                ₱{pay.total.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 hidden md:table-cell text-xs text-muted-foreground" colSpan={2}>
                                Completed pay run transcript
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Proof of payment: reference <span className="font-mono font-medium">{pay.referenceNumber}</span> archived with this pay run.
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel
          title="Revenue analytics"
          subtitle="Monthly revenue, expenses, and net profit"
          empty={chartSeriesEmpty(revenueData)}
        >
          <LineChart data={revenueData} margin={farmChartBottomMargin}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...farmMonthXAxisProps} />
            <YAxis tick={farmAxisTick} tickFormatter={compactAxisFormatter} width={52} axisLine={false} tickLine={false} />
            <Tooltip {...farmTooltipProps} formatter={pesoTooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="revenue" stroke={CHART_LINE_SERIES.revenue} strokeWidth={CHART_LINE_WIDTH} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_LINE_SERIES.revenue }} activeDot={{ r: 6, strokeWidth: 0 }} name="Revenue" />
            <Line type="monotone" dataKey="expenses" stroke={CHART_LINE_SERIES.expenses} strokeWidth={CHART_LINE_WIDTH} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_LINE_SERIES.expenses }} activeDot={{ r: 6, strokeWidth: 0 }} name="Expenses" />
            <Line type="monotone" dataKey="profit" stroke={CHART_LINE_SERIES.profit} strokeWidth={CHART_LINE_WIDTH} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_LINE_SERIES.profit }} activeDot={{ r: 6, strokeWidth: 0 }} name="Net profit" />
          </LineChart>
        </ChartPanel>

        <ChartPanel
          title="Expense breakdown"
          subtitle="Share of costs by category"
          empty={expenseBreakdown.length === 0}
          emptyMessage="No expense rows yet. Use Add expense to record costs."
          legend={
            <ChartLegendList
              items={expenseBreakdown.map((item) => ({
                name: item.name,
                value: pesoFormatter(item.value),
                color: item.color,
              }))}
            />
          }
        >
          <ColoredDonutChart data={expenseBreakdown} outerRadius={100} innerRadius={48} />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex h-[560px] flex-col bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
            <h3 className="mb-4">Transaction History</h3>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-[#f5f1ed] rounded-xl p-4 border border-[#4a2c2a]/10 hover:border-[#4a2c2a]/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          transaction.type === 'income' ? 'bg-[#2d5016]/20' : 'bg-[#d4a574]/20'
                        }`}
                      >
                        {transaction.type === 'income' ? (
                          <TrendingUp className="w-5 h-5 text-[#2d5016]" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-[#d4a574]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="mb-1">{transaction.description}</h4>
                        <p className="text-xs text-muted-foreground mb-1">
                          {transaction.category}
                          {transaction.buyer && ` • ${transaction.buyer}`}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{transaction.date}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xl font-medium ${
                          transaction.type === 'income' ? 'text-[#2d5016]' : 'text-[#d4a574]'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}₱{transaction.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ChartPanel
            title="Sales by buyer"
            subtitle="Top buyers by total purchase volume"
            empty={chartSeriesEmpty(buyerSalesData)}
            emptyMessage="No buyer sales recorded yet."
          >
            <BarChart data={buyerSalesData} margin={farmChartBottomMargin}>
              <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis {...categoryXAxisProps('name')} />
              <YAxis tick={farmAxisTick} tickFormatter={compactAxisFormatter} width={52} axisLine={false} tickLine={false} />
              <Tooltip {...farmTooltipProps} formatter={pesoTooltipFormatter} />
              <Bar dataKey="sales" fill={CHART_LINE_SERIES.sales} name="Sales" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ChartPanel>
        </div>

        <div className="space-y-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
            <h3 className="mb-4">Financial Summary</h3>
            <div className="space-y-3">
              <div className="bg-[#f5f1ed] rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Monthly payroll (roster)</p>
                <p className="text-2xl text-[#4a2c2a]">₱{monthlyPayrollTotal.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Payday every <span className="font-medium text-[#5d4037]">1st</span>; next paycheck{' '}
                  <span className="font-medium text-[#5d4037]">
                    {currentDue ? currentDue.paycheckDateLabel : '—'}
                  </span>
                  {currentDue ? ` (${currentDue.coverPeriodLabel})` : ''}
                </p>
              </div>
              <div className="bg-[#f5f1ed] rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Profit Margin</p>
                <p className="text-2xl text-[#2d5016]">
                  {totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0}
                  {'%'}
                </p>
              </div>
              <div className="bg-[#f5f1ed] rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Avg Transaction</p>
                <p className="text-2xl">₱{Math.round(totalIncome / (incomeCount || 1)).toLocaleString()}</p>
              </div>
              <div className="bg-[#f5f1ed] rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Buyers</p>
                <p className="text-2xl">{buyers.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
