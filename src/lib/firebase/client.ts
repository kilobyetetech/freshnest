import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const isBrowser = typeof window !== "undefined";

// Client Firebase config is public, but the module is also evaluated while
// Next.js prerenders client components. Keep server prerendering from trying
// to initialize Auth with missing browser-only environment variables.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? (isBrowser ? "" : "server-prerender-placeholder"),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "server-prerender.invalid",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "server-prerender",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "server-prerender.invalid",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "server-prerender",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "server-prerender-placeholder",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Local development against the Firebase emulator suite.
if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true" && typeof window !== "undefined") {
  const w = window as unknown as { __FRESHNEST_EMULATORS_CONNECTED__?: boolean };
  if (!w.__FRESHNEST_EMULATORS_CONNECTED__) {
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFirestoreEmulator(db, "localhost", 8080);
    connectStorageEmulator(storage, "localhost", 9199);
    connectFunctionsEmulator(functions, "localhost", 5001);
    w.__FRESHNEST_EMULATORS_CONNECTED__ = true;
  }
}
