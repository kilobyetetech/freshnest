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

export async function logAudit(db: Firestore, entry: AuditEntry): Promise<void> {
  await db.collection("auditLogs").add({
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  });
}
