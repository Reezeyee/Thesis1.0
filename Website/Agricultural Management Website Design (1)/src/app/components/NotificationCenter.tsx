import { useMemo, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, RefreshCw, Wrench, X } from 'lucide-react';
import { useFarmData } from '../store/FarmDataProvider';
import type { AppModuleId } from '../App';

export interface PendingReportItem {
  id: string;
  type: 'irrigation' | 'equipment' | 'supply' | 'pest' | 'harvest';
  title: string;
  subtitle: string;
  details: string;
  reportedBy: string;
  reportedAt: string;
  timestamp: number;
  rawReportId: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateModule: (module: AppModuleId, targetElementId?: string) => void;
}

export function usePendingReports() {
  const { state } = useFarmData();

  const pendingList = useMemo(() => {
    const list: PendingReportItem[] = [];

    // 1. Irrigation / Sprinkler damage reports
    (state.irrigationDamageReports ?? []).forEach((r, idx) => {
      const status = (r.status || 'Pending').trim().toLowerCase();
      if (status === 'pending') {
        const rawId = r.reportId || '';
        const id = rawId || `irrigation-${idx}-${r.reportedAt}`;
        list.push({
          id,
          type: 'irrigation',
          title: r.sprinklerLabel?.trim() || r.zone?.trim() || 'Sprinkler Damage Reported',
          subtitle: r.zone && r.zone.trim() !== (r.sprinklerLabel || '').trim() ? `Zone: ${r.zone}` : 'Sprinkler System',
          details: r.details || 'Sprinkler damage reported by field worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: rawId,
        });
      }
    });

    // 2. Equipment condition reports
    (state.equipmentReports ?? []).forEach((r, idx) => {
      if (!r.reviewed && !r.fixedAt && !r.isFixedReport) {
        const rawId = r.reportId || '';
        const id = rawId || `equipment-${idx}-${r.reportedAt}`;
        list.push({
          id,
          type: 'equipment',
          title: `${r.equipmentName || 'Equipment'} Issue`,
          subtitle: r.isWrecked ? 'Condition: Wrecked / Broken' : 'Condition: Needs Maintenance',
          details: r.notes || 'Equipment issue reported by staff',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: rawId,
        });
      }
    });

    // 3. Consumable supply reports
    (state.consumableReports ?? []).forEach((r, idx) => {
      if (!r.reviewed) {
        const rawId = r.reportId || '';
        const id = rawId || `supply-${idx}-${r.reportedAt}`;
        list.push({
          id,
          type: 'supply',
          title: `${r.supplyName || 'Supply'} Report`,
          subtitle: r.isRunOut ? 'Status: Out of Stock' : 'Status: Stock Update',
          details: r.notes || 'Consumable supply report submitted by worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: rawId,
        });
      }
    });

    // 4. Pest & disease logs
    (state.pestControlLogs ?? []).forEach((r, idx) => {
      const status = (r.status || 'Pending').trim().toLowerCase();
      if (status === 'pending') {
        const rawId = r.pestControlId || '';
        const id = rawId || `pest-${idx}-${r.date}`;
        list.push({
          id,
          type: 'pest',
          title: `Pest/Disease: ${r.issue || 'Issue Reported'}`,
          subtitle: `Zone: ${r.field || 'General'}${r.treeNumber ? ` · Tree #${r.treeNumber}` : ''}`,
          details: r.treatment ? `Plan: ${r.treatment}` : 'Pest/disease issue reported by worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.date || 'Just now',
          timestamp: Date.parse(r.date || '') || (Date.now() - idx),
          rawReportId: rawId,
        });
      }
    });

    // 5. Harvest readiness reports
    (state.harvestReadinessReports ?? []).forEach((r, idx) => {
      const status = (r.status || 'Pending Review').trim().toLowerCase();
      if (status.includes('pending')) {
        const rawId = r.reportId || '';
        const id = rawId || `harvest-${idx}-${r.reportedAt}`;
        list.push({
          id,
          type: 'harvest',
          title: `Harvest Readiness: ${r.zone || 'Crop Zone'}`,
          subtitle: `Estimated Yield: ${r.expectedWeight || 'N/A'}`,
          details: r.notes || 'Harvest readiness report submitted by worker',
          reportedBy: r.reportedBy || 'Worker',
          reportedAt: r.reportedAt || 'Just now',
          timestamp: Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: rawId,
        });
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [
    state.irrigationDamageReports,
    state.equipmentReports,
    state.consumableReports,
    state.pestControlLogs,
    state.harvestReadinessReports,
  ]);

  return pendingList;
}

export function GlobalNotificationBanner({
  onNavigateModule,
}: {
  onNavigateModule: (module: AppModuleId, targetElementId?: string) => void;
}) {
  const { updateState, saving } = useFarmData();
  const pendingReports = usePendingReports();

  const [dismissedReportIds, setDismissedReportIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dismissed_irrigation_report_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const latestPendingReport = useMemo(() => {
    return pendingReports.find((r) => !dismissedReportIds.includes(r.id)) ?? null;
  }, [pendingReports, dismissedReportIds]);

  const dismissNotification = (id: string) => {
    if (!id) return;
    setDismissedReportIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem('dismissed_irrigation_report_ids', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleNavigateToReport = (item: PendingReportItem) => {
    dismissNotification(item.id);
    let targetModule: AppModuleId = 'farm';
    let targetElementId = 'sprinkler-damage-reports-section';

    if (item.type === 'equipment') {
      targetModule = 'equipment';
      targetElementId = item.rawReportId ? `equipment-${item.rawReportId}` : 'equipment-reports-section';
    } else if (item.type === 'supply') {
      targetModule = 'equipment';
      targetElementId = item.rawReportId ? `supply-${item.rawReportId}` : 'consumable-reports-section';
    } else if (item.type === 'pest') {
      targetModule = 'farm';
      targetElementId = item.rawReportId ? `pest-${item.rawReportId}` : 'pest-reports-section';
    } else if (item.type === 'harvest') {
      targetModule = 'farm';
      targetElementId = item.rawReportId ? `harvest-${item.rawReportId}` : 'harvest-readiness-reports-section';
    } else if (item.type === 'irrigation') {
      targetModule = 'farm';
      targetElementId = item.rawReportId ? `report-${item.rawReportId}` : 'sprinkler-damage-reports-section';
    }

    try {
      window.location.hash = targetElementId;
    } catch {}
    onNavigateModule(targetModule, targetElementId);
  };

  const handleResolveReport = async (item: PendingReportItem) => {
    dismissNotification(item.id);
    await updateState((prev) => {
      if (item.type === 'irrigation') {
        const next = (prev.irrigationDamageReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId || r.sprinklerLabel === item.title ? { ...r, status: 'Resolved' } : r
        );
        return { ...prev, irrigationDamageReports: next };
      } else if (item.type === 'equipment') {
        const next = (prev.equipmentReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId ? { ...r, reviewed: true } : r
        );
        return { ...prev, equipmentReports: next };
      } else if (item.type === 'supply') {
        const next = (prev.consumableReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId ? { ...r, reviewed: true } : r
        );
        return { ...prev, consumableReports: next };
      } else if (item.type === 'pest') {
        const next = (prev.pestControlLogs ?? []).map((r) =>
          (r.pestControlId || '') === item.rawReportId ? { ...r, status: 'Resolved' } : r
        );
        return { ...prev, pestControlLogs: next };
      } else if (item.type === 'harvest') {
        const next = (prev.harvestReadinessReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId ? { ...r, status: 'Approved' } : r
        );
        return { ...prev, harvestReadinessReports: next };
      }
      return prev;
    });
  };

  if (!latestPendingReport) return null;

  return (
    <div className="fixed top-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-top-6 fade-in duration-300 pointer-events-auto">
      <div className="bg-[#fdfbf7]/95 backdrop-blur-md border-2 border-[#d4183d]/40 rounded-2xl p-4 shadow-2xl ring-4 ring-[#d4183d]/15 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-[#d4183d]/15 rounded-full blur-xl pointer-events-none animate-pulse" />

        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3 cursor-pointer group"
            onClick={() => handleNavigateToReport(latestPendingReport)}
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d4183d]/15 text-[#d4183d] shadow-sm group-hover:scale-105 transition-transform">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#d4183d]/30 animate-ping" />
              <AlertTriangle className="h-5 w-5 relative z-10 text-[#d4183d]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black text-[#3e2723] uppercase tracking-wider group-hover:text-[#d4183d] transition-colors">
                  Worker Problem Reported!
                </h4>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#d4183d] text-white uppercase animate-pulse">
                  NEW
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                <strong className="text-[#3e2723] font-bold">{latestPendingReport.title}</strong>
                {latestPendingReport.subtitle ? ` (${latestPendingReport.subtitle})` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismissNotification(latestPendingReport.id)}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors"
            title="Mark as read / Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="mt-3 bg-[#f5f1ed] rounded-xl p-3 border border-[#4a2c2a]/10 text-xs text-[#3e2723] cursor-pointer hover:bg-[#eae3dc] transition-colors"
          onClick={() => handleNavigateToReport(latestPendingReport)}
        >
          <p className="font-semibold text-[#4a2c2a]/80 mb-1 text-[10px]">
            Reported by: <span className="text-[#3e2723] font-bold">{latestPendingReport.reportedBy || 'Worker'}</span> • {latestPendingReport.reportedAt || 'Just now'}
          </p>
          <p className="text-xs font-medium text-[#2d2520] italic">
            "{latestPendingReport.details || 'No details provided'}"
          </p>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleNavigateToReport(latestPendingReport)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#3e2723] text-white hover:bg-[#2b1b18] shadow-sm transition-all active:scale-95 flex items-center gap-1"
          >
            View Report ↓
          </button>
          <button
            type="button"
            onClick={() => dismissNotification(latestPendingReport.id)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#4a2c2a]/20 text-[#4a2c2a] hover:bg-[#4a2c2a]/10 transition-colors"
          >
            Mark as Read
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleResolveReport(latestPendingReport)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#2d5016] text-white hover:bg-[#1b3310] shadow-sm transition-all active:scale-95 flex items-center gap-1 disabled:opacity-60"
          >
            ✓ Mark Resolved
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationDrawer({ isOpen, onClose, onNavigateModule }: NotificationCenterProps) {
  const { updateState, saving } = useFarmData();
  const pendingReports = usePendingReports();

  const handleNavigate = (item: PendingReportItem) => {
    onClose();
    let targetModule: AppModuleId = 'farm';
    let targetElementId = 'sprinkler-damage-reports-section';

    if (item.type === 'equipment') {
      targetModule = 'equipment';
      targetElementId = item.rawReportId ? `equipment-${item.rawReportId}` : 'equipment-reports-section';
    } else if (item.type === 'supply') {
      targetModule = 'equipment';
      targetElementId = item.rawReportId ? `supply-${item.rawReportId}` : 'consumable-reports-section';
    } else if (item.type === 'pest') {
      targetModule = 'farm';
      targetElementId = item.rawReportId ? `pest-${item.rawReportId}` : 'pest-reports-section';
    } else if (item.type === 'harvest') {
      targetModule = 'farm';
      targetElementId = item.rawReportId ? `harvest-${item.rawReportId}` : 'harvest-readiness-reports-section';
    } else if (item.type === 'irrigation') {
      targetModule = 'farm';
      targetElementId = item.rawReportId ? `report-${item.rawReportId}` : 'sprinkler-damage-reports-section';
    }

    try {
      window.location.hash = targetElementId;
    } catch {}
    onNavigateModule(targetModule, targetElementId);
  };

  const handleResolve = async (item: PendingReportItem) => {
    await updateState((prev) => {
      if (item.type === 'irrigation') {
        const next = (prev.irrigationDamageReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId || r.sprinklerLabel === item.title ? { ...r, status: 'Resolved' } : r
        );
        return { ...prev, irrigationDamageReports: next };
      } else if (item.type === 'equipment') {
        const next = (prev.equipmentReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId ? { ...r, reviewed: true } : r
        );
        return { ...prev, equipmentReports: next };
      } else if (item.type === 'supply') {
        const next = (prev.consumableReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId ? { ...r, reviewed: true } : r
        );
        return { ...prev, consumableReports: next };
      } else if (item.type === 'pest') {
        const next = (prev.pestControlLogs ?? []).map((r) =>
          (r.pestControlId || '') === item.rawReportId ? { ...r, status: 'Resolved' } : r
        );
        return { ...prev, pestControlLogs: next };
      } else if (item.type === 'harvest') {
        const next = (prev.harvestReadinessReports ?? []).map((r) =>
          (r.reportId || '') === item.rawReportId ? { ...r, status: 'Approved' } : r
        );
        return { ...prev, harvestReadinessReports: next };
      }
      return prev;
    });
  };

  const handleClearDismissed = () => {
    try {
      localStorage.removeItem('dismissed_irrigation_report_ids');
    } catch {}
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Slide-out Drawer */}
      <div className="relative w-full max-w-md bg-[#fdfbf7] h-full shadow-2xl flex flex-col border-l border-[#4a2c2a]/10 animate-in slide-in-from-right duration-300">
        <div className="p-5 border-b border-[#4a2c2a]/10 bg-[#4a2c2a] text-[#fdfbf7] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2d5016] flex items-center justify-center text-white">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">Worker Reports & Alerts</h2>
              <p className="text-xs text-[#d4a574]">
                {pendingReports.length} pending report{pendingReports.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {pendingReports.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#2d5016]/10 text-[#2d5016] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-[#3e2723]">All caught up!</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                There are no pending worker reports requiring admin attention right now.
              </p>
              <button
                type="button"
                onClick={handleClearDismissed}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#f5f1ed] text-[#3e2723] hover:bg-[#eae3dc] border border-[#4a2c2a]/15 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Dismissed History
              </button>
            </div>
          ) : (
            pendingReports.map((item) => {
              const badgeClass =
                item.type === 'irrigation'
                  ? 'bg-[#d4183d] text-white'
                  : item.type === 'equipment'
                  ? 'bg-[#8b6f47] text-white'
                  : item.type === 'supply'
                  ? 'bg-[#d4a574] text-[#3e2723]'
                  : item.type === 'pest'
                  ? 'bg-[#b01230] text-white'
                  : 'bg-[#2d5016] text-white';

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-[#4a2c2a]/10 shadow-sm hover:border-[#4a2c2a]/30 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${badgeClass}`}>
                        {item.type}
                      </span>
                      <h4 className="font-bold text-sm text-[#3e2723] mt-1">{item.title}</h4>
                      <p className="text-xs font-semibold text-[#2d5016]">{item.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate(item)}
                      className="p-1.5 rounded-lg bg-[#f5f1ed] text-[#3e2723] hover:bg-[#3e2723] hover:text-white transition-colors"
                      title="View on page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-[#2d2520] bg-[#f5f1ed] p-2.5 rounded-xl border border-[#4a2c2a]/5 italic">
                    "{item.details}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>
                      By <strong>{item.reportedBy}</strong> • {item.reportedAt}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleNavigate(item)}
                        className="font-bold px-2.5 py-1 rounded-lg bg-[#3e2723] text-white text-[11px] hover:bg-[#2b1b18] transition-colors"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleResolve(item)}
                        className="font-bold px-2.5 py-1 rounded-lg bg-[#2d5016] text-white text-[11px] hover:bg-[#1b3310] transition-colors disabled:opacity-60"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pendingReports.length > 0 ? (
          <div className="p-4 border-t border-[#4a2c2a]/10 bg-[#f5f1ed] text-center">
            <button
              type="button"
              onClick={handleClearDismissed}
              className="text-xs font-semibold text-[#5d4037] hover:text-[#3e2723] inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restore Previously Dismissed Popups
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
