import { useMemo } from 'react';
import { Coffee, CheckCircle, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useFarmData } from '../store/FarmDataProvider';
import { parseHarvestKg } from '../lib/farmFinance';
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
  ChartLegendList,
  ChartPanel,
  ColoredDonutChart,
  countTooltipFormatter,
  farmAxisTick,
  farmChartBottomMargin,
  farmMonthXAxisProps,
  farmTooltipProps,
  kgTooltipFormatter,
} from './charts/FarmCharts';

interface CherryRecord {
  id: number;
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
        const isInactive = worker ? JSON.parse(worker.details || '{}').status === 'inactive' : false;
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

        return {
          id,
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
          quality: conf >= 90 ? 'excellent' : conf >= 75 ? 'good' : 'fair',
          confidence: Math.round(conf <= 1 ? conf * 100 : conf),
          source: isInactive ? `${sourceName} (inactive)` : sourceName,
          location: locationName,
        };
      }),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Coffee Classification Module</h1>
          <p className="text-muted-foreground">Offline convolutional neural network species and ripeness analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#2d5016]/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[#2d5016]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ripe Cherries</p>
              <p className="text-2xl">{totalRipe}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#d4a574]/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#d4a574]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unripe Cherries</p>
              <p className="text-2xl">{totalUnripe}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#8b6f47]/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-[#8b6f47]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overripe Cherries</p>
              <p className="text-2xl">{totalOverripe}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#4a2c2a]/20 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-[#4a2c2a]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Processed</p>
              <p className="text-2xl">{totalKg} kg</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex h-[560px] flex-col bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
          <h3 className="mb-4">Classification Records</h3>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-scroll pr-2 scrollbar-thin scrollbar-thumb-[#8b6f47]/35 scrollbar-track-transparent">
            {cherryRecords.length > 0 ? (
              cherryRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-[#f5f1ed] rounded-xl p-4 border border-[#4a2c2a]/10 hover:border-[#4a2c2a]/30 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white text-[#2d5016]">
                      <Coffee className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="mb-1">{record.batchNumber}</h4>
                        <p className="text-xs text-muted-foreground">{record.date}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Tree: {record.treeId}</p>
                        {record.location && record.location !== '—' && (
                          <p className="mt-1 text-xs text-muted-foreground">Location: {record.location}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-xs px-3 py-1 rounded-full ${
                            record.quality === 'excellent'
                              ? 'bg-[#2d5016] text-white'
                              : record.quality === 'good'
                              ? 'bg-[#8b6f47] text-white'
                              : 'bg-[#d4a574] text-white'
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
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-muted-foreground mb-1">Grade</p>
                        <p className="text-sm font-medium text-[#2d5016]">{record.grade}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-muted-foreground mb-1">Species</p>
                        <p className="text-sm font-medium text-[#5d4037]">{record.species}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                        <p className="text-sm font-medium">{record.confidence}%</p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-muted-foreground mb-1">Location</p>
                        <p className="text-sm font-medium truncate" title={record.location}>{record.location}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <p className="text-xs text-muted-foreground mb-1">Source</p>
                        <p className="text-sm font-medium break-all">{record.source}</p>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[#4a2c2a]/20 bg-[#f5f1ed] p-6 text-center">
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
            <ColoredDonutChart data={qualityDistribution} />
          </ChartPanel>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
            <h3 className="mb-4">Production Summary</h3>
            <div className="space-y-3">
              <div className="bg-[#f5f1ed] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Batches</span>
                  <span className="text-xl font-medium">{cherryRecords.length}</span>
                </div>
              </div>
              <div className="bg-[#f5f1ed] rounded-lg p-3">
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
              <div className="bg-[#f5f1ed] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Ripe Rate</span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-[#2d5016]" />
                    <span className="text-xl font-medium text-[#2d5016]">
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
          <LineChart data={classificationTrend} margin={farmChartBottomMargin}>
            <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis {...categoryXAxisProps('date')} />
            <YAxis tick={farmAxisTick} allowDecimals={false} width={40} axisLine={false} tickLine={false} />
            <Tooltip {...farmTooltipProps} formatter={countTooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="ripe" stroke={CHART_CHERRY.ripe} strokeWidth={CHART_LINE_WIDTH} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_CHERRY.ripe }} activeDot={{ r: 6, strokeWidth: 0 }} name="Ripe" />
            <Line type="monotone" dataKey="unripe" stroke={CHART_CHERRY.unripe} strokeWidth={CHART_LINE_WIDTH} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_CHERRY.unripe }} activeDot={{ r: 6, strokeWidth: 0 }} name="Unripe" />
            <Line type="monotone" dataKey="overripe" stroke={CHART_CHERRY.overripe} strokeWidth={CHART_LINE_WIDTH} dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: CHART_CHERRY.overripe }} activeDot={{ r: 6, strokeWidth: 0 }} name="Overripe" />
          </LineChart>
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
            <Tooltip {...farmTooltipProps} formatter={kgTooltipFormatter} />
            <Bar dataKey="kg" fill={CHART_COLORS.harvest} name="Harvest" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ChartPanel>
      </div>
    </div>
  );
}
