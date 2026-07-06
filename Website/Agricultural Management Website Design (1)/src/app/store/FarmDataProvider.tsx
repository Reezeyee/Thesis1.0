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
  normalizeAppState,
  type AppState,
} from '../types/appState';
import { mergeRemoteStatePreservingLocalGrades } from './mergeFarmState';
import { syncToCloud } from './syncToCloud';
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
  const isSavingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    lastUpdatedAtRef.current = lastUpdatedAt;
  }, [lastUpdatedAt]);

  useEffect(() => {
    if (!user) {
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
          setState(emptyAppState());
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
          const remote = normalizeAppState(JSON.parse(json) as Partial<AppState>);
          if (isSavingRef.current && remoteUpdatedAt <= (lastUpdatedAtRef.current ?? 0)) {
            return;
          }
          const merged = mergeRemoteStatePreservingLocalGrades(stateRef.current, remote);
          setState(merged);
          stateRef.current = merged;
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
  }, [user]);

  const updateState = useCallback(async (updater: (prev: AppState) => AppState) => {
    if (!user) {
      throw new Error('You must be signed in to save changes.');
    }

    const next = updater(stateRef.current);
    isSavingRef.current = true;
    setSaving(true);
    setSyncStatus('syncing');
    setError(null);

    try {
      const written = await syncToCloud(next);
      stateRef.current = written;
      setState(written);
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
  }, [user]);

  const refresh = useCallback(() => {
    /* listener keeps data live */
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
