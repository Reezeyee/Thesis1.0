import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Coffee, CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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
import { useFarmData } from '../store/FarmDataProvider';
import { parseHarvestKg } from '../lib/farmFinance';
import { parseWorkerDetails } from '../lib/workerUi';
import { buildHarvestByMonth } from '../lib/dashboardData';
import {
  CHART_CHERRY,
  CHART_COLORS,
  CHART_LINE_WIDTH,
  CHART_QUALITY,
  chartPieHasData,
  chartSeriesEmpty,
  cherryGradeBucket,
  monthSortKeyFromDate,
  compactAxisFormatter,
} from '../lib/chartTheme';
import {
  categoryXAxisProps,
  ChartGradientDefs,
  chartGradientId,
  ChartLegendList,
  ChartPanel,
  ColoredDonutChart,
  countTooltipFormatter,
  farmAxisTick,
  farmChartBottomMargin,
  farmMonthXAxisProps,
  farmTooltipCursorFill,
  farmTooltipCursorLine,
  farmTooltipProps,
  kgTooltipFormatter,
} from './charts/FarmCharts';

interface CherryRecord {
  id: number;
  savedAtMillis?: number;
  batchNumber: string;
  date: string;
  grade: string;
  species: string;
  treeId: string;
  ripe: number;
  unripe: number;
  overripe: number;
  quality: 'excellent' | 'good' | 'fair';
  confidence: number;
  source: string;
  location?: string;
}


function gradeTrendKey(savedAtMillis: number | null | undefined): { label: string; sortKey: string } {
  if (savedAtMillis != null && savedAtMillis > 0) {
    const sortKey = monthSortKeyFromDate(new Date(savedAtMillis).toISOString()) ?? String(savedAtMillis);
    const label = new Date(savedAtMillis).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    return { label, sortKey };
  }
  return { label: 'Undated', sortKey: '0000-00' };
}

export function CherryManagement() {
  const { state, loading } = useFarmData();

  const cherryRecords = useMemo<CherryRecord[]>(
    () =>
      state.cherryGrades.map((g, id) => {
        const bucket = cherryGradeBucket(g.grade);
        const conf = Number.parseFloat(g.confidence ?? '0') || 0;
        const workerName = g.scannedByWorkerName?.trim();
        const workerEmail = g.scannedByEmail?.trim();
        const worker = state.workers.find(
          (w) =>
            (workerName && w.name.trim().toLowerCase() === workerName.toLowerCase()) ||
            (workerEmail && w.accountEmail?.trim().toLowerCase() === workerEmail.toLowerCase())
        );
        const isInactive = worker ? parseWorkerDetails(worker.details).status === 'inactive' : false;
        const sourceName = workerName || workerEmail || 'Mobile scan';

        const trimmedTreeId = g.treeId?.trim();
        const matchingTree = trimmedTreeId
          ? state.trees.find(
              (t) =>
                t.treeId?.trim().toLowerCase() === trimmedTreeId.toLowerCase()
            )
          : undefined;

        const locationParts: string[] = [];
        const fBlock = matchingTree?.farmBlockName?.trim();
        const sName = matchingTree?.sectionName?.trim();
        if (fBlock) {
          locationParts.push(fBlock);
        }
        if (sName && sName !== fBlock) {
          locationParts.push(sName);
        }
        const locationName = locationParts.length > 0 ? locationParts.join(' - ') : '—';
        const qualityLevel: 'excellent' | 'good' | 'fair' =
          conf >= 90 ? 'excellent' : conf >= 75 ? 'good' : 'fair';

        return {
          id,
          savedAtMillis: g.savedAtMillis ?? 0,
          batchNumber: g.batchId?.trim() || 'Unassigned batch',
          date: g.savedAtMillis
            ? new Date(g.savedAtMillis).toLocaleString()
            : '—',
          grade: g.grade?.trim() || 'Unknown',
          species: g.species?.trim() || '—',
          treeId: trimmedTreeId || '—',
          ripe: bucket === 'ripe' || bucket === 'nearRipe' ? 1 : 0,
          unripe: bucket === 'unripe' ? 1 : 0,
          overripe: bucket === 'overripe' ? 1 : 0,
          quality: qualityLevel,
          confidence: Math.round(conf <= 1 ? conf * 100 : conf),
          source: isInactive ? `${sourceName} (inactive)` : sourceName,
          location: locationName,
        };
      })
      .sort((a, b) => (b.savedAtMillis ?? 0) - (a.savedAtMillis ?? 0)),
    [state.cherryGrades, state.workers, state.trees],
  );

  const classificationTrend = useMemo(() => {
    const buckets = new Map<string, { ripe: number; unripe: number; overripe: number; sortKey: string }>();
    for (const g of state.cherryGrades) {
      const { label, sortKey } = gradeTrendKey(g.savedAtMillis);
      const bucket = cherryGradeBucket(g.grade);
      const cur = buckets.get(label) ?? { ripe: 0, unripe: 0, overripe: 0, sortKey };
      if (bucket === 'ripe' || bucket === 'nearRipe') cur.ripe += 1;
      else if (bucket === 'unripe') cur.unripe += 1;
      else if (bucket === 'overripe') cur.overripe += 1;
      buckets.set(label, cur);
    }
    return [...buckets.entries()]
      .map(([date, counts]) => ({ date, ripe: counts.ripe, unripe: counts.unripe, overripe: counts.overripe, sortKey: counts.sortKey }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-8)
      .map(({ date, ripe, unripe, overripe }) => ({ date, ripe, unripe, overripe }));
  }, [state.cherryGrades]);

  const qualityDistribution = useMemo(() => {
    const ex = cherryRecords.filter((r) => r.quality === 'excellent').length;
    const good = cherryRecords.filter((r) => r.quality === 'good').length;
    const fair = cherryRecords.filter((r) => r.quality === 'fair').length;
    return [
      { name: 'Excellent', value: ex, color: CHART_QUALITY.excellent },
      { name: 'Good', value: good, color: CHART_QUALITY.good },
      { name: 'Fair', value: fair, color: CHART_QUALITY.fair },
    ];
  }, [cherryRecords]);

  const monthlyProduction = useMemo(() => buildHarvestByMonth(state), [state]);

  const totalRipe = cherryRecords.filter((r) => r.ripe).length;
  const totalUnripe = cherryRecords.filter((r) => r.unripe).length;
  const totalOverripe = cherryRecords.filter((r) => r.overripe).length;
  const totalClassifications = cherryRecords.length;
  const totalKg = state.cherryHarvests.reduce((sum, h) => sum + parseHarvestKg(h), 0);
  const ripeRate = totalClassifications > 0 ? Math.round((totalRipe / totalClassifications) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Coffee Classification Module</h1>
        <p className="text-muted-foreground">Loading from Firebase…</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-[1600px] mx-auto pb-8 font-sans"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              CNN Coffee Cherry Classification & Vision
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Model v2.4 Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Convolutional neural network species determination, ripeness evaluation, and quality batch grading.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ripe Cherries</p>
              <p className="text-2xl font-bold font-heading text-foreground">{totalRipe}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unripe Cherries</p>
              <p className="text-2xl font-bold font-heading text-foreground">{totalUnripe}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overripe Cherries</p>
              <p className="text-2xl font-bold font-heading text-foreground">{totalOverripe}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Classifications</p>
              <p className="text-2xl font-bold font-heading text-foreground">{totalClassifications}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex h-[560px] flex-col bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
          <h3 className="mb-4">Classification Records</h3>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
            {cherryRecords.length > 0 ? (
              cherryRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-muted/40 rounded-xl p-4 border border-border/60 hover:border-border/80 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      <Coffee className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="mb-1 text-foreground font-bold">{record.location && record.location !== '—' ? record.location : 'Farm Section'}</h4>
                        <p className="text-xs text-muted-foreground">{record.date}</p>
                        {record.treeId && record.treeId !== 'branch_scan' && (
                          <p className="mt-1 text-xs text-muted-foreground">Tree: {record.treeId}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-bold border ${
                            record.quality === 'excellent'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : record.quality === 'good'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {record.quality}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Confidence: {record.confidence}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                      <div className="bg-background/90 rounded-lg p-2.5 border border-border/60">
                        <p className="text-xs text-muted-foreground mb-1 font-semibold">Grade / Ripeness</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{record.grade}</p>
                      </div>
                      <div className="bg-background/90 rounded-lg p-2.5 border border-border/60">
                        <p className="text-xs text-muted-foreground mb-1 font-semibold">Species (CNN)</p>
                        <span className="inline-flex items-center text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          {record.species}
                        </span>
                      </div>
                      <div className="bg-background/90 rounded-lg p-2.5 border border-border/60">
                        <p className="text-xs text-muted-foreground mb-1 font-semibold">Confidence</p>
                        <p className="text-sm font-bold text-foreground">{record.confidence}%</p>
                      </div>
                      <div className="bg-background/90 rounded-lg p-2.5 border border-border/60">
                        <p className="text-xs text-muted-foreground mb-1 font-semibold">Location</p>
                        <p className="text-sm font-medium text-foreground truncate" title={record.location}>{record.location}</p>
                      </div>
                      <div className="bg-background/90 rounded-lg p-2.5 border border-border/60">
                        <p className="text-xs text-muted-foreground mb-1 font-semibold">Source</p>
                        <p className="text-sm font-medium text-muted-foreground break-all">{record.source}</p>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No saved grading results yet. Save a cherry grading result in the mobile app and it will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <ChartPanel
            title="Quality distribution"
            subtitle="Scan confidence tiers"
            height={260}
            empty={!chartPieHasData(qualityDistribution)}
            legend={
              <ChartLegendList
                items={qualityDistribution.map((item) => ({
                  name: item.name,
                  value: `${item.value} scans`,
                  color: item.color,
                }))}
              />
            }
          >
            <ColoredDonutChart
              data={qualityDistribution}
              centerValue={String(qualityDistribution.reduce((sum, d) => sum + d.value, 0))}
              centerSubLabel="Total scans"
            />
          </ChartPanel>

          <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
            <h3 className="mb-4">Production Summary</h3>
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Batches</span>
                  <span className="text-xl font-medium">{cherryRecords.length}</span>
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Avg Confidence</span>
                  <span className="text-xl font-medium">
                    {cherryRecords.length > 0
                      ? Math.round(
                          cherryRecords.reduce((sum, r) => sum + r.confidence, 0) / cherryRecords.length,
                        )
                      : 0}
                    %
                  </span>
                </div>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Ripe Rate</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {ripeRate}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel
          title="Classification trends"
          subtitle="Ripe / unripe / overripe scans over time"
          empty={chartSeriesEmpty(classificationTrend)}
        >
          <AreaChart data={classificationTrend} margin={farmChartBottomMargin}>
            <ChartGradientDefs
              series={[
                { dataKey: 'ripe', color: CHART_CHERRY.ripe },
                { dataKey: 'unripe', color: CHART_CHERRY.unripe },
                { dataKey: 'overripe', color: CHART_CHERRY.overripe },
              ]}
            />
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...categoryXAxisProps('date')} />
            <YAxis tick={farmAxisTick} allowDecimals={false} width={40} axisLine={false} tickLine={false} />
            <Tooltip {...farmTooltipProps} formatter={countTooltipFormatter} cursor={farmTooltipCursorLine} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="ripe" stroke={CHART_CHERRY.ripe} strokeWidth={CHART_LINE_WIDTH} fill={`url(#${chartGradientId('ripe')})`} fillOpacity={1} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_CHERRY.ripe }} activeDot={{ r: 6, strokeWidth: 0 }} name="Ripe" />
            <Area type="monotone" dataKey="unripe" stroke={CHART_CHERRY.unripe} strokeWidth={CHART_LINE_WIDTH} fill={`url(#${chartGradientId('unripe')})`} fillOpacity={1} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_CHERRY.unripe }} activeDot={{ r: 6, strokeWidth: 0 }} name="Unripe" />
            <Area type="monotone" dataKey="overripe" stroke={CHART_CHERRY.overripe} strokeWidth={CHART_LINE_WIDTH} fill={`url(#${chartGradientId('overripe')})`} fillOpacity={1} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_CHERRY.overripe }} activeDot={{ r: 6, strokeWidth: 0 }} name="Overripe" />
          </AreaChart>
        </ChartPanel>

        <ChartPanel
          title="Monthly harvest"
          subtitle="Total cherry weight logged (kg)"
          empty={chartSeriesEmpty(monthlyProduction)}
        >
          <BarChart data={monthlyProduction} margin={farmChartBottomMargin}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...farmMonthXAxisProps} />
            <YAxis tick={farmAxisTick} tickFormatter={compactAxisFormatter} width={48} axisLine={false} tickLine={false} />
            <Tooltip {...farmTooltipProps} formatter={kgTooltipFormatter} cursor={farmTooltipCursorFill} />
            <Bar dataKey="kg" fill={CHART_COLORS.harvest} name="Harvest" radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartPanel>
      </div>
    </motion.div>
  );
}
