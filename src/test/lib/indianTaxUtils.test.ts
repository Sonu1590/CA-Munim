import { describe, expect, it } from "vitest";
import { validatePAN, generateFinancialYears, getCurrentFinancialYear, roundMoney } from "@/lib/indianTaxUtils";

describe("roundMoney", () => {
  it("eliminates float artifacts from percentage-based GST math", () => {
    // 100.10 * 0.09 === 9.008999999999999 in raw JS float arithmetic.
    expect(roundMoney(100.10 * 0.09)).toBe(9.01);
    expect(roundMoney(1234.56 * 0.09)).toBe(111.11);
    expect(roundMoney(333.33 * 0.09)).toBe(30);
    expect(roundMoney(45.67 * 0.09)).toBe(4.11);
  });

  it("leaves already-clean values unchanged", () => {
    expect(roundMoney(100)).toBe(100);
    expect(roundMoney(99.99)).toBe(99.99);
  });
});

describe("validatePAN", () => {
  it("maps 4th character P to Individual", () => {
    const result = validatePAN("ABCPA1234F", "Individual");
    expect(result.isValid).toBe(true);
    expect(result.entityType).toBe("Individual / Person");
    expect(result.clientTypeMismatch).toBeNull();
  });

  it("flags mismatch between Individual client type and non-P 4th character", () => {
    const result = validatePAN("ABCDE1234F", "Individual");
    expect(result.isValid).toBe(true);
    expect(result.entityType).toBeNull();
    expect(result.unknownEntityCode).toContain("4th character 'D'");
    expect(result.clientTypeMismatch).toContain("should be 'P'");
  });

  it("does not return Unknown as entity type", () => {
    const result = validatePAN("ABCDE1234F");
    expect(result.entityType).not.toBe("Unknown");
  });
});

describe("generateFinancialYears", () => {
  it("always includes the current FY, unlike a hardcoded list that goes stale", () => {
    // Regression check for the original bug: a fixed array shipped ending
    // at FY 2027-28 would silently stop including "now" once the real
    // calendar moved past April 2028.
    const farFuture = new Date("2035-06-15");
    const years = generateFinancialYears(5, 1, farFuture);
    expect(years).toContain(getCurrentFinancialYear(farFuture));
  });

  it("produces an ascending, contiguous window with no gaps", () => {
    const asOf = new Date("2026-07-10"); // FY 2026-27
    const years = generateFinancialYears(2, 1, asOf);
    expect(years).toEqual(["FY 2024-25", "FY 2025-26", "FY 2026-27", "FY 2027-28"]);
  });

  it("resolves the FY correctly on both sides of the April boundary", () => {
    expect(generateFinancialYears(0, 0, new Date("2026-03-31"))).toEqual(["FY 2025-26"]);
    expect(generateFinancialYears(0, 0, new Date("2026-04-01"))).toEqual(["FY 2026-27"]);
  });
});
