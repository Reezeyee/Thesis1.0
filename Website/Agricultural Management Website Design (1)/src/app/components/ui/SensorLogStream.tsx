import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Pause, Play, Trash2, Search, Filter, ShieldCheck } from 'lucide-react';
import { Card } from './card';
import { Button } from './button';

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'alert';
}

const initialLogs: LogEntry[] = [
  { id: 'log-1', timestamp: '16:07:14.204', source: 'CNN_ENGINE', message: 'Cherry Batch #402 processed: 1,420 cherries scanned. Ripeness score: 96.8% (Grade A)', level: 'success' },
  { id: 'log-2', timestamp: '16:07:08.891', source: 'SOIL_NODE_04', message: 'Highland Sector A soil moisture optimal at 68.4% RH. Irrigation valve standby.', level: 'info' },
  { id: 'log-3', timestamp: '16:06:54.110', source: 'FLEET_GPS', message: 'Kubota Tractor #02 entered Plot B-12 for harvest transport.', level: 'info' },
  { id: 'log-4', timestamp: '16:06:32.402', source: 'SILO_SENSOR', message: 'Robusta Storage Silo #02 reaches 82% capacity threshold.', level: 'warning' },
  { id: 'log-5', timestamp: '16:06:10.095', source: 'DE_PULPER_01', message: 'Water pressure flow steady at 4.2 bar. Zero blockages detected.', level: 'success' },
  { id: 'log-6', timestamp: '16:05:45.312', source: 'WEATHER_STN', message: 'Solar irradiance 820 W/m² • Ambient Temp: 26.4°C • Wind: 8 km/h NE', level: 'info' },
  { id: 'log-7', timestamp: '16:05:12.780', source: 'FIREBASE_SYNC', message: 'Cloud database snapshot synchronized successfully. 42 mutations pushed.', level: 'success' },
];

export const SensorLogStream: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [isLive, setIsLive] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'alert'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const mockEvents: Array<{ source: string; message: string; level: 'info' | 'success' | 'warning' | 'alert' }> = [
        { source: 'CNN_ENGINE', message: 'Frame analysis: 320 cherries detected • Ripeness score: 97.4%', level: 'success' },
        { source: 'SOIL_NODE_12', message: 'Valley Sector B soil pH: 6.2 (Ideal for Arabica)', level: 'info' },
        { source: 'SOLAR_GRID', message: 'Battery bank charging at 14.8 Amps from solar array.', level: 'info' },
        { source: 'DE_PULPER_02', message: 'Vibration frequency normal • Bearing temp: 38.5°C', level: 'success' },
        { source: 'SMS_GATEWAY', message: 'Broadcast sent to 42 field workers: "Harvest Schedule Plot A-3"', level: 'info' },
        { source: 'SILO_SENSOR', message: 'Temperature inside Dryer Bed #03: 42.1°C (Optimal drying)', level: 'info' },
      ];

      const randomEvent = mockEvents[Math.floor(Math.random() * mockEvents.length)];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        source: randomEvent.source,
        message: randomEvent.message,
        level: randomEvent.level,
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    }, 3200);

    return () => clearInterval(interval);
  }, [isLive]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.source.toLowerCase().includes(search.toLowerCase()) ||
      log.message.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <Card className="border border-border/80 bg-slate-950 text-slate-100 shadow-xl rounded-xl overflow-hidden flex flex-col h-full font-mono text-xs">
      {/* Console macOS Window Header */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* macOS window dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200 font-heading text-xs">
              Live Sensor Telemetry Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> STREAMING
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className="h-7 px-2.5 text-[11px] gap-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
          >
            {isLive ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
            <span>{isLive ? 'Pause' : 'Resume'}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLogs([])}
            className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border-b border-slate-800/60 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1">
          {(['all', 'info', 'success', 'warning', 'alert'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                levelFilter === lvl
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Log Entries Stream */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-2 max-h-[300px] min-h-[220px] bg-slate-950/90 leading-relaxed font-mono text-[11px]"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 text-center py-8 text-xs">
            No telemetry log entries match the selected filter.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2.5 group hover:bg-slate-900/80 p-1.5 rounded transition-colors"
            >
              <span className="text-slate-500 text-[10px] shrink-0 pt-0.5 font-mono">{log.timestamp}</span>

              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded shrink-0 uppercase tracking-wider ${
                  log.level === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : log.level === 'warning'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : log.level === 'alert'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}
              >
                {log.source}
              </span>

              <span className="text-slate-300 flex-1 break-all">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
