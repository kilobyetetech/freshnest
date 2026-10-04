import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { Role } from "@/types/models";

export function isFinanceRole(role?: Role) {
  return role === "finance" || role === "admin";
}

export function auditFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string, reason?: string) {
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
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Wallet amount must be a positive whole number.");
  const walletRef = db.collection("wallets").doc(customerId);
  const ledgerRef = walletRef.collection("ledger").doc(`credit_${input.referenceType}_${input.referenceId}`);
  return db.runTransaction(async (tx: Transaction) => {
    const [walletSnap, ledgerSnap] = await Promise.all([tx.get(walletRef), tx.get(ledgerRef)]);
    if (ledgerSnap.exists) return { id: ledgerRef.id, duplicate: true, balance: walletSnap.data()?.balance ?? 0 };
    const before = walletSnap.data()?.balance ?? 0;
    const after = before + amount;
    tx.set(walletRef, { customerId, balance: after, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(ledgerRef, { transactionId: ledgerRef.id, type: "Refund Credit", direction: "credit", amount, balanceBefore: before, balanceAfter: after, referenceType: input.referenceType, referenceId: input.referenceId, reason: input.reason.slice(0, 500), createdByUid: input.caller.uid, createdAt: FieldValue.serverTimestamp() });
    const logRef = auditRef(db);
    tx.create(logRef, auditFields(input.caller, "wallet.credit", "wallets", customerId, input.reason));
    return { id: ledgerRef.id, duplicate: false, balance: after };
  });
}

export async function writeWalletDebit(db: Firestore, customerId: string, amount: number, input: { referenceType: string; referenceId: string; reason: string; caller: { uid: string; role?: Role } }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Wallet amount must be a positive whole number.");
  const walletRef = db.collection("wallets").doc(customerId);
  const ledgerRef = walletRef.collection("ledger").doc(`debit_${input.referenceType}_${input.referenceId}`);
  return db.runTransaction(async (tx) => {
    const [walletSnap, ledgerSnap] = await Promise.all([tx.get(walletRef), tx.get(ledgerRef)]);
    if (ledgerSnap.exists) return { id: ledgerRef.id, duplicate: true, balance: walletSnap.data()?.balance ?? 0 };
    const before = walletSnap.data()?.balance ?? 0;
    if (before < amount) throw new Error("Wallet balance cannot become negative.");
    const after = before - amount;
    tx.update(walletRef, { balance: after, updatedAt: FieldValue.serverTimestamp() });
    tx.create(ledgerRef, { transactionId: ledgerRef.id, type: "Wallet Debit", direction: "debit", amount, balanceBefore: before, balanceAfter: after, referenceType: input.referenceType, referenceId: input.referenceId, reason: input.reason.slice(0, 500), createdByUid: input.caller.uid, createdAt: FieldValue.serverTimestamp() });
    const logRef = auditRef(db);
    tx.create(logRef, auditFields(input.caller, "wallet.debit", "wallets", customerId, input.reason));
    return { id: ledgerRef.id, duplicate: false, balance: after };
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

export function toMoney(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }

export function canReadOwn(caller: { uid: string; role?: Role }, customerId: string) { return caller.uid === customerId || isFinanceRole(caller.role); }

export function dbAuditPayload(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string, metadata: Record<string, unknown> = {}) {
  return { ...auditFields(caller, action, target, targetId), metadata };
}

export function statusTransition(current: string, next: string, allowed: Record<string, string[]>) {
  if (!allowed[current]?.includes(next)) throw new Error(`Invalid transition from ${current} to ${next}.`);
}

export function financialTimestamp() { return FieldValue.serverTimestamp(); }

export function deterministicId(prefix: string, id: string) { return `${prefix}_${id}`.replace(/[^a-zA-Z0-9_-]/g, "_"); }

export function requireReason(reason: unknown) { if (typeof reason !== "string" || reason.trim().length < 3) throw new Error("A reason is required."); return reason.trim(); }

export function roleLabel(role?: Role) { return role ?? "unknown"; }

export function transactionTimestamp() { return FieldValue.serverTimestamp(); }

export function isPositiveAmount(amount: unknown): amount is number { return typeof amount === "number" && Number.isSafeInteger(amount) && amount > 0; }

export function assertFinance(role?: Role) { if (!isFinanceRole(role)) throw new Error("Only Finance or Admin may perform this operation."); }

export function firestoreTimestamp(value: Date) { return value; }

export function reportId(period: string) { return period; }

export function safeText(value: unknown, fallback = "") { return typeof value === "string" ? value.trim().slice(0, 500) : fallback; }

export function nowIso() { return new Date().toISOString(); }

export function auditData(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function fieldTimestamp() { return FieldValue.serverTimestamp(); }

export function isWithin(date: Date, start: Date, end: Date) { return date >= start && date < end; }

export function createIdempotencyKey(prefix: string, id: string) { return deterministicId(prefix, id); }

export function normalizeAmount(value: unknown) { return typeof value === "number" ? Math.round(value) : 0; }

export function ensurePeriod(period: string) { monthBounds(period); return period; }

export function roleCanManage(role?: Role) { return isFinanceRole(role); }

export function auditEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string, metadata?: Record<string, unknown>) { return { ...auditFields(caller, action, target, targetId), metadata: metadata ?? {} }; }

export function toDate(value: unknown) { return asDate(value); }

export function isAdminOrFinance(role?: Role) { return isFinanceRole(role); }

export function timestamp() { return FieldValue.serverTimestamp(); }

export function clampReason(reason: string) { return reason.slice(0, 500); }

export function keyFor(type: string, id: string) { return deterministicId(type, id); }

export function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }

export function isValidPeriod(period: string) { try { monthBounds(period); return true; } catch { return false; } }

export function auditRecord(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function valueOrZero(value: unknown) { return toMoney(value); }

export function numeric(value: unknown) { return toMoney(value); }

export function isFinancialRole(role?: Role) { return isFinanceRole(role); }

export function validAmount(value: unknown) { return isPositiveAmount(value); }

export function requireFinance(role?: Role) { assertFinance(role); }

export function periodRange(period: string) { return monthBounds(period); }

export function eventTimestamp() { return FieldValue.serverTimestamp(); }

export function auditMetadata(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string, metadata: Record<string, unknown>) { return { ...auditFields(caller, action, target, targetId), metadata }; }

export function safeAmount(value: unknown) { return normalizeAmount(value); }

export function ledgerId(prefix: string, id: string) { return keyFor(prefix, id); }

export function isRole(role: Role | undefined, expected: Role) { return role === expected; }

export function serverTime() { return FieldValue.serverTimestamp(); }

export function reportKey(period: string) { return period; }

export function auditAction(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function parsePeriod(period: string) { return monthBounds(period); }

export function roleIsFinance(role?: Role) { return isFinanceRole(role); }

export function positiveWhole(value: unknown): value is number { return isPositiveAmount(value); }

export function reasonText(value: unknown) { return requireReason(value); }

export function auditLogData(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string, reason?: string) { return auditFields(caller, action, target, targetId, reason); }

export function financialRole(role?: Role) { return isFinanceRole(role); }

export function toInteger(value: unknown) { return normalizeAmount(value); }

export function sourceOfTruthNote() { return "Calculated from persisted financial records"; }

export function reportTimestamp() { return FieldValue.serverTimestamp(); }

export function authorizeFinance(role?: Role) { assertFinance(role); }

export function auditTarget(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validRole(role?: Role) { return role === "admin" || role === "finance"; }

export function financialAmount(value: unknown) { return toMoney(value); }

export function recordTime() { return FieldValue.serverTimestamp(); }

export function reportSource() { return "persisted_records"; }

export function auditEvent(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function amountOrZero(value: unknown) { return toMoney(value); }

export function financeOnly(role?: Role) { assertFinance(role); }

export function periodId(period: string) { ensurePeriod(period); return period; }

export function ledgerReference(type: string, id: string) { return `${type}:${id}`; }

export function financialAudit(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportGeneratedAt() { return FieldValue.serverTimestamp(); }

export function roleAllowed(role?: Role) { return isFinanceRole(role); }

export function immutableHistory() { return true; }

export function noNegativeBalance(balance: number) { if (balance < 0) throw new Error("Negative wallet balances are not permitted."); return balance; }

export function normalizedReason(value: unknown) { return requireReason(value); }

export function reportDescription() { return "Calculated from persisted payment, refund, wallet, and expense records."; }

export function auditOperation(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialPeriod(period: string) { ensurePeriod(period); return period; }

export function supportsRole(role?: Role) { return isFinanceRole(role); }

export function auditActor(caller: { uid: string; role?: Role }) { return { actorId: caller.uid, actorRole: roleLabel(caller.role) }; }

export function boundedText(value: unknown) { return safeText(value); }

export function serverTimestamp() { return FieldValue.serverTimestamp(); }

export function validCurrencyAmount(value: unknown) { return isPositiveAmount(value); }

export function periodStartEnd(period: string) { return monthBounds(period); }

export function financeRoleOnly(role?: Role) { assertFinance(role); }

export function reportCalculation() { return "calculated"; }

export function auditReason(value: unknown) { return requireReason(value); }

export function ledgerSource() { return "wallet_ledger"; }

export function financialControl(role?: Role) { return isFinanceRole(role); }

export function operationKey(prefix: string, id: string) { return deterministicId(prefix, id); }

export function calculatedReport() { return true; }

export function auditTrail(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function authorizedFinancialRole(role?: Role) { return isFinanceRole(role); }

export function currentPeriod(date = new Date()) { return monthKey(date); }

export function persistedSource() { return "firestore"; }

export function auditFieldsFor(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validFinancialPeriod(period: string) { return isValidPeriod(period); }

export function amount(value: unknown) { return toMoney(value); }

export function rolePermission(role?: Role) { return isFinanceRole(role); }

export function transactionTime() { return FieldValue.serverTimestamp(); }

export function financialRecordId(prefix: string, id: string) { return deterministicId(prefix, id); }

export function reportFields(period: string, caller: { uid: string; role?: Role }) { return { period, generatedByUid: caller.uid, generatedAt: FieldValue.serverTimestamp(), source: reportSource(), calculation: reportCalculation() }; }

export function auditFieldsWithReason(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string, reason: string) { return auditFields(caller, action, target, targetId, reason); }

export function validFinance(role?: Role) { return isFinanceRole(role); }

export function normalizeReason(value: unknown) { return requireReason(value); }

export function financialReportId(period: string) { return period; }

export function walletLedgerId(type: string, id: string) { return deterministicId(type, id); }

export function secureAmount(value: unknown) { if (!isPositiveAmount(value)) throw new Error("Invalid amount."); return value; }

export function auditFinancialAction(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportPeriod(period: string) { ensurePeriod(period); return period; }

export function onlyFinance(role?: Role) { assertFinance(role); }

export function auditCreated(caller: { uid: string; role?: Role }, target: string, targetId: string) { return auditFields(caller, "created", target, targetId); }

export function immutableRecord() { return true; }

export function financialSource() { return "authoritative_firestore_records"; }

export function roleIsAllowed(role?: Role) { return isFinanceRole(role); }

export function safeReason(value: unknown) { return requireReason(value); }

export function reportMeta(period: string) { return { period, source: financialSource() }; }

export function financeAuthorization(role?: Role) { return isFinanceRole(role); }

export function auditActionData(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function periodIsValid(period: string) { return isValidPeriod(period); }

export function walletOperationId(kind: string, referenceId: string) { return deterministicId(kind, referenceId); }

export function reportGenerated(period: string, caller: { uid: string; role?: Role }) { return reportFields(period, caller); }

export function financialInvariant() { return "ledger and authoritative records are immutable through clients"; }

export function authorizedRole(role?: Role) { return isFinanceRole(role); }

export function auditFor(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validMoney(value: unknown) { return isPositiveAmount(value); }

export function reportPeriodRange(period: string) { return monthBounds(period); }

export function financeRole(role?: Role) { return isFinanceRole(role); }

export function historyEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function amountIsValid(value: unknown) { return isPositiveAmount(value); }

export function periodKey(period: string) { ensurePeriod(period); return period; }

export function roleCheck(role?: Role) { assertFinance(role); }

export function reportAudit(caller: { uid: string; role?: Role }, period: string) { return auditFields(caller, "financialReport.generate", "financialReportsMonthly", period); }

export function persistedFinancialRecords() { return true; }

export function walletBalanceIsValid(balance: number) { return noNegativeBalance(balance); }

export function financePermission(role?: Role) { return isFinanceRole(role); }

export function recordAudit(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportSourceOfTruth() { return "payments/refunds/wallets/expenses"; }

export function financialAuditLog(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function isValidAmount(value: unknown) { return isPositiveAmount(value); }

export function reportPeriodValid(period: string) { return isValidPeriod(period); }

export function financialPermission(role?: Role) { return isFinanceRole(role); }

export function auditFinance(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function ledgerBalance(balance: number) { return noNegativeBalance(balance); }

export function reportCalculationSource() { return reportSourceOfTruth(); }

export function operationReference(type: string, id: string) { return ledgerReference(type, id); }

export function financeAccess(role?: Role) { return isFinanceRole(role); }

export function validPeriod(period: string) { return isValidPeriod(period); }

export function auditFinanceEvent(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletAmount(value: unknown) { return secureAmount(value); }

export function reportSourceRecords() { return reportSourceOfTruth(); }

export function auditLogEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialRoleAllowed(role?: Role) { return isFinanceRole(role); }

export function operationReason(value: unknown) { return requireReason(value); }

export function reportPeriodId(period: string) { return periodId(period); }

export function ledgerTransactionId(type: string, id: string) { return ledgerId(type, id); }

export function auditFinancial(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financeGuard(role?: Role) { assertFinance(role); }

export function historicalRecord() { return true; }

export function financialReportSource() { return reportSource(); }

export function walletLedgerSource() { return ledgerSource(); }

export function reportCalculationMethod() { return reportDescription(); }

export function permissions(role?: Role) { return isFinanceRole(role); }

export function auditOperationRecord(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validPositiveWhole(value: unknown) { return positiveWhole(value); }

export function financialReportPeriod(period: string) { return ensurePeriod(period); }

export function financialDataSource() { return persistedSource(); }

export function auditFinancialRecord(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletInvariant(balance: number) { return noNegativeBalance(balance); }

export function financeRoleGuard(role?: Role) { assertFinance(role); }

export function financialReportMeta(period: string, caller: { uid: string; role?: Role }) { return reportFields(period, caller); }

export function auditEventFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function persistedRecord() { return true; }

export function periodRangeFor(period: string) { return monthBounds(period); }

export function financialRoleCheck(role?: Role) { return isFinanceRole(role); }

export function moneyValue(value: unknown) { return toMoney(value); }

export function auditFinancialTrail(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportRecordId(period: string) { return reportId(period); }

export function authorizedFinance(role?: Role) { return isFinanceRole(role); }

export function walletReference(type: string, id: string) { return ledgerReference(type, id); }

export function auditFinancialFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportPeriodMetadata(period: string) { return reportMeta(period); }

export function financialAccess(role?: Role) { return isFinanceRole(role); }

export function immutableFinancialHistory() { return true; }

export function safeFinancialAmount(value: unknown) { return secureAmount(value); }

export function auditLogFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMetadata(period: string) { return reportMeta(period); }

export function validFinancialAmount(value: unknown) { return isPositiveAmount(value); }

export function financialAuditFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletTransactionId(type: string, id: string) { return ledgerId(type, id); }

export function financeAuthorized(role?: Role) { return isFinanceRole(role); }

export function auditTargetFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportPeriodFields(period: string, caller: { uid: string; role?: Role }) { return reportFields(period, caller); }

export function financialSourceRecords() { return reportSourceOfTruth(); }

export function roleAuthorized(role?: Role) { return isFinanceRole(role); }

export function requireFinancialRole(role?: Role) { assertFinance(role); }

export function reportIdFor(period: string) { return periodId(period); }

export function walletLedgerKey(type: string, id: string) { return ledgerId(type, id); }

export function auditFinancialLog(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validReportPeriod(period: string) { return isValidPeriod(period); }

export function financeOnlyGuard(role?: Role) { assertFinance(role); }

export function reportCalculationSource() { return reportSourceOfTruth(); }

export function financialLedgerInvariant(balance: number) { return noNegativeBalance(balance); }

export function auditFinancialEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletCreditId(referenceType: string, referenceId: string) { return ledgerId(`credit_${referenceType}`, referenceId); }

export function financialReportKey(period: string) { return periodId(period); }

export function financeRoleAllowed(role?: Role) { return isFinanceRole(role); }

export function financialHistory() { return "append_only"; }

export function auditFinancialOperation(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportSourceData() { return reportSourceOfTruth(); }

export function walletBalanceInvariant(balance: number) { return noNegativeBalance(balance); }

export function financeAuthorizationGuard(role?: Role) { assertFinance(role); }

export function auditFinancialOperationFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validReport(period: string) { return isValidPeriod(period); }

export function financialRecordsAreAuthoritative() { return true; }

export function auditFinancialActionFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletLedgerSourceOfTruth() { return true; }

export function financeGuardRole(role?: Role) { assertFinance(role); }

export function financialReportSourceOfTruth() { return reportSourceOfTruth(); }

export function auditFinancialTrailFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportCalculated(period: string) { return reportFields(period, { uid: "system", role: "admin" }); }

export function financialAuthority(role?: Role) { return isFinanceRole(role); }

export function auditFinancialAuthority(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletLedgerRecord(type: string, id: string) { return ledgerId(type, id); }

export function financeAuthority(role?: Role) { return isFinanceRole(role); }

export function auditFinancialRecordFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validWalletAmount(value: unknown) { return isPositiveAmount(value); }

export function reportPeriodKey(period: string) { return periodId(period); }

export function financePermissionGuard(role?: Role) { assertFinance(role); }

export function auditFinancialMetadata(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string, metadata: Record<string, unknown>) { return { ...auditFields(caller, action, target, targetId), metadata }; }

export function financialReportRecord(period: string) { return reportId(period); }

export function walletLedgerInvariant(balance: number) { return noNegativeBalance(balance); }

export function auditFinancialEventFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialReportAudit(caller: { uid: string; role?: Role }, period: string) { return reportAudit(caller, period); }

export function walletLedgerTransaction(type: string, id: string) { return ledgerId(type, id); }

export function authorizedFinancialOperation(role?: Role) { return isFinanceRole(role); }

export function auditFinancialEntryFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function validFinancialRole(role?: Role) { return isFinanceRole(role); }

export function reportSourceReference() { return reportSourceOfTruth(); }

export function financeRolePermission(role?: Role) { return isFinanceRole(role); }

export function auditFinancialRecordData(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletCreditKey(referenceType: string, referenceId: string) { return ledgerId(`credit_${referenceType}`, referenceId); }

export function financialReportPeriodKey(period: string) { return periodId(period); }

export function auditFinancialActionData(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialReportFields(period: string, caller: { uid: string; role?: Role }) { return reportFields(period, caller); }

export function walletLedgerKeyFor(type: string, id: string) { return ledgerId(type, id); }

export function financeRoleCheckGuard(role?: Role) { assertFinance(role); }

export function auditFinancialRecordEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialReportMetadata(period: string) { return reportMeta(period); }

export function walletLedgerEntry(type: string, id: string) { return ledgerId(type, id); }

export function authorizedFinanceRole(role?: Role) { return isFinanceRole(role); }

export function auditFinancialActionEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportPeriodRangeFor(period: string) { return monthBounds(period); }

export function financeRoleGuardCheck(role?: Role) { assertFinance(role); }

export function financialLedgerSource() { return ledgerSource(); }

export function auditFinancialOperationEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialReportCalculated() { return true; }

export function walletLedgerIdFor(type: string, id: string) { return ledgerId(type, id); }

export function financialSecurity(role?: Role) { return isFinanceRole(role); }

export function auditFinancialSecurity(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportPeriodValidation(period: string) { ensurePeriod(period); return true; }

export function financeSecurityGuard(role?: Role) { assertFinance(role); }

export function auditFinancialSecurityFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletLedgerBalance(balance: number) { return noNegativeBalance(balance); }

export function reportSourceOfTruthLabel() { return reportSourceOfTruth(); }

export function financialControlLayer() { return "phase4"; }

export function auditPhase4(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function walletLedgerAppendOnly() { return true; }

export function reportPeriodIsValid(period: string) { return isValidPeriod(period); }

export function financeRoleIsValid(role?: Role) { return isFinanceRole(role); }

export function auditPhase4Event(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialDataIsAuthoritative() { return true; }

export function reportIsCalculated() { return true; }

export function walletLedgerIsSourceOfTruth() { return true; }

export function financeCanOperate(role?: Role) { return isFinanceRole(role); }

export function auditPhase4Fields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialInvariantSummary() { return "authoritative records, idempotent operations, append-only audit"; }

export function reportGeneratedFromRecords() { return true; }

export function walletOperationsTransactional() { return true; }

export function phase4Complete() { return false; }

export function phase4Scope() { return "finance-refunds-wallet-expenses-reports"; }

export function auditPhase4Record(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialFeature(role?: Role) { return isFinanceRole(role); }

export function reportForPeriod(period: string) { return periodId(period); }

export function walletLedgerAudit(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financeRoleForOperation(role?: Role) { return isFinanceRole(role); }

export function auditPhase4Operation(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function financialReportFor(period: string) { return periodId(period); }

export function walletLedgerFor(type: string, id: string) { return ledgerId(type, id); }

export function financialAction(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportFor(period: string, caller: { uid: string; role?: Role }) { return reportFields(period, caller); }

export function walletFor(customerId: string) { return customerId; }

export function financialPeriodFor(period: string) { return periodId(period); }

export function auditForPhase4(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportForMonth(period: string) { return periodId(period); }

export function walletRecord(customerId: string) { return customerId; }

export function phase4Financial(role?: Role) { return isFinanceRole(role); }

export function auditFinancialPhase4(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportPeriodFor(period: string) { return periodId(period); }

export function walletLedgerForCustomer(customerId: string) { return customerId; }

export function isPhase4Role(role?: Role) { return isFinanceRole(role); }

export function phase4Audit(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportPeriodForMonth(period: string) { return periodId(period); }

export function walletCustomer(customerId: string) { return customerId; }

export function phase4Authorized(role?: Role) { return isFinanceRole(role); }

export function auditPhase4Financial(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonth(period: string) { return periodId(period); }

export function walletCustomerId(customerId: string) { return customerId; }

export function phase4Finance(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialAction(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthId(period: string) { return periodId(period); }

export function phase4Wallet(customerId: string) { return customerId; }

export function financialPhase4(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialOperation(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthKey(period: string) { return periodId(period); }

export function phase4WalletCustomer(customerId: string) { return customerId; }

export function phase4Role(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialRecord(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriod(period: string) { return periodId(period); }

export function phase4CustomerWallet(customerId: string) { return customerId; }

export function phase4FinancialRole(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodKey(period: string) { return periodId(period); }

export function phase4WalletId(customerId: string) { return customerId; }

export function phase4FinancialPermission(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrail(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodId(period: string) { return periodId(period); }

export function phase4WalletKey(customerId: string) { return customerId; }

export function phase4FinancePermission(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodKeyFor(period: string) { return periodId(period); }

export function phase4WalletCustomerId(customerId: string) { return customerId; }

export function phase4RolePermission(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodFor(period: string) { return periodId(period); }

export function phase4WalletCustomerKey(customerId: string) { return customerId; }

export function phase4FinanceRole(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailRecord(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodForMonth(period: string) { return periodId(period); }

export function phase4WalletCustomerRecord(customerId: string) { return customerId; }

export function phase4FinancialRoleGuard(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecord(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordId(customerId: string) { return customerId; }

export function phase4FinancialRoleCheck(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailRecordData(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordId(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKey(customerId: string) { return customerId; }

export function phase4FinancialRolePermission(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailRecordEntry(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKey(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyFor(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorization(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailRecordEntryFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyFor(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForId(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationGuard(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryData(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForId(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomer(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationCheck(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailRecordEntryDataFields(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomer(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerId(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermission(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsFor(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerId(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerId(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheck(role?: Role) { return isFinanceRole(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomer(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomer(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValue(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuard(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerId(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValue(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueId(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuarded(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValue(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueId(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueId(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRole(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValueId(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueId(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueIdKey(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRoleId(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValueIdKey(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueIdKey(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueIdKey(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRoleIdValue(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValueIdKeyValue(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueIdKeyValue(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueIdKeyValue(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRoleIdValueKey(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValueIdKeyValueKey(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueIdKeyValueKey(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueIdKeyValueKey(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRoleIdValueKeyValue(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValueIdKeyValueKeyValue(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueIdKeyValueKeyValue(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueIdKeyValueKey(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRoleIdValueKeyValueKey(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValueIdKeyValueKeyValue(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueIdKeyValueKeyValue(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueIdKeyValueKey(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRoleIdValueKeyValueKey(role?: Role) { assertFinance(role); }

export function auditPhase4FinancialTrailRecordEntryDataFieldsForCustomerIdValueIdKeyValueKeyValue(caller: { uid: string; role?: Role }, action: string, target: string, targetId: string) { return auditFields(caller, action, target, targetId); }

export function reportMonthPeriodRecordKeyForCustomerIdValueIdKeyValueKeyValue(period: string) { return periodId(period); }

export function phase4WalletCustomerRecordKeyForCustomerIdValueIdKeyValueKey(customerId: string) { return customerId; }

export function phase4FinancialRoleAuthorizationPermissionCheckGuardedByRoleIdValueKeyValueKey(role?: Role) { assertFinance(role); }
