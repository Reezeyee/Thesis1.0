import { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Wrench, ShoppingCart, Coffee } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useFarmData } from '../store/FarmDataProvider';
import {
  buildCherryClassData,
  buildDashboardStats,
  hasClassificationScans,
  buildHarvestByMonth,
  buildMonthlyProfitExpenses,
  buildRecentActivity,
  buildSalesByMonth,
  buildTopBuyers,
} from '../lib/dashboardData';
import {
  CHART_COLORS,
  CHART_LINE_SERIES,
  chartMonetarySeriesHasData,
} from '../lib/chartTheme';
import {
  ChartLegendList,
  ChartPanel,
  countTooltipFormatter,
  FarmBarChart,
  FarmHarvestBarChart,
  FarmLineChart,
  farmTooltipProps,
} from './charts/FarmCharts';

const iconMap = {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Coffee,
  Users,
  Wrench,
};

export function Dashboard() {
  const { state, loading, lastUpdatedAt } = useFarmData();

  const statsData = useMemo(() => buildDashboardStats(state), [state]);
  const salesData = useMemo(() => buildSalesByMonth(state), [state]);
  const profitExpenseData = useMemo(() => buildMonthlyProfitExpenses(state), [state]);
  const cherryClassData = useMemo(() => buildCherryClassData(state), [state]);
  const productionData = useMemo(() => buildHarvestByMonth(state), [state]);
  const recentActivity = useMemo(() => buildRecentActivity(state), [state]);
  const topBuyers = useMemo(() => buildTopBuyers(state), [state]);

  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString()
    : '—';

  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Farm Dashboard</h1>
        <p className="text-muted-foreground">Loading from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Farm Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to Acojido Farm Management</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Last updated</p>
          <p>{lastUpdatedLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, index) => {
          const Icon = iconMap[stat.icon as keyof typeof iconMap] ?? Package;
          return (
          <div
            key={index}
            className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl mb-2 font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <div className="flex items-center gap-1">
                  {stat.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  )}
                  <span className={`text-sm font-semibold ${stat.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}20` }}>
                <Icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel
          title="Sales analytics"
          subtitle="Monthly sales and net profit from Firebase records"
          empty={!chartMonetarySeriesHasData(salesData, ['sales', 'profit'])}
          emptyMessage="No sales recorded yet. Add sales under Profit & finance."
        >
          <FarmLineChart
            data={salesData}
            series={[
              { dataKey: 'sales', stroke: CHART_LINE_SERIES.sales, name: 'Sales' },
              { dataKey: 'profit', stroke: CHART_LINE_SERIES.profit, name: 'Net profit' },
            ]}
          />
        </ChartPanel>

        <ChartPanel
          title="Profit vs expenses"
          subtitle="Monthly totals including payroll"
          empty={!chartMonetarySeriesHasData(profitExpenseData, ['profit', 'expenses'])}
          emptyMessage="No profit or expense data for this period yet."
        >
          <FarmBarChart
            data={profitExpenseData}
            series={[
              { dataKey: 'profit', fill: CHART_LINE_SERIES.profit, name: 'Net profit' },
              { dataKey: 'expenses', fill: CHART_COLORS.accent, name: 'Expenses' },
            ]}
          />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartPanel
          title="Cherry classification"
          subtitle="Ripe / unripe / overripe scan counts"
          height={260}
          empty={!hasClassificationScans(state) || !cherryClassData.length}
          emptyMessage="No cherry grade scans yet."
          legend={
            cherryClassData.length > 0 ? (
              <ChartLegendList
                items={cherryClassData.map((item) => ({
                  name: item.name,
                  value: `${item.value} scans`,
                  color: item.color,
                }))}
              />
            ) : null
          }
        >
          <PieChart>
            <Pie
              data={cherryClassData.map((d) => ({
                name: d.name,
                value: d.value,
                fill: d.color,
              }))}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="48%"
              outerRadius="72%"
              paddingAngle={cherryClassData.length > 1 ? 3 : 0}
              labelLine={false}
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {cherryClassData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={entry.color} stroke={entry.color} />
              ))}
            </Pie>
            <Tooltip {...farmTooltipProps} formatter={countTooltipFormatter} />
          </PieChart>
        </ChartPanel>

        <ChartPanel
          title="Coffee harvest"
          subtitle="Harvest weight by month (kg)"
          height={280}
          empty={!chartMonetarySeriesHasData(productionData, ['kg'])}
          emptyMessage="No harvest weight logged yet."
        >
          <FarmHarvestBarChart data={productionData} />
        </ChartPanel>

        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <h3 className="mb-4">Recent Activity</h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {recentActivity.map((activity, idx) => (
              <div key={idx} className="flex gap-3 pb-3 border-b border-border/60 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.type === 'success' ? 'bg-emerald-500' :
                  activity.type === 'warning' ? 'bg-amber-500' : 'bg-muted-foreground'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.details}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
        <h3 className="mb-4 text-foreground font-bold">Top Buyers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topBuyers.map((buyer, idx) => (
            <div key={idx} className="bg-muted/40 rounded-xl p-4 border border-border/60">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold rounded-full border border-emerald-500/25">{buyer.orders} orders</span>
              </div>
              <h4 className="mb-1 text-foreground font-semibold">{buyer.name}</h4>
              <p className="text-2xl text-emerald-600 dark:text-emerald-400 font-bold mb-2">{buyer.amount}</p>
              <p className="text-sm text-muted-foreground">{buyer.location}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
