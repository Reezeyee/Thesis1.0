import { initializeApp, getApp, getApps } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config';
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
  const secondaryDb = getFirestore(app);
  const email = args.email?.trim() || workerEmailFor(args.name, args.workerId);
  const password = args.password || generateWorkerPassword();

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = credential.user;
    await setDoc(doc(secondaryDb, COLLECTIONS.USERS, user.uid), {
      email,
      displayName: args.name.trim(),
      role: 'FARM_STAFF',
      workerId: args.workerId,
      workerRole: args.role,
      createdAt: serverTimestamp(),
      source: 'web-admin-worker-form',
    }).catch(() => undefined);
    return { uid: user.uid, email, password };
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }
}
