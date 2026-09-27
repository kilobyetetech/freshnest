import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-only. Never import this from a "use client" file or ship it to
 * the browser bundle — it holds a service account private key.
 *
 * TEMPORARY ARCHITECTURE NOTE: the finalized architecture specifies this
 * logic as Cloud Functions running on Firebase. Cloud Functions require
 * the Blaze billing plan, which isn't available yet (no card on the
 * account). As a documented, temporary substitution, the exact same
 * Admin-SDK logic instead runs here, as Vercel serverless API routes.
 * The security properties are identical: server-side only, never
 * client-trusted, same compensating-rollback and audit-log behavior.
 * When Blaze becomes available, this logic can move back to
 * functions/src/*.ts largely unchanged — same functions, different
 * transport (onCall -> POST handler).
 */
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Vercel env vars store literal "\n" in multi-line values; convert back.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in Vercel's " +
        "Environment Variables (Project Settings -> Environment Variables)."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
