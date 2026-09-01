import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  FileText,
  Clock,
  Wrench,
  Coffee,
  LogOut,
  Moon,
  Sun,
  User,
  ShieldAlert,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useFarmData } from '../../store/FarmDataProvider';
import { WorkerCherryScanner } from './WorkerCherryScanner';
import { WorkerScanReports } from './WorkerScanReports';
import { WorkerAttendance } from './WorkerAttendance';
import { WorkerFieldReports } from './WorkerFieldReports';
import { Button } from '../ui/button';

export type WorkerTabId = 'scanner' | 'reports' | 'attendance' | 'issues';

const WORKER_TABS: { id: WorkerTabId; label: string; icon: React.ElementType; mobileLabel: string }[] = [
  { id: 'scanner', label: 'Cherry Scanner', mobileLabel: 'Scan', icon: Camera },
  { id: 'reports', label: 'Scan Reports & History', mobileLabel: 'Reports', icon: FileText },
  { id: 'attendance', label: 'Daily Attendance', mobileLabel: 'Attendance', icon: Clock },
  { id: 'issues', label: 'Field Issues', mobileLabel: 'Issues', icon: Wrench },
];

export function WorkerAppShell() {
  const { session, signOut } = useAuth();
  const { saving, error } = useFarmData();

  const [activeTab, setActiveTab] = useState<WorkerTabId>('scanner');
  const [darkMode, setDarkMode] = useState(true);

  const workerName = session?.displayName || 'Juan Dela Cruz';
  const workerEmail = session?.email || 'worker@acojidofarm.ph';

  // Synchronize dark mode class
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const renderActiveModule = () => {
    switch (activeTab) {
      case 'scanner':
        return (
          <WorkerCherryScanner
            onScanSaved={() => {
              /* Scan saved callback */
            }}
            onNavigateToHistory={() => setActiveTab('reports')}
          />
        );
      case 'reports':
        return <WorkerScanReports onOpenScanner={() => setActiveTab('scanner')} />;
      case 'attendance':
        return <WorkerAttendance />;
      case 'issues':
        return <WorkerFieldReports />;
      default:
        return <WorkerCherryScanner />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200 antialiased selection:bg-amber-500/30">
      {/* Worker App Top Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border/80 px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Worker Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-bold shadow-sm flex-shrink-0">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base font-heading text-foreground">
                  Acojido Farm
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                  Field Worker
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Worker: <span className="font-semibold text-foreground">{workerName}</span> · Section D
              </p>
            </div>
          </div>

          {/* Desktop & Tablet Navigation Segmented Pill */}
          <nav className="hidden md:flex items-center bg-muted/60 p-1 rounded-2xl border border-border/70">
            {WORKER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Header Controls (Theme & Sign Out) */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="rounded-xl h-9 px-3 text-xs font-semibold text-muted-foreground hover:text-rose-600 gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Cloud Sync Status Indicator Banner */}
      {saving && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs font-semibold text-amber-700 dark:text-amber-300">
          Syncing updates to farm cloud database…
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto pb-24 md:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {renderActiveModule()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border/80 px-2 py-2 shadow-2xl safe-area-bottom">
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {WORKER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-black' : 'text-muted-foreground'}`} />
                <span className="text-[10px] leading-tight tracking-tight">{tab.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
