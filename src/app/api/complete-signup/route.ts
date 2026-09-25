import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Called by the client immediately after createUserWithEmailAndPassword
 * or a successful Google signInWithPopup. Sets the default "customer"
 * role claim and creates the users/customerProfiles docs — the same
 * work the onCustomerSignUp Cloud Function trigger did, just invoked
 * explicitly from the client right after account creation instead of
 * firing automatically on the Auth event (Auth triggers require Cloud
 * Functions, which require Blaze — see admin.ts for the full note).
 *
 * Idempotent: if the caller already has a role claim (including from a
 * retried call, or an account provisioned via provision-staff-user),
 * this is a no-op rather than overwriting it.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing Authorization bearer token." }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired ID token." }, { status: 401 });
  }

  const uid = decoded.uid;
  const auth = adminAuth();
  const db = adminDb();

  const userRecord = await auth.getUser(uid);
  if (userRecord.customClaims?.role) {
    // Already provisioned (e.g. a staff account, or a retried call) —
    // don't overwrite an existing role.
    return NextResponse.json({ uid, role: userRecord.customClaims.role, alreadyProvisioned: true });
  }

  await auth.setCustomUserClaims(uid, { role: "customer" });

  const userRef = db.collection("users").doc(uid);
  const profileRef = db.collection("customerProfiles").doc(uid);
  const batch = db.batch();
  batch.set(
    userRef,
    {
      role: "customer",
      email: userRecord.email ?? null,
      phone: userRecord.phoneNumber ?? null,
      displayName: userRecord.displayName ?? "",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    profileRef,
    {
      name: userRecord.displayName ?? "",
      phone: userRecord.phoneNumber ?? null,
      email: userRecord.email ?? null,
      defaultAddressId: null,
      stats: { totalSpend: 0, avgOrderValue: 0, lastOrderAt: null },
      notes: "",
    },
    { merge: true }
  );
  await batch.commit();

  return NextResponse.json({ uid, role: "customer", alreadyProvisioned: false });
}
