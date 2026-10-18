import { Firestore, Transaction, Timestamp } from "firebase-admin/firestore";

const COUNTER_PATH = "system/orderNumberCounter";
const ORDER_NUMBER_PATTERN = /^FN-(\d{4})-(\d{6,})$/;

export function parseOrderNumber(value: unknown): { year: number; sequence: number } | null {
  if (typeof value !== "string") return null;
  const match = ORDER_NUMBER_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const sequence = Number(match[2]);
  return Number.isSafeInteger(year) && Number.isSafeInteger(sequence) && sequence > 0 ? { year, sequence } : null;
}

export function formatOrderNumber(year: number, sequence: number) {
  return `FN-${year}-${String(sequence).padStart(6, "0")}`;
}

export async function allocateOrderNumber(tx: Transaction, db: Firestore, year: number) {
  const counterRef = db.doc(COUNTER_PATH);
  const counterSnap = await tx.get(counterRef);
  const raw = counterSnap.data()?.nextSequence;
  const next = typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
  let sequence = next;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = formatOrderNumber(year, sequence);
    const owners = await tx.get(db.collection("orders").where("orderNumber", "==", candidate).limit(1));
    if (owners.empty) {
      tx.set(counterRef, { nextSequence: sequence + 1, updatedAt: Timestamp.now() }, { merge: true });
      return candidate;
    }
    sequence += 1;
  }
  throw new Error("Unable to allocate a unique Order ID.");
}

export function nextAvailableSequence(orderNumbers: readonly unknown[], counterNext: unknown, year: number) {
  const counter = typeof counterNext === "number" && Number.isSafeInteger(counterNext) && counterNext > 0 ? counterNext : 1;
  const highest = orderNumbers.reduce<number>((value, item) => {
    const parsed = parseOrderNumber(item);
    return parsed?.year === year ? Math.max(value, parsed.sequence) : value;
  }, 0);
  return Math.max(counter, highest + 1);
}
