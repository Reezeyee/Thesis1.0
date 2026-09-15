import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS, SHARED_FARM_DOCUMENT_ID } from '../firebase/collections';
import {
  emptyAppState,
  mergeWorkerPrivateStates,
  normalizeAppState,
  projectPrivateFields,
  projectSharedFields,
  type AppState,
} from '../types/appState';
import { mergeRemoteStatePreservingLocalGrades } from './mergeFarmState';
import { groupPrivateFieldsByOwner, syncPrivateFieldsToCloud, syncToCloud, UNASSIGNED_OWNER_ID } from './syncToCloud';
import { useAuth } from '../auth/AuthProvider';

export type SyncStatus = 'loading' | 'connected' | 'syncing' | 'error' | 'offline';

type FarmDataContextValue = {
  state: AppState;
  loading: boolean;
  syncStatus: SyncStatus;
  lastUpdatedAt: number | null;
  error: string | null;
  saving: boolean;
  updateState: (updater: (prev: AppState) => AppState) => Promise<void>;
  refresh: () => void;
};

const FarmDataContext = createContext<FarmDataContextValue | null>(null);

function firebaseErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  const message = error instanceof Error ? error.message : 'Firebase sync failed.';

  if (code === 'permission-denied' || message.includes('Missing or insufficient permissions')) {
    return 'Firebase denied access to app_state/farm. Publish the project firestore.rules file, then sign in again.';
  }

  return message;
}

export function FarmDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>(emptyAppState);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stateRef = useRef(state);
  const lastUpdatedAtRef = useRef<number | null>(null);
  // Tracks the newest backend/wipe_farm_data.py or restore_farm_data_backup.py run this tab
  // has already applied. Those scripts write straight to Firestore, bypassing the app, and
  // stamp `hardReset` with the write's own timestamp so an already-open tab (holding
  // pre-wipe data in memory) can tell "the collection is genuinely empty because it was just
  // wiped" apart from "my own unsynced edits are ahead of a stale remote read" -- the ordinary
  // merge below can't distinguish those and would otherwise keep resurrecting the tab's stale
  // in-memory records as "extras to preserve" on every wipe/restore.
  const lastHardResetRef = useRef(0);
  const isSavingRef = useRef(false);

  // `state` is the shared farm doc (app_state/farm) merged with every worker's own private doc
  // (app_state/{uid}) -- see `firestore.rules` / `syncToCloud.ts` for why worker-submitted
  // records (attendance, leaveRequests, ...) live in per-worker docs instead of the shared one.
  const sharedStateRef = useRef<AppState>(emptyAppState());
  const privateStatesRef = useRef<Record<string, AppState>>({});

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    lastUpdatedAtRef.current = lastUpdatedAt;
  }, [lastUpdatedAt]);

  const recomputeState = useCallback(() => {
    const merged = mergeWorkerPrivateStates(sharedStateRef.current, privateStatesRef.current);
    setState(merged);
    stateRef.current = merged;
  }, []);

  // Shared farm doc: `app_state/farm`.
  useEffect(() => {
    if (!user) {
      sharedStateRef.current = emptyAppState();
      privateStatesRef.current = {};
      setState(emptyAppState());
      setLoading(false);
      setSyncStatus('offline');
      return;
    }

    setLoading(true);
    setSyncStatus('loading');
    const ref = doc(db, COLLECTIONS.APP_STATE, SHARED_FARM_DOCUMENT_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          sharedStateRef.current = emptyAppState();
          recomputeState();
          setLoading(false);
          setSyncStatus('connected');
          return;
        }
        const data = snap.data();
        const remoteUpdatedAt = (data.updatedAt as number) ?? 0;
        const json = data.stateJson as string | undefined;
        if (!json) {
          setLoading(false);
          setSyncStatus('connected');
          return;
        }
        try {
          const remote = projectSharedFields(normalizeAppState(JSON.parse(json) as Partial<AppState>));
          if (isSavingRef.current && remoteUpdatedAt <= (lastUpdatedAtRef.current ?? 0)) {
            return;
          }
          const remoteHardReset = (data.hardReset as number) ?? 0;
          const isFreshHardReset = remoteHardReset > lastHardResetRef.current;
          if (isFreshHardReset) {
            lastHardResetRef.current = remoteHardReset;
          }
          // A fresh hardReset marker means this snapshot is a wipe/restore write, not an
          // ordinary sync -- trust it as-is instead of merging, so a tab that was already open
          // before the wipe doesn't put its stale in-memory records back.
          const merged = isFreshHardReset
            ? remote
            : mergeRemoteStatePreservingLocalGrades(sharedStateRef.current, remote);
          sharedStateRef.current = projectSharedFields(merged);
          recomputeState();
          setLastUpdatedAt(remoteUpdatedAt);
          setError(null);
          setSyncStatus('connected');
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to parse farm data');
          setSyncStatus('error');
        }
        setLoading(false);
      },
      (err) => {
        setError(firebaseErrorMessage(err));
        setSyncStatus('error');
        setLoading(false);
      },
    );
    return unsub;
  }, [user, recomputeState]);

  // One listener per known worker's private doc (app_state/{authUid}), plus a fixed fallback
  // bucket (UNASSIGNED_OWNER_ID) for legacy private records that predate the owner-uid fields
  // and can't be matched to a worker by name -- see `syncToCloud.ownerUidFor`.
  const workerUidListKey = useMemo(() => {
    const uids = new Set<string>();
    for (const w of state.workers) {
      const uid = w.authUid?.trim();
      if (uid) uids.add(uid);
    }
    uids.add(UNASSIGNED_OWNER_ID);
    return Array.from(uids).sort().join(',');
  }, [state.workers]);

  useEffect(() => {
    if (!user) return;
    const uids = workerUidListKey ? workerUidListKey.split(',').filter(Boolean) : [];
    const unsubs = uids.map((uid) =>
      onSnapshot(
        doc(db, COLLECTIONS.APP_STATE, uid),
        (snap) => {
          if (!snap.exists()) {
            if (privateStatesRef.current[uid]) {
              const next = { ...privateStatesRef.current };
              delete next[uid];
              privateStatesRef.current = next;
              recomputeState();
            }
            return;
          }
          const json = snap.data().stateJson as string | undefined;
          if (!json) return;
          try {
            const remote = projectPrivateFields(normalizeAppState(JSON.parse(json) as Partial<AppState>));
            privateStatesRef.current = { ...privateStatesRef.current, [uid]: remote };
            recomputeState();
          } catch {
            /* ignore a corrupt worker doc; keep this worker's last-known-good private state */
          }
        },
        () => {
          /* one worker's private doc failing to load (e.g. mid-provisioning) shouldn't take
           * down the whole admin dashboard */
        },
      ),
    );
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, workerUidListKey, recomputeState]);

  const updateState = useCallback(async (updater: (prev: AppState) => AppState) => {
    if (!user) {
      throw new Error('You must be signed in to save changes.');
    }

    const prev = stateRef.current;
    const next = updater(prev);
    isSavingRef.current = true;
    setSaving(true);
    setSyncStatus('syncing');
    setError(null);

    try {
      const privateChanged =
        JSON.stringify(projectPrivateFields(next)) !== JSON.stringify(projectPrivateFields(prev));
      const written = await syncToCloud(next, prev);
      if (privateChanged) {
        await syncPrivateFieldsToCloud(written);
        // Apply optimistically so the UI reflects the edit immediately instead of waiting for
        // each affected worker's onSnapshot listener to round-trip through Firestore.
        privateStatesRef.current = { ...privateStatesRef.current, ...groupPrivateFieldsByOwner(written) };
      }
      sharedStateRef.current = projectSharedFields(written);
      recomputeState();
      setLastUpdatedAt(Date.now());
      setSyncStatus('connected');
    } catch (e) {
      const message = firebaseErrorMessage(e);
      setError(message);
      setSyncStatus('error');
      throw new Error(message);
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  }, [user, recomputeState]);

  const refresh = useCallback(() => {
    /* listeners keep data live */
  }, []);

  const value = useMemo(
    () => ({
      state,
      loading,
      syncStatus,
      lastUpdatedAt,
      error,
      saving,
      updateState,
      refresh,
    }),
    [state, loading, syncStatus, lastUpdatedAt, error, saving, updateState, refresh],
  );

  return <FarmDataContext.Provider value={value}>{children}</FarmDataContext.Provider>;
}

export function useFarmData() {
  const ctx = useContext(FarmDataContext);
  if (!ctx) throw new Error('useFarmData must be used within FarmDataProvider');
  return ctx;
}
