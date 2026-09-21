import { initializeApp, getApp, getApps } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';

const WORKER_AUTH_APP_NAME = 'worker-account-creator';
const WORKER_EMAIL_DOMAIN = 'acojidofarm.local';

export type CreatedWorkerAccount = {
  uid: string;
  email: string;
  password: string;
};

function workerAccountApp() {
  return getApps().some((app) => app.name === WORKER_AUTH_APP_NAME)
    ? getApp(WORKER_AUTH_APP_NAME)
    : initializeApp(firebaseConfig, WORKER_AUTH_APP_NAME);
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 32) || 'worker';
}

export function workerEmailFor(name: string, workerId: string): string {
  const normalizedId = workerId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${slugFromName(name)}.${normalizedId || crypto.randomUUID().slice(0, 8)}@${WORKER_EMAIL_DOMAIN}`;
}

export function generateWorkerPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  return `Cf${Array.from(values, (value) => chars[value % chars.length]).join('')}`;
}

export async function createWorkerAuthAccount(args: {
  name: string;
  workerId: string;
  role: string;
  email?: string;
  password?: string;
}): Promise<CreatedWorkerAccount> {
  const app = workerAccountApp();
  const secondaryAuth = getAuth(app);
  const email = args.email?.trim() || workerEmailFor(args.name, args.workerId);
  const password = args.password || generateWorkerPassword();

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = credential.user;
    try {
      // Written through the PRIMARY db (the signed-in admin), not the new worker's own session:
      // firestore.rules only lets an account create its own profile as a BUYER, so a FARM_STAFF
      // profile -- the role that unlocks farm-data writes -- must come from the admin.
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        email,
        displayName: args.name.trim(),
        role: 'FARM_STAFF',
        workerId: args.workerId,
        workerRole: args.role,
        mustChangePassword: true,
        isTemporaryPassword: true,
        createdAt: serverTimestamp(),
        source: 'web-admin-worker-form',
      });
    } catch (profileError) {
      // A login without a FARM_STAFF profile can't write farm data, and the form would still report
      // success. Undo the login (the secondary session is the new worker, so it may delete itself)
      // so the admin can simply retry with the same worker id instead of hitting "email already in use".
      const reason = profileError instanceof Error ? profileError.message : String(profileError);
      const removed = await user.delete().then(() => true, () => false);
      throw new Error(
        `The login was created but the worker profile could not be saved (${reason}). ` +
          (removed
            ? 'The login was removed, so nothing was left half-created. Please try again.'
            : `The login ${email} could not be removed automatically; delete it in Firebase Authentication before retrying.`),
      );
    }
    return { uid: user.uid, email, password };
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }
}
