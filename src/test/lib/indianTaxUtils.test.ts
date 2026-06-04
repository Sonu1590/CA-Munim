import { describe, expect, it } from "vitest";
import { validatePAN } from "@/lib/indianTaxUtils";

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
