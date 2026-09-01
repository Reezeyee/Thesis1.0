import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { Card } from './card';
import { Skeleton } from './skeleton';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeLabel = 'vs previous period',
  icon: Icon,
  trend,
  description,
  loading = false,
}) => {
  const computedTrend =
    trend ||
    (change !== undefined
      ? change > 0
        ? 'up'
        : change < 0
        ? 'down'
        : 'neutral'
      : 'neutral');

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.15, ease: 'easeOut' } }}
      className="h-full"
    >
      <Card className="p-5 h-full border border-border/80 bg-card/95 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-accent/40 transition-all duration-200 flex flex-col justify-between rounded-xl relative overflow-hidden group">
        {/* Subtle Ambient Hover Glow */}
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/15 transition-colors pointer-events-none" />

        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {Icon && (
            <div className="p-2.5 rounded-xl bg-secondary/80 text-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-200 shadow-2xs">
              <Icon className="w-4 h-4 stroke-[2]" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 my-2">
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        ) : (
          <div>
            <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground font-heading font-mono">
              {value}
            </div>

            <div className="flex items-center gap-2 mt-2.5 text-xs flex-wrap">
              {change !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${
                    computedTrend === 'up'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                      : computedTrend === 'down'
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {computedTrend === 'up' && <TrendingUp className="w-3 h-3 stroke-[2.5]" />}
                  {computedTrend === 'down' && <TrendingDown className="w-3 h-3 stroke-[2.5]" />}
                  {computedTrend === 'neutral' && <Minus className="w-3 h-3 stroke-[2.5]" />}
                  {change > 0 ? `+${change}%` : `${change}%`}
                </span>
              )}
              {(changeLabel || description) && (
                <span className="text-muted-foreground text-[11px] font-normal truncate">
                  {changeLabel || description}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};
