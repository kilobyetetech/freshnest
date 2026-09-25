import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { logAudit } from "@/lib/firebase/auditServer";
import { FieldValue } from "firebase-admin/firestore";

type StaffRole = "admin" | "finance" | "staff" | "rider";
const VALID_ROLES: StaffRole[] = ["admin", "finance", "staff", "rider"];

/**
 * Admin-only. Same logic and compensating-rollback behavior as the
 * provisionStaffUser Cloud Function (functions/src/provisionStaffUser.ts)
 * — see admin.ts for why this runs as a Vercel API route instead for now.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing Authorization bearer token." }, { status: 401 });
  }

  const auth = adminAuth();
  const db = adminDb();

  let callerUid: string;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    callerUid = decoded.uid;
    if (decoded.role !== "admin") {
      return NextResponse.json(
        { error: "Only an Admin may provision staff accounts." },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid or expired ID token." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email;
  const phone: string | undefined = body?.phone;
  const displayName: string | undefined = body?.displayName;
  const role: StaffRole | undefined = body?.role;

  if (!email || !displayName || !role || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "email, displayName, and a valid role (admin|finance|staff|rider) are required." },
      { status: 400 }
    );
  }

  const existing = await auth
    .getUserByEmail(email)
    .then((u) => u)
    .catch((err: { code?: string }) => {
      if (err?.code === "auth/user-not-found") return null;
      throw err;
    });

  if (existing) {
    return NextResponse.json({ error: `A user with email ${email} already exists.` }, { status: 409 });
  }

  let uid: string;
  try {
    const userRecord = await auth.createUser({ email, phoneNumber: phone, displayName });
    uid = userRecord.uid;
  } catch (err) {
    return NextResponse.json(
      { error: `Auth user creation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  try {
    await auth.setCustomUserClaims(uid, { role });

    const batch = db.batch();
    batch.set(db.collection("users").doc(uid), {
      role,
      email,
      phone: phone ?? null,
      displayName,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    });

    if (role === "rider") {
      batch.set(db.collection("riders").doc(uid), {
        name: displayName,
        phone: phone ?? null,
        active: false,
        serviceAreaIds: [],
        workingHours: null,
        currentWorkload: 0,
        lastAssignedAt: null,
      });
    }

    await batch.commit();
  } catch {
    // Compensating rollback — same behavior as the Cloud Function version.
    let rollbackSucceeded = true;
    try {
      await auth.deleteUser(uid);
    } catch {
      rollbackSucceeded = false;
    }

    await logAudit(db, {
      actorId: callerUid,
      actorRole: "admin",
      action: rollbackSucceeded ? "provisionStaffUser.rolledBack" : "provisionStaffUser.rollbackFailed",
      resource: "users",
      resourceId: uid,
      previousState: null,
      newState: { attemptedRole: role, email },
    });

    return NextResponse.json(
      {
        error: rollbackSucceeded
          ? "Provisioning failed after the Auth account was created; it has been rolled back. Please retry."
          : `Provisioning failed and automatic rollback ALSO failed. Auth uid ${uid} is orphaned and requires manual cleanup.`,
      },
      { status: 500 }
    );
  }

  await logAudit(db, {
    actorId: callerUid,
    actorRole: "admin",
    action: "provisionStaffUser.success",
    resource: "users",
    resourceId: uid,
    previousState: null,
    newState: { role, email },
  });

  return NextResponse.json({ uid, role });
}
