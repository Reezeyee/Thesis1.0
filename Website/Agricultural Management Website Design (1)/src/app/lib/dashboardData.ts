import type { AppState } from '../types/appState';
import {
  cherryBucketColor,
  cherryBucketLabel,
  cherryGradeBucket,
  type CherryGradeBucket,
  monthLabelFromDate,
  monthLabelFromSortKey,
  monthSortKeyFromDate,
} from './chartTheme';
import {
  netProfit,
  parseHarvestKg,
  saleLineTotal,
  totalExpenses,
  totalIncome,
} from './farmFinance';
import { accumulateMonthChartRows, padMonthChartRows } from './monthChartBuckets';

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

function formatActivityDate(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '—';
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return trimmed;
}

export function buildDashboardStats(state: AppState) {
  const income = totalIncome(state.sales);
  const expenses = totalExpenses(state);
  const profit = netProfit(state);
  const harvestKg = state.cherryHarvests.reduce((s, h) => s + parseHarvestKg(h), 0);
  const activeEquipment = state.equipment.filter((e) => e.status.toLowerCase() === 'active').length;

  return [
    { label: 'Total Sales', value: peso(income), change: `${state.sales.length} records`, trend: 'up' as const, icon: 'DollarSign', color: '#2d5016' },
    { label: 'Net Profit', value: peso(profit), change: profit >= 0 ? 'positive' : 'negative', trend: profit >= 0 ? ('up' as const) : ('down' as const), icon: 'TrendingUp', color: profit >= 0 ? '#2d5016' : '#d4183d' },
    { label: 'Total Expenses', value: peso(expenses), change: `${state.expenses.length + state.payroll.length} lines`, trend: 'down' as const, icon: 'TrendingDown', color: '#d4183d' },
    { label: 'Harvested Coffee', value: `${Math.round(harvestKg)} kg`, change: `${state.cherryHarvests.length} entries`, trend: 'up' as const, icon: 'Coffee', color: '#4a2c2a' },
    { label: 'Active Workers', value: String(state.workers.length), change: 'synced', trend: 'up' as const, icon: 'Users', color: '#8b6f47' },
    { label: 'Equipment Status', value: `${activeEquipment}/${state.equipment.length}`, change: 'live', trend: 'up' as const, icon: 'Wrench', color: '#d4a574' },
    { label: 'Coffee Fields', value: String(state.coffeeFields.length), change: 'fields', trend: 'up' as const, icon: 'Package', color: '#2d5016' },
    { label: 'AI Cherry Grades', value: String(state.cherryGrades.length), change: 'scans', trend: 'up' as const, icon: 'Coffee', color: '#8b6f47' },
  ];
}

export function buildTopBuyers(state: AppState) {
  const map = new Map<string, { total: number; orders: number }>();
  for (const s of state.sales) {
    const cur = map.get(s.buyer) ?? { total: 0, orders: 0 };
    cur.total += saleLineTotal(s);
    cur.orders += 1;
    map.set(s.buyer, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 4)
    .map(([name, v]) => ({
      name,
      amount: peso(v.total),
      orders: v.orders,
      location: 'Bataan',
    }));
}

const CHERRY_BUCKET_ORDER: CherryGradeBucket[] = ['ripe', 'nearRipe', 'unripe', 'overripe', 'unknown'];

/** Grade text for dashboard classification — CNN rows first, else tree ripeness scans. */
function classificationGradeInputs(state: AppState): string[] {
  if (state.cherryGrades.length > 0) {
    return state.cherryGrades.map((g) => (g.grade ?? '').trim() || 'unknown');
  }
  return state.treeRipenessScans.map(
    (s) => (s.sourceGrade ?? s.ripenessLabel ?? '').trim() || 'unknown',
  );
}

export function buildCherryClassData(state: AppState) {
  const counts = new Map<CherryGradeBucket, number>();
  for (const grade of classificationGradeInputs(state)) {
    const bucket = cherryGradeBucket(grade);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return CHERRY_BUCKET_ORDER.filter((bucket) => (counts.get(bucket) ?? 0) > 0).map((bucket) => ({
    name: cherryBucketLabel(bucket),
    value: counts.get(bucket) ?? 0,
    color: cherryBucketColor(bucket),
  }));
}

export function hasClassificationScans(state: AppState): boolean {
  return state.cherryGrades.length > 0 || state.treeRipenessScans.length > 0;
}

export function buildRecentActivity(state: AppState) {
  const items: { action: string; details: string; time: string; type: string }[] = [];
  state.sales.slice(-3).forEach((s) => {
    items.push({
      action: 'Sale recorded',
      details: `${s.buyer} — ${peso(saleLineTotal(s))}`,
      time: formatActivityDate(s.date),
      type: 'success',
    });
  });
  state.expenses.slice(-2).forEach((e) => {
    items.push({
      action: 'Expense',
      details: `${e.category}: ${peso(e.amount)}`,
      time: formatActivityDate(e.date ?? ''),
      type: 'warning',
    });
  });
  state.tasks.slice(-2).forEach((t) => {
    items.push({ action: t.title, details: t.details, time: t.status, type: 'info' });
  });
  return items.slice(0, 6);
}

/** Sales and net profit by month from Firebase records. */
export function buildSalesByMonth(state: AppState) {
  const rows = accumulateMonthChartRows(state);
  const dated = rows.filter((r) => r.sortKey !== '0000-00');
  if (dated.length === 0) {
    const income = totalIncome(state.sales);
    const expenses = totalExpenses(state);
    if (income <= 0 && expenses <= 0) return [];
    return [{ month: 'All time', sales: income, profit: income - expenses }];
  }
  return dated.map(({ month, sales, profit }) => ({ month, sales, profit }));
}

/** Profit vs expenses bars by month. */
export function buildMonthlyProfitExpenses(state: AppState) {
  const rows = accumulateMonthChartRows(state);
  const dated = rows.filter((r) => r.sortKey !== '0000-00');
  if (dated.length === 0) {
    const expenses = totalExpenses(state);
    const profit = netProfit(state);
    if (profit === 0 && expenses === 0) return [];
    return [{ month: 'All time', profit, expenses }];
  }
  return dated.map(({ month, profit, expenses }) => ({ month, profit, expenses }));
}

/** Harvest kg grouped by month label. */
export function buildHarvestByMonth(state: AppState) {
  const kgBySortKey = new Map<string, number>();
  for (const h of state.cherryHarvests) {
    const sortKey = monthSortKeyFromDate(h.date);
    if (!sortKey) continue;
    kgBySortKey.set(sortKey, (kgBySortKey.get(sortKey) ?? 0) + parseHarvestKg(h));
  }
  if (kgBySortKey.size === 0) return [];

  const monthRows = [...kgBySortKey.entries()]
    .map(([sortKey, kg]) => ({
      sortKey,
      month: monthLabelFromSortKey(sortKey),
      sales: 0,
      expenses: 0,
      profit: 0,
      kg: Math.round(kg),
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return padMonthChartRows(monthRows).map((r) => ({
    month: r.month,
    kg: kgBySortKey.get(r.sortKey) ?? 0,
  }));
}
