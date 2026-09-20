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
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';
import { isValidPhone11, PHONE_ERROR_MESSAGE, sanitizePhoneInput } from '../lib/phone';
import { isValidPersonName, NAME_ERROR_MESSAGE, normalizeName } from '../lib/personName';
import {
  portalAllowsRole,
  usernameToEmail,
  WRONG_PORTAL_MESSAGES,
  type SignInPortal,
  type UserRole,
} from './authConfig';

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  /**
   * Only meaningful for BUYER (the only self-registered role -- Admin/Owner/Farm Staff
   * accounts are provisioned directly in Firebase Console and are trusted regardless of
   * this flag). Gates access to the Buyer Storefront -- see BuyerVerifyEmailGate.
   */
  emailVerified: boolean;
};

type AuthContextValue = {
  user: User | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  /**
   * `portal` says which form is signing in. Each form only accepts its own kind of account (see
   * portalAllowsRole): a wrong-door account is signed straight back out with an error and never gets a session.
   * Without a portal (e.g. restoring a saved session) any account signs in and its role picks the screen.
   */
  signIn: (username: string, password: string, portal?: SignInPortal) => Promise<void>;
  /**
   * Buyer self-registration -- the only role in this app that creates its own account.
   * `location` is mandatory (enforced by BuyerAuthDialog before calling this) so the admin
   * website can always plot the buyer on the buyer locations map in Maintenance.
   */
  signUpAsBuyer: (
    email: string,
    password: string,
    displayName: string,
    location: { lat: number; lng: number; address: string },
    phone: string,
  ) => Promise<void>;
  /**
   * Standard self-service "forgot password" flow (panel feedback: the web app had no password
   * recovery at all). Accepts a raw email OR an Admin username shortcut (e.g. "admin"), resolved
   * the same way signIn resolves one, so the same field works on both the Admin and Buyer forms.
   * Firebase silently no-ops for an email with no account, so this never reveals which emails exist.
   */
  resetPassword: (usernameOrEmail: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-sends the verification link to the signed-in buyer's own email address. */
  resendVerificationEmail: () => Promise<void>;
  /** Firebase doesn't push emailVerified changes live -- re-fetches the user record and updates the session. */
  refreshEmailVerified: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadRole(uid: string, email: string): Promise<UserRole> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    const raw = snap.data()?.role as string | undefined;
    if (raw === 'ADMINISTRATOR' || raw === 'FARM_STAFF' || raw === 'OWNER' || raw === 'BUYER') {
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

  // Set while a portal-restricted sign-in is in flight, so the listener below doesn't open a session for an
  // account that signIn() is about to reject.
  const portalRef = useRef<SignInPortal | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const portal = portalRef.current;
      if (!firebaseUser?.email) {
        setUser(null);
        setSession(null);
        setLoading(false);
        return;
      }
      const role = await loadRole(firebaseUser.uid, firebaseUser.email);
      // Wrong door: signIn() reports it and signs the account out -- don't open a session for it. Also skip if
      // this account has already signed out while we were loading its role.
      if (portal && !portalAllowsRole(portal, role)) return;
      if (auth.currentUser?.uid !== firebaseUser.uid) return;
      setUser(firebaseUser);
      setSession({
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'Admin',
        role,
        emailVerified: firebaseUser.emailVerified,
      });
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async (username: string, password: string, portal?: SignInPortal) => {
    setError(null);
    const email = usernameToEmail(username);
    if (!email) {
      setError('Unknown username. Try admin, worker, or your full email.');
      throw new Error('Unknown username. Try admin, worker, or your full email.');
    }
    portalRef.current = portal ?? null;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (portal) {
        const role = await loadRole(credential.user.uid, email);
        if (!portalAllowsRole(portal, role)) {
          await firebaseSignOut(auth);
          setSession(null);
          setUser(null);
          setError(WRONG_PORTAL_MESSAGES[portal]);
          throw new Error(WRONG_PORTAL_MESSAGES[portal]);
        }
      }
    } finally {
      portalRef.current = null;
    }
  }, []);

  const resetPassword = useCallback(async (usernameOrEmail: string) => {
    setError(null);
    const trimmed = usernameOrEmail.trim();
    // Reuse the Admin-username shortcut resolver (e.g. "admin" -> farmacojido@gmail.com) when it
    // matches one; otherwise treat the input as a raw email address (the Buyer form always is).
    const email = usernameToEmail(trimmed) ?? (trimmed.includes('@') ? trimmed.toLowerCase() : null);
    if (!email) {
      setError('Enter your email address.');
      throw new Error('Enter your email address.');
    }
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
      throw err;
    }
  }, []);

  const signUpAsBuyer = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      location: { lat: number; lng: number; address: string },
      phone: string,
    ) => {
      setError(null);
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = normalizeName(displayName);
      const trimmedPhone = sanitizePhoneInput(phone);
      const trimmedAddress = location.address.trim();
      if (!trimmedEmail || !password || !trimmedName) {
        setError('Enter your name, email, and a password.');
        throw new Error('Enter your name, email, and a password.');
      }
      if (!isValidPersonName(trimmedName)) {
        setError(NAME_ERROR_MESSAGE);
        throw new Error(NAME_ERROR_MESSAGE);
      }
      if (!isValidPhone11(trimmedPhone)) {
        setError(PHONE_ERROR_MESSAGE);
        throw new Error(PHONE_ERROR_MESSAGE);
      }
      if (!trimmedAddress || (location.lat === 0 && location.lng === 0)) {
        setError('Set your business / pickup location on the map -- it is required.');
        throw new Error('Set your business / pickup location on the map -- it is required.');
      }
      try {
        const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(credential.user, { displayName: trimmedName });
        await setDoc(doc(db, COLLECTIONS.USERS, credential.user.uid), {
          email: trimmedEmail,
          displayName: trimmedName,
          role: 'BUYER',
          phone: trimmedPhone,
          createdAt: serverTimestamp(),
          locationLat: location.lat,
          locationLng: location.lng,
          locationAddress: trimmedAddress,
        });
        // Buyers are the only self-registered role, so their email is unverified by anyone
        // but them -- send the confirmation link now; BuyerVerifyEmailGate blocks the
        // storefront until they click it.
        await sendEmailVerification(credential.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create your account.');
        throw err;
      }
    },
    [],
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error('You must be signed in to resend a verification email.');
    }
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshEmailVerified = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setSession((prev) => (prev ? { ...prev, emailVerified: refreshed.emailVerified } : prev));
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      error,
      signIn,
      signUpAsBuyer,
      signOut,
      resendVerificationEmail,
      refreshEmailVerified,
      resetPassword,
    }),
    [
      user,
      session,
      loading,
      error,
      signIn,
      signUpAsBuyer,
      signOut,
      resendVerificationEmail,
      refreshEmailVerified,
      resetPassword,
    ],
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
