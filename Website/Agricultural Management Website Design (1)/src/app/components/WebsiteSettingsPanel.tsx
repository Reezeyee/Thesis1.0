import type { LucideIcon } from 'lucide-react';
import { Bell, Cloud, KeyRound, Lock, Palette, User } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore';
import { Switch } from './ui/switch';
import { useAuth } from '../auth/AuthProvider';
import { useFarmData } from '../store/FarmDataProvider';
import { Button } from './ui/button';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { adminResetWorkerPassword } from '../lib/apiClient';
import type { SmsMessageRecord } from '../types/appState';

type PasswordResetRequest = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  requestedAt: Date | null;
};

function Row({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 border-b border-border/60 last:border-0">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#2d5016]/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#2d5016]" />
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function WebsiteSettingsPanel() {
  const { session, signOut } = useAuth();
  const { state, updateState, syncStatus, lastUpdatedAt, error } = useFarmData();
  const [darkTheme, setDarkTheme] = useState(false);
  const [pushOn, setPushOn] = useState(true);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const handleResolveResetRequest = async (id: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.PASSWORD_RESET_REQUESTS, id), {
        status: 'resolved',
      });
    } catch (err) {
      console.error('Failed to resolve password reset request:', err);
    }
  };

  /**
   * Approving sets the request's status, then asks the backend (which holds privileged Firebase
   * Admin credentials) to set a brand-new temporary password directly on the worker's account --
   * no real email required, so this works even for the auto-generated @acojidofarm.local
   * placeholder accounts. The worker is forced through the existing "set a new password" screen
   * the next time they log in with it. The temp password is posted into the in-app message thread
   * and, if a phone number is on file, offered as a one-tap SMS.
   */
  const handleApproveResetRequest = async (id: string, email: string, displayName: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.PASSWORD_RESET_REQUESTS, id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to approve password reset request:', err);
      return;
    }

    if (!email) return;

    setResettingId(id);
    try {
      const result = await adminResetWorkerPassword(email);
      const tempPassword = result.temp_password;
      const worker = (state.workers || []).find((w) => w.accountEmail === email);
      const messageBody = `Your password reset was approved. Your new temporary password is: ${tempPassword}\nLog in with it in the app -- you'll be asked to set your own new password right after.`;

      await updateState((prev) => ({
        ...prev,
        smsMessages: [
          ...(prev.smsMessages || []),
          {
            messageId: `pwreset-temppass-${id}-${Date.now()}`,
            senderName: 'admin',
            recipientName: displayName || 'Worker',
            messageBody,
            timestamp: Date.now(),
            status: 'Sent',
            viaGateway: worker?.phoneNumber ? 'Native SMS' : 'In-app only',
          } as SmsMessageRecord,
        ],
      }));

      if (worker?.phoneNumber) {
        const shouldText = window.confirm(
          `New temporary password for ${displayName}: ${tempPassword}\n\nOpen your phone's SMS app to text it to ${worker.phoneNumber} now?`
        );
        if (shouldText) {
          window.open(`sms:${worker.phoneNumber}?body=${encodeURIComponent(messageBody)}`, '_blank');
        }
      } else {
        window.alert(
          `New temporary password for ${displayName}: ${tempPassword}\n\n(No phone number on file for this worker -- copy this and relay it to them yourself.)`
        );
      }
    } catch (err) {
      console.error('Failed to set a new temporary password via the backend:', err);
      window.alert(
        `The request was approved, but a new password could not be set automatically.\n\n${
          err instanceof Error ? err.message : String(err)
        }\n\nMake sure the backend server is running (see backend/app.py) and has a Firebase service account key configured.`
      );
    } finally {
      setResettingId(null);
    }
  };

  useEffect(() => {
    if (!session) {
      setPasswordResetRequests([]);
      return;
    }

    const resetQuery = query(
      collection(db, COLLECTIONS.PASSWORD_RESET_REQUESTS),
      orderBy('requestedAt', 'desc'),
      limit(10),
    );
    return onSnapshot(
      resetQuery,
      (snapshot) => {
        setPasswordResetRequests(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const requestedAt = data.requestedAt as Timestamp | undefined;
            return {
              id: docSnap.id,
              email: String(data.email ?? ''),
              displayName: String(data.displayName ?? data.username ?? 'Worker'),
              role: String(data.role ?? ''),
              status: String(data.status ?? 'pending'),
              requestedAt: requestedAt?.toDate?.() ?? null,
            };
          }),
        );
      },
      () => setPasswordResetRequests([]),
    );
  }, [session]);

  const syncLabel =
    syncStatus === 'connected'
      ? 'Connected'
      : syncStatus === 'syncing'
        ? 'Syncing…'
        : syncStatus === 'loading'
          ? 'Loading…'
          : syncStatus === 'error'
            ? 'Error'
            : 'Offline';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              Website & System Settings
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Firebase Connected
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            System configuration, real-time Firebase sync settings, notification preferences, and account controls.
          </p>
        </div>
      </div>

      <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
        <Row
          icon={User}
          title="Account"
          subtitle={session ? `${session.displayName} · ${session.email}` : 'Not signed in'}
        >
          <Button type="button" variant="outline" className="border-border/80" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Row>
        <Row icon={Palette} title="Theme" subtitle="App uses Coffee / Light coffee — web preview toggle.">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Dark</span>
            <Switch checked={darkTheme} onCheckedChange={setDarkTheme} />
          </div>
        </Row>
        <Row
          icon={Bell}
          title="Notifications"
          subtitle={
            passwordResetRequests.filter((r) => r.status === 'pending').length > 0
              ? `${passwordResetRequests.filter((r) => r.status === 'pending').length} pending password reset request(s)`
              : 'Email and push-style alerts for harvest, equipment, and account access.'
          }
        >
          <Switch checked={pushOn} onCheckedChange={setPushOn} />
        </Row>
        <div id="password-reset-requests-section" className="rounded-xl bg-muted/40 border border-border/60 p-4 mb-2">
          <p className="text-sm font-medium text-foreground mb-3">Password Reset Requests (Worker Mobile App)</p>
          {passwordResetRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No password reset requests at this time.</p>
          ) : (
            <div className="space-y-2">
              {passwordResetRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-background/80 px-3 py-2 border border-border/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{request.displayName}</p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          request.status === 'pending'
                            ? 'bg-purple-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{request.email}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground sm:text-right">
                    <span>{request.requestedAt ? request.requestedAt.toLocaleString() : 'Just now'}</span>
                    {request.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resettingId === request.id}
                        className="text-xs h-7 px-2.5 border-purple-600/50 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 disabled:opacity-60"
                        onClick={() => void handleApproveResetRequest(request.id, request.email, request.displayName)}
                      >
                        <KeyRound className="w-3.5 h-3.5 mr-1" />
                        {resettingId === request.id ? 'Setting password…' : 'Approve'}
                      </Button>
                    )}
                    {request.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2.5 border-emerald-600/50 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        onClick={() => void handleResolveResetRequest(request.id)}
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Row
          icon={Cloud}
          title="Cloud sync"
          subtitle={
            lastUpdatedAt
              ? `Shared with Android · last update ${new Date(lastUpdatedAt).toLocaleString()}`
              : 'Live sync on app_state/farm (same database as the Android app)'
          }
        >
          <span
            className={`text-sm font-medium ${syncStatus === 'error' ? 'text-red-600' : 'text-[#2d5016]'}`}
          >
            {syncLabel}
          </span>
        </Row>
        {error && <p className="text-sm text-red-600 pt-2">{error}</p>}
        <Row icon={Lock} title="Security" subtitle="Administrator-only web portal; workers use the mobile app.">
          <span className="text-sm font-medium text-[#2d5016]">Admin session</span>
        </Row>
      </div>
    </div>
  );
}
