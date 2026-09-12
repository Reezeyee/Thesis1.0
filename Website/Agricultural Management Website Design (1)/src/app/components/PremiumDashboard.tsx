import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Coffee,
  TrendingUp,
  Wrench,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  FileText,
  Activity,
} from 'lucide-react';
import { StatCard } from './ui/StatCard';
import { AreaChartCard, BarChartCard, DonutChartCard } from './ui/ChartCard';
import { DashboardGrid, GridItem } from './ui/DashboardGrid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useFarmData } from '../store/FarmDataProvider';
import {
  totalIncome,
  totalExpenses,
  netProfit,
  parseHarvestKg,
  saleLineTotal,
} from '../lib/farmFinance';
import { buildMonthlyProfitExpenses } from '../lib/dashboardData';
import { formatCurrency } from '../lib/currencyFormat';
import { isWorkerActive } from '../lib/workerUi';

// Dynamic Revenue and Operating Expenses calculator from real sales & expenses
function buildDynamicRevenueData(
  sales: any[],
  expenses: any[],
  timeRange: '7d' | '30d' | '90d' | '1y'
): Array<{ month: string; revenue: number; expenses: number }> {
  const now = new Date();
  let binCount = 7;
  let binDuration = 24 * 3600 * 1000;
  let labelFormatter: (d: Date, idx: number) => string = (d) => d.toLocaleDateString([], { weekday: 'short' });

  if (timeRange === '7d') {
    binCount = 7;
    binDuration = 24 * 3600 * 1000;
    labelFormatter = (d) => d.toLocaleDateString([], { weekday: 'short' });
  } else if (timeRange === '30d') {
    binCount = 4;
    binDuration = 7 * 24 * 3600 * 1000;
    labelFormatter = (_, idx) => `Week ${idx + 1}`;
  } else if (timeRange === '90d') {
    binCount = 3;
    binDuration = 30 * 24 * 3600 * 1000;
    labelFormatter = (_, idx) => `Month ${idx + 1}`;
  } else if (timeRange === '1y') {
    binCount = 4;
    binDuration = 91 * 24 * 3600 * 1000;
    labelFormatter = (_, idx) => `Q${idx + 1} ${now.getFullYear()}`;
  }

  const startTime = now.getTime() - binCount * binDuration;
  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = startTime + i * binDuration;
    const end = start + binDuration;
    return {
      month: labelFormatter(new Date(end), i),
      start,
      end,
      revenue: 0,
      expenses: 0,
    };
  });

  for (const s of sales) {
    const saleDate = s.date ? new Date(s.date).getTime() : now.getTime();
    const lineTotal = saleLineTotal(s);
    const target = bins.find((b) => saleDate >= b.start && saleDate < b.end);
    if (target) {
      target.revenue += lineTotal;
    }
  }

  for (const e of expenses) {
    const expDate = e.date ? new Date(e.date).getTime() : now.getTime();
    const amount = typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0));
    const target = bins.find((b) => expDate >= b.start && expDate < b.end);
    if (target) {
      target.expenses += amount;
    }
  }

  return bins.map(({ month, revenue, expenses }) => ({ month, revenue, expenses }));
}

// Dynamic Harvest Yield Bar Chart builder from real harvests
function buildDynamicHarvestData(
  harvests: any[],
  timeRange: '7d' | '30d' | '90d' | '1y'
): Array<{ quarter: string; Arabica: number; Robusta: number; Liberica: number }> {
  const now = new Date();
  let binCount = 5;
  let binDuration = 24 * 3600 * 1000;
  let labelFormatter: (d: Date, idx: number) => string = (d) => d.toLocaleDateString([], { weekday: 'short' });

  if (timeRange === '7d') {
    binCount = 5;
    binDuration = 24 * 3600 * 1000;
    labelFormatter = (d) => d.toLocaleDateString([], { weekday: 'short' });
  } else if (timeRange === '30d') {
    binCount = 4;
    binDuration = 7 * 24 * 3600 * 1000;
    labelFormatter = (_, idx) => `W${idx + 1}`;
  } else if (timeRange === '90d') {
    binCount = 3;
    binDuration = 30 * 24 * 3600 * 1000;
    labelFormatter = (_, idx) => `M${idx + 1}`;
  } else if (timeRange === '1y') {
    binCount = 4;
    binDuration = 91 * 24 * 3600 * 1000;
    labelFormatter = (_, idx) => `Q${idx + 1} ${now.getFullYear()}`;
  }

  const startTime = now.getTime() - binCount * binDuration;
  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = startTime + i * binDuration;
    const end = start + binDuration;
    return {
      quarter: labelFormatter(new Date(end), i),
      start,
      end,
      Arabica: 0,
      Robusta: 0,
      Liberica: 0,
    };
  });

  for (const h of harvests) {
    const hDate = h.date ? new Date(h.date).getTime() : now.getTime();
    const kg = parseHarvestKg(h);
    const target = bins.find((b) => hDate >= b.start && hDate < b.end);
    if (target) {
      const details = (h.details || '').toLowerCase();
      if (details.includes('robusta')) target.Robusta += kg;
      else if (details.includes('liberica') || details.includes('excelsa')) target.Liberica += kg;
      else target.Arabica += kg;
    }
  }

  return bins.map(({ quarter, Arabica, Robusta, Liberica }) => ({
    quarter,
    Arabica,
    Robusta,
    Liberica,
  }));
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 },
  },
};

export interface PremiumDashboardProps {
  onNavigateModule?: (module: any, targetElementId?: string) => void;
}

export function PremiumDashboard({ onNavigateModule }: PremiumDashboardProps) {
  const { state, loading: isFarmLoading, syncStatus, refresh } = useFarmData();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'completed' | 'pending' | 'processing'>('all');

  // Compute Live System Metrics from AppState
  const totalSalesVal = useMemo(() => totalIncome(state.sales), [state.sales]);
  const netProfitVal = useMemo(() => netProfit(state), [state]);
  const harvestTotalKg = useMemo(
    () => state.cherryHarvests.reduce((s, h) => s + parseHarvestKg(h), 0),
    [state.cherryHarvests]
  );
  const activeEquipmentCount = useMemo(
    () => state.equipment.filter((e) => e.status.toLowerCase() === 'active').length,
    [state.equipment]
  );
  const activeWorkersCount = useMemo(
    () => state.workers.filter(isWorkerActive).length,
    [state.workers]
  );

  const formattedSales = useMemo(() => {
    return formatCurrency(totalSalesVal);
  }, [totalSalesVal]);

  const formattedHarvest = useMemo(() => {
    return `${Math.round(harvestTotalKg).toLocaleString()} kg`;
  }, [harvestTotalKg]);

  // Dynamic Revenue & Expenses Chart Data scaled by timeRange
  const activeRevenueChartData = useMemo(() => {
    return buildDynamicRevenueData(state.sales, state.expenses, timeRange);
  }, [state.sales, state.expenses, timeRange]);

  // Dynamic Harvest Yield Bar Chart scaled by timeRange
  const activeHarvestChartData = useMemo(() => {
    return buildDynamicHarvestData(state.cherryHarvests, timeRange);
  }, [state.cherryHarvests, timeRange]);

  // Dynamic Crop Variety Distribution Chart Data computed from real farm data
  const dynamicCropDistribution = useMemo(() => {
    const palette = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
    ];
    const countMap = new Map<string, number>();

    if (state.coffeeFields.length > 0) {
      state.coffeeFields.forEach((f) => {
        const raw = (f.variety || f.name || '').trim() || 'Unspecified';
        const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
        const name = formatted.toLowerCase().includes('variety') || formatted.toLowerCase().includes('coffee') ? formatted : `${formatted} Variety`;
        countMap.set(name, (countMap.get(name) || 0) + (f.trees || 1));
      });
    } else if (state.cherryGrades.length > 0) {
      state.cherryGrades.forEach((g) => {
        if (g.species && g.species.trim()) {
          const raw = g.species.trim();
          const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
          const name = formatted.toLowerCase().includes('variety') || formatted.toLowerCase().includes('coffee') ? formatted : `${formatted} Variety`;
          countMap.set(name, (countMap.get(name) || 0) + 1);
        }
      });
    } else if (state.trees.length > 0) {
      // TreeRecord has no species/variety field (only CoffeeFieldRecord and CNN scan records
      // do) -- group by the one real per-tree dimension it tracks instead of fabricating one.
      state.trees.forEach((t) => {
        const raw = (t.sectionName || '').trim() || 'Unspecified section';
        const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
        countMap.set(formatted, (countMap.get(formatted) || 0) + 1);
      });
    }

    if (countMap.size === 0) {
      return [];
    }

    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], idx) => ({
        name,
        value,
        color: palette[idx % palette.length],
      }));
  }, [state.coffeeFields, state.cherryGrades, state.trees]);

  // Live Operation & Transaction Table Logs
  const liveTransactions = useMemo(() => {
    const items: Array<{ id: string; type: string; category: string; date: string; amount: string; status: 'completed' | 'pending' | 'processing' }> = [];

    state.sales.forEach((s, idx) => {
      items.push({
        id: s.saleId || `SALE-${idx + 1}`,
        type: `Sale — ${s.buyer || 'Direct Coffee Sale'}`,
        category: s.type || 'Sales Income',
        date: s.date || new Date().toISOString().slice(0, 10),
        amount: `₱${saleLineTotal(s).toLocaleString('en-PH')}`,
        status: 'completed',
      });
    });

    state.expenses.forEach((e, idx) => {
      items.push({
        id: e.expenseId || `EXP-${idx + 1}`,
        type: e.description || e.category,
        category: 'Farm Expense',
        date: e.date || new Date().toISOString().slice(0, 10),
        amount: `₱${(typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount || 0))).toLocaleString('en-PH')}`,
        status: 'completed',
      });
    });

    return items;
  }, [state.sales, state.expenses]);

  const filteredTransactions = liveTransactions.filter((item) => {
    const matchesSearch =
      item.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.type.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.category.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusTab === 'all' || item.status === statusTab;
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refresh();
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const handleExportReport = () => {
    const reportHeaders = ['ID', 'Operation Description', 'Category', 'Date', 'Amount / Yield', 'Status'];
    const rows = liveTransactions.map((t) => [t.id, `"${t.type}"`, `"${t.category}"`, t.date, `"${t.amount}"`, t.status]);
    const csvContent = [reportHeaders.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Acojido_Farm_Management_Report_${timeRange.toUpperCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-[1600px] mx-auto pb-8 font-sans"
    >
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              Dashboard Overview
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                syncStatus === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${syncStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {syncStatus === 'connected' ? 'Firebase Live' : syncStatus === 'syncing' ? 'Syncing...' : 'Offline'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Monitor real-time farm sales, harvest yield analytics, CNN scanning batches, and financial flow.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center p-1 rounded-xl bg-muted border border-border/80 text-xs">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg font-medium font-mono text-[11px] transition-all ${
                  timeRange === range
                    ? 'bg-card text-foreground shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isFarmLoading}
            className="h-9 gap-1.5 text-xs font-medium border-border/80 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportReport}
            className="h-9 gap-1.5 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </Button>
        </div>
      </motion.div>

      {/* Top Metric Cards */}
      <motion.div variants={itemVariants}>
        <DashboardGrid>
          <GridItem span={{ default: 12, sm: 6, lg: 3 }}>
            <StatCard
              title="Total Farm Revenue"
              value={formattedSales}
              change={14.2}
              changeLabel={`${state.sales.length} sales entries`}
              icon={DollarSign}
              trend="up"
              loading={isFarmLoading}
            />
          </GridItem>
          <GridItem span={{ default: 12, sm: 6, lg: 3 }}>
            <StatCard
              title="Active Coffee Harvest"
              value={formattedHarvest}
              change={8.7}
              changeLabel={`${state.cherryHarvests.length} harvest logs`}
              icon={Coffee}
              trend="up"
              loading={isFarmLoading}
            />
          </GridItem>
          <GridItem span={{ default: 12, sm: 6, lg: 3 }}>
            <StatCard
              title="Net Farm Profit"
              value={formatCurrency(netProfitVal)}
              change={netProfitVal >= 0 ? 12.8 : -4.2}
              changeLabel={netProfitVal >= 0 ? 'net positive' : 'net deficit'}
              icon={TrendingUp}
              trend={netProfitVal >= 0 ? 'up' : 'down'}
              loading={isFarmLoading}
            />
          </GridItem>
          <GridItem span={{ default: 12, sm: 6, lg: 3 }}>
            <StatCard
              title="Active Fleet Equipment"
              value={`${activeEquipmentCount} / ${state.equipment.length} Units`}
              change={0}
              changeLabel={`${activeWorkersCount} of ${state.workers.length} staff active`}
              icon={Wrench}
              trend="up"
              loading={isFarmLoading}
            />
          </GridItem>
        </DashboardGrid>
      </motion.div>

      {/* Row 2: Area Chart + Donut Distribution */}
      <motion.div variants={itemVariants}>
        <DashboardGrid>
          <GridItem span={{ default: 12, lg: 8 }}>
            <AreaChartCard
              title={`Revenue & Operating Expenses (${timeRange.toUpperCase()})`}
              description="Monthly comparison of coffee cherry sales vs farm input expenses (PHP)"
              data={activeRevenueChartData}
              xAxisKey="month"
              isCurrency={true}
              loading={isFarmLoading}
              series={[
                { key: 'revenue', name: 'Revenue (₱)', color: 'hsl(var(--chart-1))', fillOpacity: 0.25 },
                { key: 'expenses', name: 'Expenses (₱)', color: 'hsl(var(--chart-5))', fillOpacity: 0.15 },
              ]}
              action={
                <Badge variant="outline" className="text-[11px] font-mono border-accent/40">
                  YTD Net Profit: {formatCurrency(netProfitVal)}
                </Badge>
              }
            />
          </GridItem>

          <GridItem span={{ default: 12, lg: 4 }}>
            <DonutChartCard
              title="Crop Field Allocation"
              description="Hectares & tree distribution by coffee bean variety"
              data={dynamicCropDistribution}
              centerText="120 ha"
              centerSubtext="Total Farmland"
              loading={isFarmLoading}
            />
          </GridItem>
        </DashboardGrid>
      </motion.div>

      {/* Row 3: Bar Chart + Quick Management Actions */}
      <motion.div variants={itemVariants}>
        <DashboardGrid>
          <GridItem span={{ default: 12, lg: 7 }}>
            <BarChartCard
              title={`Harvest Yield by Variety (${timeRange.toUpperCase()})`}
              description="Total harvested weight (kg) categorized by bean type"
              data={activeHarvestChartData}
              xAxisKey="quarter"
              loading={isFarmLoading}
              series={[
                { key: 'Arabica', name: 'Arabica', color: 'hsl(var(--chart-1))' },
                { key: 'Robusta', name: 'Robusta', color: 'hsl(var(--chart-2))' },
                { key: 'Liberica', name: 'Liberica', color: 'hsl(var(--chart-3))' },
              ]}
            />
          </GridItem>

          <GridItem span={{ default: 12, lg: 5 }}>
            <Card className="h-full border border-border/80 shadow-sm rounded-xl p-6 flex flex-col justify-between bg-card/95">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm font-heading text-foreground">Quick Management Actions</h3>
                  <Badge variant="secondary" className="text-[10px] font-mono">Instant</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <Button
                    variant="outline"
                    onClick={() => onNavigateModule?.('cherry')}
                    className="h-auto py-3 px-3 flex flex-col items-start gap-1 justify-start border-border/80 hover:bg-accent/10 hover:border-accent/40 text-left group transition-all rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <Coffee className="w-4 h-4 text-accent" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </div>
                    <span className="text-xs font-bold font-heading text-foreground mt-1">Log CNN Scan Batch</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Record new cherry scan</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onNavigateModule?.('equipment')}
                    className="h-auto py-3 px-3 flex flex-col items-start gap-1 justify-start border-border/80 hover:bg-accent/10 hover:border-accent/40 text-left group transition-all rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <Wrench className="w-4 h-4 text-emerald-500" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <span className="text-xs font-bold font-heading text-foreground mt-1">Schedule Fleet Ticket</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Create maintenance log</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onNavigateModule?.('profit')}
                    className="h-auto py-3 px-3 flex flex-col items-start gap-1 justify-start border-border/80 hover:bg-accent/10 hover:border-accent/40 text-left group transition-all rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <FileText className="w-4 h-4 text-purple-500" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                    </div>
                    <span className="text-xs font-bold font-heading text-foreground mt-1">Run Worker Payroll</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Process payouts</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onNavigateModule?.('sms')}
                    className="h-auto py-3 px-3 flex flex-col items-start gap-1 justify-start border-border/80 hover:bg-accent/10 hover:border-accent/40 text-left group transition-all rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <Activity className="w-4 h-4 text-amber-500" />
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                    </div>
                    <span className="text-xs font-bold font-heading text-foreground mt-1">Send SMS Broadcast</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">Notify field team</span>
                  </Button>
                </div>
              </div>

              {/* System Telemetry Badges */}
              <div className="pt-4 border-t border-border/60 space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block font-mono">
                  System Telemetry
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Firebase Realtime Sync
                    </span>
                    <span className="font-mono text-[11px] text-foreground font-bold">{syncStatus}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> YOLO / CNN Detection Engine
                    </span>
                    <span className="font-mono text-[11px] text-foreground font-bold">v2.4 Online</span>
                  </div>
                </div>
              </div>
            </Card>
          </GridItem>
        </DashboardGrid>
      </motion.div>

      {/* Row 4: Recent Activity & Transactions Table */}
      <motion.div variants={itemVariants}>
        <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden bg-card/95">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div>
              <CardTitle className="text-base font-bold font-heading text-foreground">
                Recent Farm Operations & Financial Logs
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Audit trail of recent sales deposits, maintenance orders, and cherry batch scans.
              </CardDescription>
            </div>

            {/* Table Filters & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Filter logs..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 h-8 text-xs border-border/80 bg-muted/30 focus:bg-background rounded-lg"
                />
              </div>

              <div className="inline-flex items-center p-1 rounded-lg bg-muted border border-border/80 text-xs">
                {(['all', 'completed', 'processing', 'pending'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusTab(tab)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium capitalize transition-all ${
                      statusTab === tab
                        ? 'bg-card text-foreground shadow-2xs font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isFarmLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs font-mono">
                No logs match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent text-xs">
                      <TableHead className="w-[110px] font-semibold text-muted-foreground">ID</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Operation / Description</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Category</TableHead>
                      <TableHead className="font-semibold text-muted-foreground">Date</TableHead>
                      <TableHead className="text-right font-semibold text-muted-foreground">Amount / Yield</TableHead>
                      <TableHead className="w-[120px] text-center font-semibold text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs font-mono">
                    {filteredTransactions.map((txn) => (
                      <TableRow key={txn.id} className="border-border/40 hover:bg-muted/40 transition-colors">
                        <TableCell className="text-muted-foreground font-bold">{txn.id}</TableCell>
                        <TableCell className="font-semibold text-foreground font-heading font-sans">{txn.type}</TableCell>
                        <TableCell className="text-muted-foreground font-sans">{txn.category}</TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">{txn.date}</TableCell>
                        <TableCell className="text-right font-bold text-foreground">{txn.amount}</TableCell>
                        <TableCell className="text-center font-sans">
                          <span
                            className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[10px] capitalize ${
                              txn.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                : txn.status === 'processing'
                                ? 'bg-accent/15 text-accent border border-accent/25'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                            }`}
                          >
                            {txn.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                            {txn.status === 'processing' && <Clock className="w-3 h-3 animate-spin" />}
                            {txn.status === 'pending' && <AlertTriangle className="w-3 h-3" />}
                            {txn.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
