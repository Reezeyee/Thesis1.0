import type { LucideIcon } from 'lucide-react';
import { Bell, Cloud, Lock, Palette, User } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { Switch } from './ui/switch';
import { useAuth } from '../auth/AuthProvider';
import { useFarmData } from '../store/FarmDataProvider';
import { Button } from './ui/button';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';

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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 border-b border-[#4a2c2a]/10 last:border-0">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#2d5016]/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#2d5016]" />
        </div>
        <div>
          <p className="font-medium text-[#3e2723]">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function WebsiteSettingsPanel() {
  const { session, signOut } = useAuth();
  const { syncStatus, lastUpdatedAt, error } = useFarmData();
  const [darkTheme, setDarkTheme] = useState(false);
  const [pushOn, setPushOn] = useState(true);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);

  useEffect(() => {
    if (!session) {
      setPasswordResetRequests([]);
      return;
    }

    const resetQuery = query(
      collection(db, COLLECTIONS.PASSWORD_RESET_REQUESTS),
      orderBy('requestedAt', 'desc'),
      limit(5),
    );
    return onSnapshot(
      resetQuery,
      (snapshot) => {
        setPasswordResetRequests(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            const requestedAt = data.requestedAt as Timestamp | undefined;
            return {
              id: doc.id,
              email: String(data.email ?? ''),
              displayName: String(data.displayName ?? 'Worker'),
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
      <div>
        <h1>Settings</h1>
        <p className="text-muted-foreground">
          Web admin portal — synced with the Android app via Firebase ({' '}
          <span className="font-medium text-[#5d4037]">thesis-bbcde</span>).
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-[#4a2c2a]/10 shadow-sm">
        <Row
          icon={User}
          title="Account"
          subtitle={session ? `${session.displayName} · ${session.email}` : 'Not signed in'}
        >
          <Button type="button" variant="outline" className="border-[#4a2c2a]/30" onClick={() => void signOut()}>
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
            passwordResetRequests.length > 0
              ? `${passwordResetRequests.length} recent password reset request${passwordResetRequests.length === 1 ? '' : 's'}`
              : 'Email and push-style alerts for harvest, equipment, and account access.'
          }
        >
          <Switch checked={pushOn} onCheckedChange={setPushOn} />
        </Row>
        {passwordResetRequests.length > 0 ? (
          <div className="rounded-xl bg-[#f5f1ed] border border-[#4a2c2a]/10 p-4 mb-2">
            <p className="text-sm font-medium text-[#3e2723] mb-3">Password reset requests</p>
            <div className="space-y-2">
              {passwordResetRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg bg-white px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[#3e2723]">{request.displayName}</p>
                    <p className="text-xs text-muted-foreground">{request.email}</p>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <p>{request.status}</p>
                    <p>{request.requestedAt ? request.requestedAt.toLocaleString() : 'Just now'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
