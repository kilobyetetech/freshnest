import { formatOrderNumber, nextAvailableSequence, parseOrderNumber } from "../src/lib/firestore/orderBackfill";

describe("order backfill helpers", () => {
  it("parses only valid immutable order numbers", () => {
    expect(parseOrderNumber("FN-2026-000007")).toEqual({ year: 2026, sequence: 7 });
    expect(parseOrderNumber("legacy-7")).toBeNull();
    expect(parseOrderNumber("FN-2026-000000")).toBeNull();
  });

  it("starts after existing records and the shared counter", () => {
    expect(nextAvailableSequence(["FN-2026-000004", "FN-2026-000012"], 3, 2026)).toBe(13);
    expect(nextAvailableSequence(["FN-2025-999999"], 4, 2026)).toBe(4);
  });

  it("formats stable, human-readable identifiers", () => {
    expect(formatOrderNumber(2026, 13)).toBe("FN-2026-000013");
  });
});
