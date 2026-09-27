import { NextRequest } from "next/server";
import { adminAuth } from "./admin";
import type { Role } from "@/types/models";

export interface VerifiedCaller {
  uid: string;
  role: Role | undefined;
}

/**
 * Verifies the Authorization: Bearer <idToken> header on an API route.
 * Returns null if there's no valid, verifiable token -- callers should
 * respond 401 in that case. This never trusts a client-supplied uid or
 * role; both come only from the verified token.
 */
export async function verifyCaller(req: NextRequest): Promise<VerifiedCaller | null> {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return null;

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, role: decoded.role as Role | undefined };
  } catch {
    return null;
  }
}
