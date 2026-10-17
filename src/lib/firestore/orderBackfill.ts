const ORDER_NUMBER_PATTERN = /^FN-(\d{4})-(\d{6,})$/;

export function parseOrderNumber(value: unknown): { year: number; sequence: number } | null {
  if (typeof value !== "string") return null;
  const match = ORDER_NUMBER_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const sequence = Number(match[2]);
  return Number.isSafeInteger(year) && Number.isSafeInteger(sequence) && sequence > 0
    ? { year, sequence }
    : null;
}

export function nextAvailableSequence(orderNumbers: readonly unknown[], counterNext: unknown, year: number): number {
  const parsedCounter = typeof counterNext === "number" && Number.isSafeInteger(counterNext) && counterNext > 0 ? counterNext : 1;
  const highestExisting = orderNumbers.reduce<number>((highest, value) => {
    const parsed = parseOrderNumber(value);
    return parsed?.year === year ? Math.max(highest, parsed.sequence) : highest;
  }, 0);
  return Math.max(parsedCounter, highestExisting + 1);
}

export function formatOrderNumber(year: number, sequence: number): string {
  return `FN-${year}-${String(sequence).padStart(6, "0")}`;
}
