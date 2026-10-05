import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { Role } from "@/types/models";

export function isFinanceRole(role?: Role) {
  return role === "finance" || role === "admin";
}

export function auditFields(
  caller: { uid: string; role?: Role },
  action: string,
  target: string,
  targetId: string,
  reason?: string,
) {
  return {
    actorId: caller.uid,
    actorRole: caller.role ?? "unknown",
    action,
    target,
    targetId,
    reason: reason?.slice(0, 500) ?? null,
    timestamp: FieldValue.serverTimestamp(),
    source: "vercel-api",
  };
}

export function auditRef(db: Firestore) {
  return db.collection("auditLogs").doc();
}

export async function writeWalletCredit(
  db: Firestore,
  customerId: string,
  amount: number,
  input: { referenceType: string; referenceId: string; reason: string; caller: { uid: string; role?: Role } },
) {
  assertPositiveAmount(amount);
  const walletRef = db.collection("wallets").doc(customerId);
  const ledgerRef = walletRef.collection("ledger").doc(`credit_${input.referenceType}_${input.referenceId}`);
  return db.runTransaction(async (tx: Transaction) => {
    const walletSnap = await tx.get(walletRef);
    const ledgerSnap = await tx.get(ledgerRef);
    const balance = walletSnap.data()?.balance ?? 0;
    if (ledgerSnap.exists) return { id: ledgerRef.id, duplicate: true, balance };
    const nextBalance = balance + amount;
    tx.set(walletRef, { customerId, balance: nextBalance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(ledgerRef, {
      transactionId: ledgerRef.id,
      type: "Refund Credit",
      direction: "credit",
      amount,
      balanceBefore: balance,
      balanceAfter: nextBalance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      reason: input.reason.slice(0, 500),
      createdByUid: input.caller.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(auditRef(db), auditFields(input.caller, "wallet.credit", "wallets", customerId, input.reason));
    return { id: ledgerRef.id, duplicate: false, balance: nextBalance };
  });
}

export async function writeWalletDebit(
  db: Firestore,
  customerId: string,
  amount: number,
  input: { referenceType: string; referenceId: string; reason: string; caller: { uid: string; role?: Role } },
) {
  assertPositiveAmount(amount);
  const walletRef = db.collection("wallets").doc(customerId);
  const ledgerRef = walletRef.collection("ledger").doc(`debit_${input.referenceType}_${input.referenceId}`);
  return db.runTransaction(async (tx: Transaction) => {
    const walletSnap = await tx.get(walletRef);
    const ledgerSnap = await tx.get(ledgerRef);
    const balance = walletSnap.data()?.balance ?? 0;
    if (ledgerSnap.exists) return { id: ledgerRef.id, duplicate: true, balance };
    if (balance < amount) throw new Error("Wallet balance cannot become negative.");
    const nextBalance = balance - amount;
    tx.set(walletRef, { customerId, balance: nextBalance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(ledgerRef, {
      transactionId: ledgerRef.id,
      type: "Wallet Debit",
      direction: "debit",
      amount,
      balanceBefore: balance,
      balanceAfter: nextBalance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      reason: input.reason.slice(0, 500),
      createdByUid: input.caller.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.create(auditRef(db), auditFields(input.caller, "wallet.debit", "wallets", customerId, input.reason));
    return { id: ledgerRef.id, duplicate: false, balance: nextBalance };
  });
}

export function monthBounds(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Period must use YYYY-MM format.");
  const [year, month] = period.split("-").map(Number);
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

export function asDate(value: unknown) {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate();
  return value instanceof Date ? value : new Date(0);
}

export function toMoney(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function assertFinance(role?: Role) {
  if (!isFinanceRole(role)) throw new Error("Only Finance or Admin may perform this operation.");
}

export function requireReason(reason: unknown) {
  if (typeof reason !== "string" || reason.trim().length < 3) throw new Error("A reason is required.");
  return reason.trim().slice(0, 500);
}

export function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function assertPositiveAmount(value: unknown): asserts value is number {
  if (!isPositiveAmount(value)) throw new Error("Wallet amount must be a positive whole number.");
}
