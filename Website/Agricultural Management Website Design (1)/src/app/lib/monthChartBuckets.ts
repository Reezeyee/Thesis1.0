import type { AppState } from '../types/appState';
import { monthLabelFromSortKey, monthSortKeyFromDate } from './chartTheme';
import { payrollLineAmount, saleLineTotal } from './farmFinance';

type MonthBucket = { sales: number; expenses: number };

export type MonthChartRow = {
  sortKey: string;
  month: string;
  sales: number;
  expenses: number;
  profit: number;
};

export function accumulateMonthChartRows(state: AppState): MonthChartRow[] {
  const map = new Map<string, MonthBucket>();
  let undatedSales = 0;
  let undatedExpenses = 0;

  const add = (sortKey: string, sales = 0, expenses = 0) => {
    const cur = map.get(sortKey) ?? { sales: 0, expenses: 0 };
    cur.sales += sales;
    cur.expenses += expenses;
    map.set(sortKey, cur);
  };

  for (const s of state.sales) {
    const key = monthSortKeyFromDate(s.date);
    if (key) add(key, saleLineTotal(s), 0);
    else undatedSales += saleLineTotal(s);
  }
  for (const e of state.expenses) {
    const key = monthSortKeyFromDate(e.date);
    if (key) add(key, 0, e.amount);
    else undatedExpenses += e.amount;
  }
  for (const p of state.payroll.filter((x) => x.paid)) {
    const key = monthSortKeyFromDate(p.date);
    const amount = payrollLineAmount(p);
    if (key) add(key, 0, amount);
    else undatedExpenses += amount;
  }

  if (undatedSales > 0 || undatedExpenses > 0) {
    if (map.size === 0) {
      add('0000-00', undatedSales, undatedExpenses);
    } else {
      const latest = [...map.keys()].sort().at(-1)!;
      add(latest, undatedSales, undatedExpenses);
    }
  }

  return padMonthChartRows(
    [...map.entries()]
      .map(([sortKey, v]) => ({
        sortKey,
        month: sortKey === '0000-00' ? 'Undated' : monthLabelFromSortKey(sortKey),
        sales: v.sales,
        expenses: v.expenses,
        profit: v.sales - v.expenses,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
  );
}

/** Fill trailing months with zeros so line charts draw segments (not lone dots). */
export function padMonthChartRows(rows: MonthChartRow[], slotCount = 6): MonthChartRow[] {
  const dated = rows.filter((r) => r.sortKey !== '0000-00');
  if (dated.length === 0) return rows;

  const latestKey = dated.map((r) => r.sortKey).sort().at(-1)!;
  const [y, m] = latestKey.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return dated;

  const end = new Date(y, m - 1, 1);
  const start = new Date(end);
  start.setMonth(start.getMonth() - (slotCount - 1));

  const byKey = new Map(dated.map((r) => [r.sortKey, r]));
  const out: MonthChartRow[] = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    const sortKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const existing = byKey.get(sortKey);
    out.push(
      existing ?? {
        sortKey,
        month: monthLabelFromSortKey(sortKey),
        sales: 0,
        expenses: 0,
        profit: 0,
      },
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return out;
}
