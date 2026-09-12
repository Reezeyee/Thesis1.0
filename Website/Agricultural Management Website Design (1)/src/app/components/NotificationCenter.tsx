import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, KeyRound, Lock, RefreshCw, Wrench, X } from 'lucide-react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { useFarmData } from '../store/FarmDataProvider';
import { computeLowStockThreshold, type SmsMessageRecord, type WorkerRecord } from '../types/appState';
import { adminResetWorkerPassword } from '../lib/apiClient';
import type { AppModuleId } from '../App';

export interface PendingReportItem {
  id: string;
  type: 'irrigation' | 'equipment' | 'supply' | 'pest' | 'harvest' | 'password_reset';
  title: string;
  subtitle: string;
  details: string;
  reportedBy: string;
  reportedAt: string;
  timestamp: number;
  rawReportId: string;
  /** password_reset only: raw Firestore status (`pending` | `approved` | `resolved` | ...). */
  status?: string;
  /** password_reset only: the worker's account email, used to set a new temp password via the backend on approval. */
  email?: string;
}

/**
 * Mounted once, app-wide (see App.tsx). Watches password_reset_requests and mirrors them into the
 * admin/worker SMS thread (SmsManagement) so a forgotten-password request shows up as a chat
 * message, and an approval posts a reply -- without needing the worker to be signed in to write
 * into the shared app_state document themselves (Firestore rules require auth for that; the
 * requests collection is intentionally open so a signed-out worker can still file one).
 * Idempotent: keyed by deterministic message ids, safe to run against the same request repeatedly.
 */
export function PasswordResetMessageSync() {
  const { state, updateState } = useFarmData();
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return onSnapshot(collection(db, COLLECTIONS.PASSWORD_RESET_REQUESTS), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') return;
        const data = change.doc.data();
        const status = String(data.status ?? 'pending').toLowerCase();
        const displayName = String(data.displayName || data.username || data.email || 'Worker');
        const requestId = change.doc.id;
        const workerMsgId = `pwreset-request-${requestId}`;

        const existing = stateRef.current.smsMessages || [];
        const needsRequestMsg = !existing.some((m) => m.messageId === workerMsgId);
        // The approval message (with the actual temp password) is posted by
        // approvePasswordResetRequest() below, right when the admin approves --
        // it needs the freshly generated password, so it can't be synthesized here.
        if (!needsRequestMsg) return;

        void updateState((prev) => {
          const prevMsgs = prev.smsMessages || [];
          if (prevMsgs.some((m) => m.messageId === workerMsgId)) return prev;
          const addition: SmsMessageRecord = {
            messageId: workerMsgId,
            senderName: displayName,
            recipientName: 'admin',
            messageBody: 'I forgot my password and requested a reset from the app. Please review and approve it in Settings.',
            timestamp: Date.now(),
            status: 'Received',
            viaGateway: 'App Request',
          };
          return { ...prev, smsMessages: [...prevMsgs, addition] };
        });
      });
    });
  }, [updateState]);

  return null;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateModule: (module: AppModuleId, targetElementId?: string) => void;
}

export function usePendingReports() {
  const { state } = useFarmData();
  const [passwordResetItems, setPasswordResetItems] = useState<PendingReportItem[]>([]);

  // Real-time Firestore subscription to Password Reset Requests from worker mobile scanners
  useEffect(() => {
    return onSnapshot(
      collection(db, COLLECTIONS.PASSWORD_RESET_REQUESTS),
      (snapshot) => {
        const items: PendingReportItem[] = snapshot.docs
          .map((d): PendingReportItem | null => {
            const data = d.data();
            const status = String(data.status ?? 'pending').toLowerCase();
            const isResolved = status === 'resolved' || status === 'completed';
            if (isResolved) return null;

            const reqAt = data.requestedAt as Timestamp | undefined;
            const dateObj = reqAt?.toDate?.() ?? new Date();
            const displayName = String(data.displayName || data.username || data.email || 'Worker');
            const email = String(data.email || data.username || '');
            const isApproved = status === 'approved';

            return {
              id: `pw-reset-${d.id}`,
              type: 'password_reset' as const,
              title: `Password Reset Request: ${displayName}`,
              subtitle: isApproved ? 'Status: Approved by Admin (temp password sent)' : (email ? `Account: ${email}` : 'Pending Admin Approval'),
              details: isApproved
                ? `Password reset has been approved for ${displayName}. A new temporary password was set and sent to them -- they can log in with it now.`
                : `Worker "${displayName}" requested a password reset from the Android mobile app. Tap "Approve Reset" to set a new temporary password for them.`,
              reportedBy: displayName,
              reportedAt: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
              timestamp: dateObj.getTime() || Date.now(),
              rawReportId: d.id,
              status,
              email,
            };
          })
          .filter((item): item is PendingReportItem => item !== null)
          .sort((a, b) => b.timestamp - a.timestamp);

        setPasswordResetItems(items);
      },
      (err) => {
        console.warn('Password reset listener error:', err);
        setPasswordResetItems([]);
      }
    );
  }, []);

  const pendingList = useMemo(() => {
    const list: PendingReportItem[] = [...passwordResetItems];

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
          title: `Harvest Readiness: ${r.section || r.zone || 'Crop Zone'}`,
          subtitle: `Status: ${r.readinessStatus || r.expectedWeight || 'Ready for Harvest'}`,
          details: r.notes || 'Harvest readiness report submitted by worker',
          reportedBy: r.workerName || r.reportedBy || 'Worker',
          reportedAt: r.date && r.time ? `${r.date} ${r.time}` : (r.reportedAt || 'Just now'),
          timestamp: r.timestampMillis || Date.parse(r.reportedAt || '') || (Date.now() - idx),
          rawReportId: rawId,
        });
      }
    });

    // 6. Low-stock inventory items
    (state.consumableSupplies ?? []).forEach((s, idx) => {
      const threshold = computeLowStockThreshold(s);
      if (s.stock <= threshold) {
        const rawId = s.supplyId || '';
        const id = `low-stock-${rawId || idx}`;
        list.push({
          id,
          type: 'supply',
          title: `Low Stock Alert: ${s.name}`,
          subtitle: s.stock === 0 ? 'Status: Out of Stock' : `Remaining: ${s.stock} ${s.unit} (Threshold: ${threshold})`,
          details: `Consumable item "${s.name}" is low on stock (${s.stock} ${s.unit} remaining; 30% low-stock threshold is ${threshold} ${s.unit}). Restocking required.`,
          reportedBy: 'Inventory Monitor',
          reportedAt: s.lastRestocked || 'Recent',
          timestamp: Date.now() - idx * 1000,
          rawReportId: rawId,
        });
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [
    passwordResetItems,
    state.irrigationDamageReports,
    state.equipmentReports,
    state.consumableReports,
    state.pestControlLogs,
    state.harvestReadinessReports,
    state.consumableSupplies,
  ]);

  return pendingList;
}

/**
 * Approves a pending password_reset request and, instead of emailing a reset link (which can't
 * reach the placeholder @acojidofarm.local addresses worker accounts are created with), calls the
 * backend's /admin/reset-worker-password endpoint. That endpoint holds privileged Firebase Admin
 * credentials and sets a brand-new temporary password directly on the worker's account, plus flags
 * mustChangePassword so the worker is walked through the existing "set a new password" screen the
 * next time they log in with it. The temp password is posted into the in-app message thread and,
 * if the worker has a phone number on file, offered as a one-tap SMS to send it to them directly.
 */
async function approvePasswordResetRequest(
  item: PendingReportItem,
  workers: WorkerRecord[],
  updateState: (updater: (prev: any) => any) => Promise<void> | void
) {
  if (item.type !== 'password_reset' || !item.rawReportId) return;

  try {
    await updateDoc(doc(db, COLLECTIONS.PASSWORD_RESET_REQUESTS, item.rawReportId), {
      status: 'approved',
      approvedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to approve password reset request:', err);
    return;
  }

  if (!item.email) return;

  let tempPassword: string;
  try {
    const result = await adminResetWorkerPassword(item.email);
    tempPassword = result.temp_password;
  } catch (err) {
    console.error('Failed to set a new temporary password via the backend:', err);
    window.alert(
      `The request was approved, but a new password could not be set automatically.\n\n${
        err instanceof Error ? err.message : String(err)
      }\n\nMake sure the backend server is running (see backend/app.py) and has a Firebase service account key configured.`
    );
    return;
  }

  const worker = workers.find((w) => w.accountEmail === item.email);
  const messageBody = `Your password reset was approved. Your new temporary password is: ${tempPassword}\nLog in with it in the app -- you'll be asked to set your own new password right after.`;

  await updateState((prev) => ({
    ...prev,
    smsMessages: [
      ...(prev.smsMessages || []),
      {
        messageId: `pwreset-temppass-${item.rawReportId}-${Date.now()}`,
        senderName: 'admin',
        recipientName: item.reportedBy || 'Worker',
        messageBody,
        timestamp: Date.now(),
        status: 'Sent',
        viaGateway: worker?.phoneNumber ? 'Native SMS' : 'In-app only',
      } as SmsMessageRecord,
    ],
  }));

  if (worker?.phoneNumber) {
    const shouldText = window.confirm(
      `New temporary password for ${item.reportedBy}: ${tempPassword}\n\nOpen your phone's SMS app to text it to ${worker.phoneNumber} now?`
    );
    if (shouldText) {
      window.open(`sms:${worker.phoneNumber}?body=${encodeURIComponent(messageBody)}`, '_blank');
    }
  } else {
    window.alert(
      `New temporary password for ${item.reportedBy}: ${tempPassword}\n\n(No phone number on file for this worker -- copy this and relay it to them yourself.)`
    );
  }
}

export function GlobalNotificationBanner({
  onNavigateModule,
}: {
  onNavigateModule: (module: AppModuleId, targetElementId?: string) => void;
}) {
  const { state, updateState, saving } = useFarmData();
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
    } else if (item.type === 'password_reset') {
      targetModule = 'settings';
      targetElementId = 'password-reset-requests-section';
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
    if (item.type === 'password_reset' && item.rawReportId) {
      try {
        await updateDoc(doc(db, COLLECTIONS.PASSWORD_RESET_REQUESTS, item.rawReportId), {
          status: 'resolved',
        });
      } catch (err) {
        console.error('Failed to resolve password reset request:', err);
      }
      return;
    }

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
      <div className="bg-card/95 backdrop-blur-md border-2 border-[#d4183d]/40 rounded-2xl p-4 shadow-2xl ring-4 ring-[#d4183d]/15 relative overflow-hidden">
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
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider group-hover:text-[#d4183d] transition-colors">
                  Worker Problem Reported!
                </h4>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#d4183d] text-white uppercase animate-pulse">
                  NEW
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                <strong className="text-foreground font-bold">{latestPendingReport.title}</strong>
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
          className="mt-3 bg-muted/40 rounded-xl p-3 border border-border/60 text-xs text-foreground cursor-pointer hover:bg-[#eae3dc] transition-colors"
          onClick={() => handleNavigateToReport(latestPendingReport)}
        >
          <p className="font-semibold text-foreground/80 mb-1 text-[10px]">
            Reported by: <span className="text-foreground font-bold">{latestPendingReport.reportedBy || 'Worker'}</span> • {latestPendingReport.reportedAt || 'Just now'}
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
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border/80 text-foreground hover:bg-[#4a2c2a]/10 transition-colors"
          >
            Mark as Read
          </button>
          {latestPendingReport.type === 'password_reset' && latestPendingReport.status === 'pending' ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void approvePasswordResetRequest(latestPendingReport, state.workers || [], updateState)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#6b21a8] text-white hover:bg-[#581c87] shadow-sm transition-all active:scale-95 flex items-center gap-1 disabled:opacity-60"
            >
              <KeyRound className="w-3.5 h-3.5" /> Approve Reset
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleResolveReport(latestPendingReport)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#2d5016] text-white hover:bg-[#1b3310] shadow-sm transition-all active:scale-95 flex items-center gap-1 disabled:opacity-60"
            >
              ✓ Mark Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationDrawer({ isOpen, onClose, onNavigateModule }: NotificationCenterProps) {
  const { state, updateState, saving } = useFarmData();
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
    } else if (item.type === 'password_reset') {
      targetModule = 'settings';
      targetElementId = 'password-reset-requests-section';
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
    if (item.type === 'password_reset' && item.rawReportId) {
      try {
        await updateDoc(doc(db, COLLECTIONS.PASSWORD_RESET_REQUESTS, item.rawReportId), {
          status: 'resolved',
        });
      } catch (err) {
        console.error('Failed to resolve password reset request:', err);
      }
      return;
    }

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
      <div className="relative w-full max-w-md bg-card h-full shadow-2xl flex flex-col border-l border-border/60 animate-in slide-in-from-right duration-300">
        <div className="p-5 border-b border-border/60 bg-[#4a2c2a] text-[#fdfbf7] flex items-center justify-between">
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
              <h3 className="font-bold text-foreground">All caught up!</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                There are no pending worker reports requiring admin attention right now.
              </p>
              <button
                type="button"
                onClick={handleClearDismissed}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-muted/40 text-foreground hover:bg-[#eae3dc] border border-border/70 transition-all"
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
                  ? 'bg-[#d4a574] text-foreground'
                  : item.type === 'pest'
                  ? 'bg-[#b01230] text-white'
                  : item.type === 'password_reset'
                  ? 'bg-[#6b21a8] text-white'
                  : 'bg-[#2d5016] text-white';

              return (
                <div
                  key={item.id}
                  className="bg-background/80 rounded-2xl p-4 border border-border/60 shadow-sm hover:border-border/80 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${badgeClass}`}>
                        {item.type}
                      </span>
                      <h4 className="font-bold text-sm text-foreground mt-1">{item.title}</h4>
                      <p className="text-xs font-semibold text-[#2d5016]">{item.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavigate(item)}
                      className="p-1.5 rounded-lg bg-muted/40 text-foreground hover:bg-[#3e2723] hover:text-white transition-colors"
                      title="View on page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-[#2d2520] bg-muted/40 p-2.5 rounded-xl border border-border/40 italic">
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
                      {item.type === 'password_reset' && item.status === 'pending' ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void approvePasswordResetRequest(item, state.workers || [], updateState)}
                          className="font-bold px-2.5 py-1 rounded-lg bg-[#6b21a8] text-white text-[11px] hover:bg-[#581c87] transition-colors disabled:opacity-60"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleResolve(item)}
                          className="font-bold px-2.5 py-1 rounded-lg bg-[#2d5016] text-white text-[11px] hover:bg-[#1b3310] transition-colors disabled:opacity-60"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pendingReports.length > 0 ? (
          <div className="p-4 border-t border-border/60 bg-muted/40 text-center">
            <button
              type="button"
              onClick={handleClearDismissed}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restore Previously Dismissed Popups
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
