import * as functionsV1 from "firebase-functions/v1";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * Fires on every new Firebase Auth account. Staff/Admin/Finance/Rider
 * accounts are created exclusively via provisionStaffUser (which sets
 * its own claim immediately after), so any account reaching this trigger
 * without already having a role claim is, by construction, a self-service
 * customer sign-up (email/password or phone/OTP — this trigger fires
 * identically for both, since Auth account creation is the same
 * underlying event either way).
 *
 * CLAIM-PROPAGATION NOTE: this trigger runs asynchronously after the
 * client's createUser/verifyOTP call resolves. The ID token the client
 * already holds from that call does NOT contain this claim yet. The
 * client must sign in (or force getIdToken(true)) to obtain a token that
 * includes it — see src/lib/auth/AuthProvider.tsx.
 */
export const onCustomerSignUp = functionsV1.auth.user().onCreate(async (user) => {
  const auth = getAuth();
  const db = getFirestore();

  // If a role claim is already present (shouldn't happen for a fresh
  // signup, but defensive in case of retried trigger delivery), don't
  // overwrite it.
  const existing = await auth.getUser(user.uid);
  if (existing.customClaims?.role) {
    return;
  }

  await auth.setCustomUserClaims(user.uid, { role: "customer" });

  const userRef = db.collection("users").doc(user.uid);
  const profileRef = db.collection("customerProfiles").doc(user.uid);

  const batch = db.batch();
  batch.set(
    userRef,
    {
      role: "customer",
      email: user.email ?? null,
      phone: user.phoneNumber ?? null,
      displayName: user.displayName ?? "",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    profileRef,
    {
      name: user.displayName ?? "",
      phone: user.phoneNumber ?? null,
      email: user.email ?? null,
      defaultAddressId: null,
      stats: { totalSpend: 0, avgOrderValue: 0, lastOrderAt: null },
      notes: "",
    },
    { merge: true }
  );
  await batch.commit();
});
