/** Mirrors Android [AuthManager] email / role rules. */

export type UserRole = 'ADMINISTRATOR' | 'FARM_STAFF';

export const KNOWN_ACCOUNTS = {
  ADMIN_EMAIL: 'farmacojido@gmail.com',
  WORKER_EMAIL: 'workerstaffacojido@gmail.com',
  LEGACY_STAFF_EMAIL: 'acojidostaff@coffeefarm.local',
  DEMO_WORKER_NAME: 'Juan Dela Cruz',
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
  return null;
}

