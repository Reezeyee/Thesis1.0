import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import {
  usernameToEmail,
  type UserRole,
} from './authConfig';

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
};

type AuthContextValue = {
  user: User | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadRole(uid: string, email: string): Promise<UserRole> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    const raw = snap.data()?.role as string | undefined;
    if (raw === 'ADMINISTRATOR' || raw === 'FARM_STAFF') {
      return raw as UserRole;
    }
  } catch (err) {
    console.error('Error loading user role from Firestore:', err);
  }
  return 'FARM_STAFF';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser?.email) {
        setSession(null);
        setLoading(false);
        return;
      }
      const role = await loadRole(firebaseUser.uid, firebaseUser.email);
      setSession({
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'Admin',
        role,
      });
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setError(null);
    const email = usernameToEmail(username);
    if (!email) {
      setError('Unknown username. Try admin, worker, or your full email.');
      throw new Error('invalid username');
    }
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ user, session, loading, error, signIn, signOut }),
    [user, session, loading, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRequireAdmin() {
  const { session, loading } = useAuth();
  const isAdmin = session?.role === 'ADMINISTRATOR';
  return { session, loading, allowed: isAdmin };
}
