import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  TooltipProps,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './card';
import { Skeleton } from './skeleton';

// Compact Currency / Number Formatter for Y-Axis
const formatYAxisTick = (value: any): string => {
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (num === 0) return '0';
  if (num >= 1000000) return `₱${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `₱${(num / 1000).toFixed(0)}k`;
  return `₱${num}`;
};

// Custom sleek Tooltip component matching Linear/Vercel aesthetic
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover/95 border border-border/80 shadow-lg backdrop-blur-md rounded-lg p-3 text-xs min-w-[140px] z-50">
      {label && <p className="font-semibold text-foreground mb-1.5 pb-1 border-b border-border/40">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span>{entry.name}</span>
            </div>
            <span className="font-semibold font-mono text-foreground">
              {typeof entry.value === 'number' ? `₱${entry.value.toLocaleString('en-PH')}` : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface BaseChartProps {
  title: string;
  description?: string;
  loading?: boolean;
  action?: React.ReactNode;
  height?: number;
  className?: string;
}

export interface AreaSeries {
  key: string;
  name: string;
  color: string;
  fillOpacity?: number;
}

export interface AreaChartCardProps extends BaseChartProps {
  data: Array<Record<string, any>>;
  xAxisKey: string;
  series: AreaSeries[];
}

export const AreaChartCard: React.FC<AreaChartCardProps> = ({
  title,
  description,
  loading = false,
  action,
  height = 280,
  data,
  xAxisKey,
  series,
  className = '',
}) => {
  return (
    <Card className={`border border-border/70 shadow-sm rounded-xl overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-bold text-foreground font-heading">{title}</CardTitle>
          {description && <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-[280px] px-4">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={s.fillOpacity || 0.35} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-[11px] fill-muted-foreground font-mono"
              />
              <YAxis
                width={55}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatYAxisTick}
                className="text-[11px] fill-muted-foreground font-mono"
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#gradient-${s.key})`}
                  isAnimationActive={true}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export interface BarSeries {
  key: string;
  name: string;
  color: string;
  radius?: [number, number, number, number];
}

export interface BarChartCardProps extends BaseChartProps {
  data: Array<Record<string, any>>;
  xAxisKey: string;
  series: BarSeries[];
}

export const BarChartCard: React.FC<BarChartCardProps> = ({
  title,
  description,
  loading = false,
  action,
  height = 280,
  data,
  xAxisKey,
  series,
  className = '',
}) => {
  return (
    <Card className={`border border-border/70 shadow-sm rounded-xl overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-bold text-foreground font-heading">{title}</CardTitle>
          {description && <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className="px-2 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-[280px] px-4">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-[11px] fill-muted-foreground font-mono"
              />
              <YAxis
                width={50}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => typeof v === 'number' && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                className="text-[11px] fill-muted-foreground font-mono"
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.name}
                  fill={s.color}
                  radius={s.radius || [4, 4, 0, 0]}
                  isAnimationActive={true}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export interface DonutDataItem {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartCardProps extends BaseChartProps {
  data: DonutDataItem[];
  centerText?: string;
  centerSubtext?: string;
}

export const DonutChartCard: React.FC<DonutChartCardProps> = ({
  title,
  description,
  loading = false,
  action,
  height = 220,
  data,
  centerText,
  centerSubtext,
  className = '',
}) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  // Filter out tiny zero or near-zero items for a clean legend
  const visibleData = data.filter((item) => item.value > 0);

  return (
    <Card className={`border border-border/70 shadow-sm rounded-xl overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-bold text-foreground font-heading">{title}</CardTitle>
          {description && <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>}
        </div>
        {action && <div>{action}</div>}
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-[220px]">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {/* Pie SVG Container with defined dimensions to prevent clipping */}
            <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Pie
                    data={visibleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive={true}
                  >
                    {visibleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {(centerText || total > 0) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                  <span className="text-lg font-extrabold font-heading text-foreground font-mono leading-none">
                    {centerText || total.toLocaleString()}
                  </span>
                  {centerSubtext && (
                    <span className="text-[10px] text-muted-foreground font-medium mt-1 leading-none">{centerSubtext}</span>
                  )}
                </div>
              )}
            </div>

            {/* Custom Sleek Legend (Capped to main items) */}
            <div className="w-full sm:w-52 space-y-2.5 pr-2 max-h-56 overflow-y-auto">
              {visibleData.slice(0, 5).map((item) => {
                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                return (
                  <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground font-medium truncate">{item.name}</span>
                    </div>
                    <span className="font-bold text-foreground font-mono ml-2 shrink-0">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
