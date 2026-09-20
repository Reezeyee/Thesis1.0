/** Mirrors Android [AuthManager] email / role rules. */

export type UserRole = 'ADMINISTRATOR' | 'FARM_STAFF' | 'OWNER' | 'BUYER';

export const KNOWN_ACCOUNTS = {
  ADMIN_EMAIL: 'farmacojido@gmail.com',
  WORKER_EMAIL: 'workerstaffacojido@gmail.com',
  LEGACY_STAFF_EMAIL: 'acojidostaff@coffeefarm.local',
  DEMO_WORKER_NAME: 'Juan Dela Cruz',
  /** Read-only Owner account: sees profit/revenue only, no operational controls. */
  OWNER_EMAIL: 'acojidofarmowner@gmail.com',
};

export function usernameToEmail(username: string): string | null {
  const t = username.trim();
  if (t.includes('@')) {
    return t.toLowerCase();
  }
  const key = t.toLowerCase();
  if (key === 'admin' || key === 'acojidoadmin') {
    return KNOWN_ACCOUNTS.ADMIN_EMAIL;
  }
  if (key === 'worker' || key === 'workerstaff' || key === 'juan' || key === 'staff') {
    return KNOWN_ACCOUNTS.WORKER_EMAIL;
  }
  if (key === 'owner' || key === 'acojidoowner') {
    return KNOWN_ACCOUNTS.OWNER_EMAIL;
  }
  return null;
}


/**
 * Turns a caught Firebase Auth error into a message safe to show users. Callers must use the
 * error they caught -- AuthProvider's `error` state is stale inside the same `catch` block
 * (it was captured before the throw), which used to hide the real reason behind a generic fallback.
 */
export function authErrorMessage(err: unknown, fallback: string): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact the farm.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-api-key':
      return 'The site is misconfigured (invalid Firebase API key). Please contact the administrator.';
    default:
      return err instanceof Error && err.message && !code ? err.message : fallback;
  }
}

/** The two sign-in forms on the website. */
export type SignInPortal = 'staff' | 'buyer';

/**
 * Which accounts each sign-in form accepts. The Administrator form is for the farm side (admin, owner -- and
 * workers, who then see the "use the mobile app" screen); the buyer form is only for buyer accounts. Without
 * this, either form would sign in ANY account and just open whatever screen its role gets.
 */
export function portalAllowsRole(portal: SignInPortal, role: UserRole): boolean {
  return portal === 'buyer' ? role === 'BUYER' : role !== 'BUYER';
}

export const WRONG_PORTAL_MESSAGES: Record<SignInPortal, string> = {
  staff: 'This is a buyer account. Use "Shopping for coffee? Sign in or create a buyer account" at the bottom of this page.',
  buyer: 'This is a farm staff account, not a buyer account. Use the Administrator sign-in on the main page.',
};
