import React from 'react';
import { Activity, Cpu, Radio, Server, Zap, ShieldCheck } from 'lucide-react';
import { Card } from './card';

export interface GaugeMetric {
  id: string;
  name: string;
  value: number; // 0 - 100
  unit?: string;
  status: 'healthy' | 'warning' | 'alert';
  subtitle?: string;
  icon?: React.ElementType;
}

export interface SystemHealthGaugeProps {
  score?: number; // 0 - 100
  title?: string;
  subtitle?: string;
  metrics?: GaugeMetric[];
  className?: string;
}

export const SystemHealthGauge: React.FC<SystemHealthGaugeProps> = ({
  score = 99.4,
  title = 'System & Edge Infrastructure Health',
  subtitle = '24/24 Edge & Telemetry Sensor Nodes Active',
  metrics = [
    { id: 'cnn', name: 'YOLO / CNN Inference Engine', value: 98, status: 'healthy', subtitle: 'Model v2.4 • 14ms latency', icon: Cpu },
    { id: 'soil', name: 'Soil Telemetry Mesh', value: 100, status: 'healthy', subtitle: '18 Field Probes online', icon: Radio },
    { id: 'silo', name: 'Cherries Silo Storage Capacity', value: 68, status: 'healthy', subtitle: '14,200 / 20,000 kg', icon: Server },
    { id: 'power', name: 'Solar Grid & Battery Micro-Grid', value: 91, status: 'healthy', subtitle: '48.2 kWh (91% capacity)', icon: Zap },
  ],
  className = '',
}) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className={`border border-border/80 bg-card/95 backdrop-blur-md shadow-sm rounded-xl p-6 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shadow-2xs">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-bold text-sm font-heading text-foreground tracking-tight">{title}</h3>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
          <ShieldCheck className="w-3 h-3" /> Operational
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center flex-1">
        {/* Radial Main Score Meter */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-muted/40 border border-border/60 relative">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Outer Track */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-muted/60"
                strokeWidth="10"
                fill="transparent"
              />
              {/* Animated Progress Arc */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-accent transition-all duration-700 ease-out"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold font-heading text-foreground font-mono">
                {score}%
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">
                Node Health
              </span>
            </div>
          </div>

          <div className="mt-3 text-center">
            <span className="text-[11px] font-mono text-muted-foreground">
              Latency: <strong className="text-foreground font-bold">14ms</strong> • Loss: <strong className="text-emerald-500 font-bold">0.00%</strong>
            </span>
          </div>
        </div>

        {/* Node Telemetry Progress Bars */}
        <div className="md:col-span-7 space-y-3.5">
          {metrics.map((m) => {
            const Icon = m.icon || Activity;
            return (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground font-heading">{m.name}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground text-xs">
                    {m.value}%
                  </span>
                </div>

                <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      m.status === 'healthy'
                        ? 'bg-emerald-500 shadow-emerald-500/50'
                        : m.status === 'warning'
                        ? 'bg-amber-500 shadow-amber-500/50'
                        : 'bg-rose-500 shadow-rose-500/50'
                    }`}
                    style={{ width: `${m.value}%` }}
                  />
                </div>

                {m.subtitle && (
                  <p className="text-[10px] text-muted-foreground font-mono">{m.subtitle}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
