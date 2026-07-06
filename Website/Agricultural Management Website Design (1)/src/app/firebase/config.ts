import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAeBRiMJ4tT8IalXFkPFzmuujBaQrQcUT4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'thesis-bbcde.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'thesis-bbcde',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'thesis-bbcde.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '293650785052',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:293650785052:web:acojido-admin',
};

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

export const auth = getAuth(getFirebaseApp());
export const db = getFirestore(getFirebaseApp());
