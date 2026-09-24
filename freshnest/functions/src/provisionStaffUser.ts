import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logAudit } from "./lib/audit";

export type StaffRole = "admin" | "finance" | "staff" | "rider";

export interface ProvisionStaffUserInput {
  email: string;
  phone?: string;
  displayName: string;
  role: StaffRole;
}

const VALID_ROLES: StaffRole[] = ["admin", "finance", "staff", "rider"];

/**
 * Admin-only. Creates a Staff/Finance/Rider/Admin account.
 *
 * IMPORTANT (architecture correction #4): Firebase Auth and Firestore are
 * separate systems and cannot be written to as a single atomic
 * transaction. This Function therefore uses an explicit compensating-
 * operation sequence:
 *   1. Create the Auth user.
 *   2. Set the custom claim.
 *   3. Create the Firestore profile doc(s).
 * If step 2 or 3 fails after step 1 succeeded, we do not leave a silent,
 * claim-less orphaned Auth account. We attempt to delete the just-created
 * Auth user (compensating rollback), log the outcome either way, and
 * surface a clear failure to the caller — never a false "success".
 */
export const provisionStaffUser = onCall(
  async (request: CallableRequest<ProvisionStaffUserInput>) => {
    const callerRole = request.auth?.token?.role;
    if (!request.auth || callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only an Admin may provision staff accounts.");
    }

    const data = request.data;
    if (!data?.email || !data?.displayName || !VALID_ROLES.includes(data.role)) {
      throw new HttpsError(
        "invalid-argument",
        "email, displayName, and a valid role (admin|finance|staff|rider) are required."
      );
    }

    const auth = getAuth();
    const db = getFirestore();

    // Best-effort duplicate check up front; Auth itself is the final
    // authority on email uniqueness (createUser will also reject dupes).
    const existing = await auth
      .getUserByEmail(data.email)
      .then((u) => u)
      .catch((err: { code?: string }) => {
        if (err?.code === "auth/user-not-found") return null;
        throw new HttpsError("internal", "Failed to check for an existing user with this email.");
      });

    if (existing) {
      throw new HttpsError("already-exists", `A user with email ${data.email} already exists.`);
    }

    // Step 1: create the Auth user.
    let uid: string;
    try {
      const userRecord = await auth.createUser({
        email: data.email,
        phoneNumber: data.phone,
        displayName: data.displayName,
      });
      uid = userRecord.uid;
    } catch (err) {
      throw new HttpsError(
        "internal",
        `Auth user creation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Steps 2 + 3: claim + Firestore profile. Treated as a single
    // "logical" step for rollback purposes, but note these are still two
    // separate underlying writes (setCustomUserClaims, then a Firestore
    // batch) — not atomic with each other either. The batch is what
    // makes the Firestore portion atomic; the claim call before it is a
    // separate call that could itself succeed while the batch fails, or
    // vice versa, which is exactly why the whole sequence needs the
    // compensating rollback below rather than an atomicity claim.
    try {
      await auth.setCustomUserClaims(uid, { role: data.role });

      const batch = db.batch();
      const userRef = db.collection("users").doc(uid);
      batch.set(userRef, {
        role: data.role,
        email: data.email,
        phone: data.phone ?? null,
        displayName: data.displayName,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      });

      if (data.role === "rider") {
        const riderRef = db.collection("riders").doc(uid);
        batch.set(riderRef, {
          name: data.displayName,
          phone: data.phone ?? null,
          active: false,
          serviceAreaIds: [],
          workingHours: null,
          currentWorkload: 0,
          lastAssignedAt: null,
        });
      }

      await batch.commit();
    } catch (err) {
      // Compensating rollback.
      let rollbackSucceeded = true;
      try {
        await auth.deleteUser(uid);
      } catch {
        rollbackSucceeded = false;
      }

      await logAudit(db, {
        actorId: request.auth.uid,
        actorRole: "admin",
        action: rollbackSucceeded
          ? "provisionStaffUser.rolledBack"
          : "provisionStaffUser.rollbackFailed",
        resource: "users",
        resourceId: uid,
        previousState: null,
        newState: { attemptedRole: data.role, email: data.email },
      });

      throw new HttpsError(
        "internal",
        rollbackSucceeded
          ? "Provisioning failed after the Auth account was created; the Auth account has been rolled back. Please retry."
          : `Provisioning failed and automatic rollback ALSO failed. Auth uid ${uid} is orphaned and requires manual cleanup by an engineer.`
      );
    }

    await logAudit(db, {
      actorId: request.auth.uid,
      actorRole: "admin",
      action: "provisionStaffUser.success",
      resource: "users",
      resourceId: uid,
      previousState: null,
      newState: { role: data.role, email: data.email },
    });

    return { uid, role: data.role };
  }
);
