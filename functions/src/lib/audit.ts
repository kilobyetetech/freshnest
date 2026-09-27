import { Firestore, FieldValue } from "firebase-admin/firestore";

export interface AuditEntry {
  actorId: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId: string;
  previousState: unknown;
  newState: unknown;
}

/**
 * Writes an audit log entry. auditLogs is Function-only in the security
 * rules (no client read/write path exists at all), so this is the sole
 * path by which entries are ever created.
 */
export async function logAudit(db: Firestore, entry: AuditEntry): Promise<void> {
  await db.collection("auditLogs").add({
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  });
}
