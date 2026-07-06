/** Mirrors Android [AuthManager] email / role rules. */

export type UserRole = 'ADMINISTRATOR' | 'FARM_STAFF';

export function usernameToEmail(username: string): string | null {
  const t = username.trim();
  if (t.includes('@')) {
    return t;
  }
  return null;
}
