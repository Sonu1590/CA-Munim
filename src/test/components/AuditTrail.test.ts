import { describe, expect, it } from "vitest";
import { fieldDiff } from "@/components/settings/AuditTrail";

describe("fieldDiff", () => {
  it("lists only fields that actually changed", () => {
    const before = { name: "Old Name", phone: "9999999999", pan: "ABCPE1234F" };
    const after = { name: "New Name", phone: "9999999999", pan: "ABCPE1234F" };
    expect(fieldDiff(before, after)).toEqual(['name: "Old Name" → "New Name"']);
  });

  it("ignores updated_at/created_at churn", () => {
    const before = { name: "Same", updated_at: "2026-07-01T00:00:00Z" };
    const after = { name: "Same", updated_at: "2026-07-10T00:00:00Z" };
    expect(fieldDiff(before, after)).toEqual([]);
  });

  it("returns an empty array when either side is null", () => {
    expect(fieldDiff(null, { name: "X" })).toEqual([]);
    expect(fieldDiff({ name: "X" }, null)).toEqual([]);
  });

  it("reports a field newly appearing or disappearing", () => {
    expect(fieldDiff({}, { notes: "added" })).toEqual(['notes: null → "added"']);
    expect(fieldDiff({ notes: "removed" }, {})).toEqual(['notes: "removed" → null']);
  });
});
