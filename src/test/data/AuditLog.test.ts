import { describe, expect, it } from "vitest";
import { labelFor } from "@/data/AuditLog";

describe("labelFor", () => {
  it("picks the client's name", () => {
    expect(labelFor("clients", { name: "Aarav Traders", pan: "ABCPE1234F" })).toBe("Aarav Traders");
  });

  it("picks the invoice number", () => {
    expect(labelFor("invoices", { invoice_number: "INV-001", total: 5000 })).toBe("INV-001");
  });

  it("falls back through payment fields when reference is blank", () => {
    expect(labelFor("payments", { reference: "", amount: 1500 })).toBe("1500");
  });

  it("returns empty string for null data", () => {
    expect(labelFor("clients", null)).toBe("");
  });

  it("returns empty string when no candidate field is present", () => {
    expect(labelFor("clients", { pan: "ABCPE1234F" })).toBe("");
  });
});
