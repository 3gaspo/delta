import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  // @ts-ignore
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // @ts-ignore
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // @ts-ignore
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // @ts-ignore
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  // @ts-ignore
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  // @ts-ignore
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady =
  // @ts-ignore
  !!import.meta.env.VITE_FIREBASE_API_KEY &&
  // @ts-ignore
  !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  // @ts-ignore
  !!import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  // @ts-ignore
  !!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET &&
  // @ts-ignore
  !!import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
  // @ts-ignore
  !!import.meta.env.VITE_FIREBASE_APP_ID;

let app;
if (firebaseReady && getApps().length === 0) {
  app = initializeApp(firebaseConfig);
}

export const auth = firebaseReady ? getAuth(app) : null;
export const db = firebaseReady ? getFirestore(app) : null;
