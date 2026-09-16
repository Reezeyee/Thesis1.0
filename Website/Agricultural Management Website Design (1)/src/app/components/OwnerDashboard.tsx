import { useMemo } from 'react';
import { DollarSign, TrendingDown, TrendingUp, LogOut } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFarmData } from '../store/FarmDataProvider';
import { totalIncome, totalExpenses } from '../lib/farmFinance';
import { netProfitAccrualAware, revenueChartFromState } from '../lib/profitUi';
import { formatCurrency } from '../lib/currencyFormat';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { OwnerAdminMessaging } from './OwnerAdminMessaging';
import type { AuthSession } from '../auth/AuthProvider';

/**
 * Read-only Owner view: profit/revenue summary only, no operational controls.
 * Per the revised role design, the Owner account sees the numbers but cannot edit
 * sales, expenses, payroll, inventory, or any other farm data — that stays with Admin.
 */
export function OwnerDashboard({
  session,
  onSignOut,
}: {
  session: AuthSession;
  onSignOut: () => void;
}) {
  const { state, loading } = useFarmData();

  const revenue = useMemo(() => totalIncome(state.sales), [state.sales]);
  const expenses = useMemo(() => totalExpenses(state), [state]);
  const netProfit = useMemo(() => netProfitAccrualAware(state), [state]);
  const chartData = useMemo(() => revenueChartFromState(state), [state]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground font-medium">Loading farm profit summary…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 sm:px-8 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acojido Farm</p>
          <h1 className="text-lg font-bold font-heading">Owner Summary</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {session.displayName || session.email}
          </span>
          <Button
            onClick={onSignOut}
            variant="outline"
            className="h-9 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
        <p className="text-xs text-muted-foreground max-w-xl">
          This view shows profit and revenue only. Day-to-day farm operations, worker accounts, and
          inventory are managed by the Admin account.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" /> Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-heading">{formatCurrency(revenue)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" /> Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-heading">{formatCurrency(expenses)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" /> Net Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-heading">{formatCurrency(netProfit)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Revenue vs. Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ownerRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4a2c2a" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4a2c2a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#4a2c2a" fill="url(#ownerRevenueFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" stroke="#e11d48" fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <OwnerAdminMessaging session={session} />
      </main>
    </div>
  );
}
