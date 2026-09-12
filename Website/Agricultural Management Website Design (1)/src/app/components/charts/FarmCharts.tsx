import type { CSSProperties, ReactElement, ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_COLORS,
  CHART_GRADIENT_BOTTOM_OPACITY,
  CHART_GRADIENT_TOP_OPACITY,
  CHART_LINE_SERIES,
  CHART_LINE_WIDTH,
  compactAxisFormatter,
} from '../../lib/chartTheme';
import {
  CHART_AXIS_TICK,
  CHART_MARGIN_WITH_BOTTOM_LABELS,
  kgFormatter,
  pesoFormatter,
  piePercentLabel,
} from '../../lib/chartTheme';
import { cn } from '../ui/utils';

/** Deterministic gradient id for a series color, so two charts on the same page never collide. */
export function chartGradientId(dataKey: string): string {
  return `farmGradient-${dataKey.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Soft top-to-transparent fill defs for area charts. Render once per chart, before the series. */
export function ChartGradientDefs({ series }: { series: { dataKey: string; color: string }[] }) {
  return (
    <defs>
      {series.map((s) => (
        <linearGradient key={s.dataKey} id={chartGradientId(s.dataKey)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.color} stopOpacity={CHART_GRADIENT_TOP_OPACITY} />
          <stop offset="100%" stopColor={s.color} stopOpacity={CHART_GRADIENT_BOTTOM_OPACITY} />
        </linearGradient>
      ))}
    </defs>
  );
}

/** Shared hover-highlight for bar/area tooltips -- a faint tint instead of Recharts' default gray box. */
export const farmTooltipCursorFill = { fill: 'rgba(45, 80, 22, 0.05)' };
export const farmTooltipCursorLine = { stroke: CHART_COLORS.grid, strokeWidth: 1 };

/** Custom pie label — avoid `style` on `<Pie>` (can blank the chart in Recharts). */
export function renderPieLabel(props: { name?: string; percent?: number; x?: number; y?: number }) {
  const { name = '', percent, x = 0, y = 0 } = props;
  const text = piePercentLabel(String(name), percent);
  if (!text) return null;
  return (
    <text
      x={x}
      y={y}
      fill="#1c1917"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {text}
    </text>
  );
}

/** Full month labels — Recharts default ticks clip to "Apr 2…" without this. */
export function FarmMonthTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const label = String(payload?.value ?? '');
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="middle"
        fill="#292524"
        fontSize={12}
        fontWeight={500}
      >
        {label}
      </text>
    </g>
  );
}

/** Shared X-axis props for month/category charts. */
const categoryXAxisBase = {
  type: 'category' as const,
  tick: FarmMonthTick,
  height: 40,
  interval: 0 as const,
  tickMargin: 12,
  axisLine: false,
  tickLine: false,
  minTickGap: 0,
  padding: { left: 16, right: 16 } as const,
};

export const farmMonthXAxisProps = {
  ...categoryXAxisBase,
  dataKey: 'month',
};

/** Same readable ticks for `name`, `date`, etc. */
export function categoryXAxisProps(dataKey: string) {
  return { ...categoryXAxisBase, dataKey };
}

export const farmChartBottomMargin = CHART_MARGIN_WITH_BOTTOM_LABELS;

export type ColoredSlice = { name: string; value: number; color: string };

/** Donut/pie with explicit per-slice fill. PieChart must receive non-zero width/height from ResponsiveContainer. */
export function ColoredDonutChart({
  data,
  width = 0,
  height = 0,
  outerRadius = 88,
  innerRadius = 40,
  showLabels = true,
  centerValue,
  centerSubLabel,
}: {
  data: ColoredSlice[];
  /** Injected by ResponsiveContainer */
  width?: number;
  height?: number;
  outerRadius?: number;
  innerRadius?: number;
  showLabels?: boolean;
  /** Big number shown in the donut hole, e.g. a formatted total. Only rendered when there's a hole (innerRadius > 0). */
  centerValue?: string;
  /** Small caption under the center value, e.g. "Total spend". */
  centerSubLabel?: string;
}) {
  const chartData = data.map((row) => ({
    name: row.name,
    value: row.value,
    fill: row.color,
  }));

  if (chartData.length === 0) return null;

  const chartWidth = width > 0 ? width : 280;
  const chartHeight = height > 0 ? height : 240;
  const cx = chartWidth / 2;
  const cy = chartHeight / 2;
  const maxR = Math.min(chartWidth, chartHeight) / 2 - 12;
  const outer = Math.min(outerRadius, maxR);
  const inner = Math.min(innerRadius, Math.max(outer - 10, 0));

  return (
    <PieChart width={chartWidth} height={chartHeight}>
      <Pie
        data={chartData}
        dataKey="value"
        nameKey="name"
        cx={cx}
        cy={cy}
        outerRadius={outer}
        innerRadius={inner}
        paddingAngle={chartData.length > 1 ? 2 : 0}
        labelLine={false}
        label={showLabels ? renderPieLabel : false}
        stroke="#ffffff"
        strokeWidth={2}
        isAnimationActive={false}
      >
        {chartData.map((row, index) => (
          <Cell key={`${row.name}-${index}`} fill={row.fill} stroke={row.fill} />
        ))}
      </Pie>
      {centerValue && inner > 0 ? (
        <>
          <text
            x={cx}
            y={cy - (centerSubLabel ? 8 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={centerSubLabel ? 20 : 22}
            fontWeight={700}
            fill="#292524"
          >
            {centerValue}
          </text>
          {centerSubLabel ? (
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={500}
              fill={CHART_COLORS.axis}
            >
              {centerSubLabel}
            </text>
          ) : null}
        </>
      ) : null}
      <Tooltip {...farmTooltipProps} formatter={countTooltipFormatter} />
    </PieChart>
  );
}

type TooltipItem = {
  color?: string;
  payload?: {
    fill?: string;
  };
  value?: number | string;
  name?: string;
};

export function pesoTooltipFormatter(value: number | string, _name?: string, _item?: TooltipItem) {
  const n = typeof value === 'number' ? value : Number(value);
  return [pesoFormatter(Number.isFinite(n) ? n : 0), 'Amount'] as [ReactNode, string];
}

export function kgTooltipFormatter(value: number | string, _name?: string, _item?: TooltipItem) {
  const n = typeof value === 'number' ? value : Number(value);
  return [kgFormatter(Number.isFinite(n) ? n : 0), 'Weight'] as [ReactNode, string];
}

export function countTooltipFormatter(value: number | string, name: string, _item?: TooltipItem) {
  const n = typeof value === 'number' ? value : Number(value);
  return [Number.isFinite(n) ? n.toLocaleString('en-PH') : '0', name] as [ReactNode, string];
}

export const farmTooltipProps = {
  content: <FarmTooltipContent />,
};

function FarmTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  className,
}: React.ComponentProps<typeof Tooltip> & React.ComponentProps<'div'>) {
  if (!active || !payload?.length) return null;

  const labelNode =
    labelFormatter && label !== undefined ? (
      <div className="font-medium text-foreground">
        {labelFormatter(label, payload)}
      </div>
    ) : label ? (
      <div className="font-medium text-foreground">{String(label)}</div>
    ) : null;

  return (
    <div
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/80 bg-card/95 px-2.5 py-1.5 text-xs text-card-foreground shadow-xl backdrop-blur-sm',
        className,
      )}
    >
      {labelNode}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const n = typeof item.value === 'number' ? item.value : Number(item.value);
          const color = item.color ?? item.payload?.fill ?? CHART_COLORS.primary;
          const formatted = formatter
            ? formatter(item.value as number | string, item.name ?? '', item, index, item.payload)
            : [item.value, item.name ?? ''] as const;
          const [value, name] = Array.isArray(formatted) ? formatted : [formatted, item.name ?? ''];
          const valueNode = (
            <span className="font-mono font-medium tabular-nums" style={{ color }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          );

          return (
            <div key={`${item.dataKey ?? name ?? index}`} className="flex w-full items-center gap-2">
              <span
                className="shrink-0 rounded-[2px]"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: color,
                }}
              />
              <span className="flex-1 text-muted-foreground">{name}</span>
              {valueNode}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const farmAxisTick = CHART_AXIS_TICK;

export type FarmLineSeries = {
  dataKey: string;
  stroke: string;
  name: string;
};

/** Line chart with explicit size — avoids blank charts inside ResponsiveContainer. */
export function FarmLineChart({
  data,
  series,
  width = 0,
  height = 0,
}: {
  data: Record<string, string | number>[];
  series: FarmLineSeries[];
  width?: number;
  height?: number;
}) {
  const chartWidth = width > 0 ? width : 320;
  const chartHeight = height > 0 ? height : 280;

  return (
    <AreaChart width={chartWidth} height={chartHeight} data={data} margin={farmChartBottomMargin}>
      <ChartGradientDefs series={series.map((s) => ({ dataKey: s.dataKey, color: s.stroke }))} />
      <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
      <XAxis {...farmMonthXAxisProps} />
      <YAxis
        tick={farmAxisTick}
        tickFormatter={compactAxisFormatter}
        width={56}
        tickCount={5}
        domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.08), 1)]}
        allowDecimals={false}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip {...farmTooltipProps} formatter={pesoTooltipFormatter} cursor={farmTooltipCursorLine} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {series.map((s) => (
        <Area
          key={s.dataKey}
          type="monotone"
          dataKey={s.dataKey}
          stroke={s.stroke}
          strokeWidth={CHART_LINE_WIDTH}
          fill={`url(#${chartGradientId(s.dataKey)})`}
          fillOpacity={1}
          dot={{ r: 4, strokeWidth: 2, fill: '#ffffff', stroke: s.stroke }}
          activeDot={{ r: 6, strokeWidth: 0 }}
          name={s.name}
          connectNulls
          isAnimationActive={false}
        />
      ))}
    </AreaChart>
  );
}

export type FarmBarSeries = {
  dataKey: string;
  fill: string;
  name: string;
};

/** Bar chart with explicit size. */
export function FarmBarChart({
  data,
  series,
  width = 0,
  height = 0,
  maxBarSize = 48,
}: {
  data: Record<string, string | number>[];
  series: FarmBarSeries[];
  width?: number;
  height?: number;
  maxBarSize?: number;
}) {
  const chartWidth = width > 0 ? width : 320;
  const chartHeight = height > 0 ? height : 280;

  return (
    <BarChart width={chartWidth} height={chartHeight} data={data} margin={farmChartBottomMargin}>
      <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
      <XAxis {...farmMonthXAxisProps} />
      <YAxis
        tick={farmAxisTick}
        tickFormatter={compactAxisFormatter}
        width={56}
        tickCount={5}
        domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.08), 1)]}
        allowDecimals={false}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip {...farmTooltipProps} formatter={pesoTooltipFormatter} cursor={farmTooltipCursorFill} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {series.map((s) => (
        <Bar
          key={s.dataKey}
          dataKey={s.dataKey}
          fill={s.fill}
          name={s.name}
          radius={[6, 6, 0, 0]}
          maxBarSize={maxBarSize}
          isAnimationActive={false}
        />
      ))}
    </BarChart>
  );
}

/** Single-series harvest bar chart (kg axis). */
export function FarmHarvestBarChart({
  data,
  width = 0,
  height = 0,
}: {
  data: Record<string, string | number>[];
  width?: number;
  height?: number;
}) {
  const chartWidth = width > 0 ? width : 320;
  const chartHeight = height > 0 ? height : 280;

  return (
    <BarChart width={chartWidth} height={chartHeight} data={data} margin={farmChartBottomMargin}>
      <CartesianGrid strokeDasharray="4 4" stroke={CHART_COLORS.grid} vertical={false} />
      <XAxis {...farmMonthXAxisProps} />
      <YAxis tick={farmAxisTick} width={48} domain={[0, 'auto']} axisLine={false} tickLine={false} />
      <Tooltip {...farmTooltipProps} formatter={kgTooltipFormatter} cursor={farmTooltipCursorFill} />
      <Bar
        dataKey="kg"
        fill={CHART_COLORS.harvest}
        name="Harvest"
        radius={[6, 6, 0, 0]}
        maxBarSize={48}
        isAnimationActive={false}
      />
    </BarChart>
  );
}

export function ChartLegendList({
  items,
}: {
  items: { name: string; value: string | number; color: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/80 shadow-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate">{item.name}</span>
          </div>
          <span className="font-medium tabular-nums shrink-0 ml-2" style={{ color: item.color }}>
            {item.value}
          </span>
        </div>
        ))}
    </div>
  );
}

type ChartPanelProps = {
  title: string;
  subtitle?: string;
  height?: number;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactElement;
  legend?: ReactNode;
};

export function ChartPanel({
  title,
  subtitle,
  height = 320,
  empty,
  emptyMessage = 'No data to display yet.',
  children,
  legend,
}: ChartPanelProps) {
  return (
    <div className="farm-chart-panel bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <h3 className="mb-1 text-foreground font-semibold">{title}</h3>
      {subtitle ? <p className="text-xs text-muted-foreground mb-4">{subtitle}</p> : <div className="mb-4" />}
      <div className="w-full" style={{ height, minHeight: height }}>
        {empty ? (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 text-center text-sm text-muted-foreground"
            style={{ height }}
          >
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={height}
            debounce={50}
            initialDimension={{ width: 320, height }}
          >
            {children}
          </ResponsiveContainer>
        )}
      </div>
      {legend}
    </div>
  );
}
