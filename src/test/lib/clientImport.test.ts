import { describe, expect, it } from "vitest";
import { guessField, guessClientType, formatDate, mapAndValidateRow } from "@/lib/clientImport";
import { validatePAN, validateGSTIN } from "@/lib/indianTaxUtils";

describe("guessField", () => {
  it("maps common real-world header variants to the right target field", () => {
    expect(guessField("Client Name")).toBe("name");
    expect(guessField("Mobile")).toBe("phone");
    expect(guessField("PAN Number")).toBe("pan");
    expect(guessField("DOB")).toBe("date_of_birth");
    expect(guessField("Type")).toBe("type");
    expect(guessField("City")).toBe("city");
    expect(guessField("State")).toBe("state");
    expect(guessField("Email")).toBe("email");
    expect(guessField("GST Number")).toBe("gstin");
  });

  it("falls back to skip for an unrecognized header", () => {
    expect(guessField("Random Notes Column")).toBe("skip");
  });
});

describe("guessClientType", () => {
  it("matches an exact or partial client type string", () => {
    expect(guessClientType("Individual")).toBe("Individual");
    expect(guessClientType("private limited")).toBe("Private Ltd");
    expect(guessClientType("Pvt Ltd")).not.toBeUndefined();
  });

  it("defaults to Individual for an unrecognized value", () => {
    expect(guessClientType("")).toBe("Individual");
    expect(guessClientType("???")).toBe("Individual");
  });
});

describe("formatDate", () => {
  it("formats a real Date object (the normal case, cellDates: true)", () => {
    expect(formatDate(new Date(2026, 0, 15))).toBe("2026-01-15");
  });

  it("parses a plain ISO date string without shifting a day via UTC round-tripping", () => {
    expect(formatDate("1990-05-15")).toBe("1990-05-15");
  });

  it("parses DD/MM/YYYY (the format this app uses everywhere else)", () => {
    expect(formatDate("15/05/1990")).toBe("1990-05-15");
    expect(formatDate("05/01/2026")).toBe("2026-01-05");
  });

  it("returns empty string for unparseable input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});

describe("mapAndValidateRow", () => {
  const headers = ["Client Name", "Mobile", "PAN Number", "DOB", "Type", "City", "State", "Email"];
  const mapping = {
    "Client Name": "name", "Mobile": "phone", "PAN Number": "pan", "DOB": "date_of_birth",
    "Type": "type", "City": "city", "State": "state", "Email": "email",
  };

  it("maps a valid row with no errors", () => {
    const raw = {
      "Client Name": "Test Import One", "Mobile": "9812345601", "PAN Number": "ABCPD1234E",
      "DOB": "1990-05-15", "Type": "Individual", "City": "Pune", "State": "Maharashtra", "Email": "importone@test.com",
    };
    const result = mapAndValidateRow(raw, headers, mapping, validatePAN, validateGSTIN);
    expect(result.errors).toEqual([]);
    expect(result.mapped.name).toBe("Test Import One");
    expect(result.mapped.phone).toBe("9812345601");
    expect(result.mapped.date_of_birth).toBe("1990-05-15");
    expect(result.mapped.type).toBe("Individual");
  });

  it("maps a valid company row and matches PAN format to its client type", () => {
    const raw = {
      "Client Name": "Test Import Two Pvt Ltd", "Mobile": "9812345602", "PAN Number": "ABCCT5678F",
      "DOB": "2015-08-01", "Type": "Private Ltd", "City": "Mumbai", "State": "Maharashtra", "Email": "importtwo@test.com",
    };
    const result = mapAndValidateRow(raw, headers, mapping, validatePAN, validateGSTIN);
    expect(result.errors).toEqual([]);
    expect(result.mapped.type).toBe("Private Ltd");
  });

  it("flags a row missing phone, date of birth, and with an invalid PAN", () => {
    const raw = {
      "Client Name": "Test Import Bad Row", "Mobile": "", "PAN Number": "INVALIDPAN",
      "DOB": "", "Type": "Individual", "City": "Delhi", "State": "Delhi", "Email": "",
    };
    const result = mapAndValidateRow(raw, headers, mapping, validatePAN, validateGSTIN);
    expect(result.errors).toContain("Missing phone");
    expect(result.errors).toContain("Missing/unparseable date of birth");
    expect(result.errors).toContain("Invalid PAN format");
  });

  it("defaults an unmapped type field to Individual", () => {
    const raw = { "Client Name": "No Type Client", "Mobile": "9999999999", "PAN Number": "", "DOB": "1990-01-01", "Type": "", "City": "", "State": "", "Email": "" };
    const result = mapAndValidateRow(raw, headers, mapping, validatePAN, validateGSTIN);
    expect(result.mapped.type).toBe("Individual");
  });

  it("skips columns mapped to 'skip'", () => {
    const raw = { "Client Name": "X", "Mobile": "9999999999", "PAN Number": "", "DOB": "1990-01-01", "Type": "Individual", "City": "Noise", "State": "Noise", "Email": "" };
    const result = mapAndValidateRow(raw, headers, { ...mapping, City: "skip" }, validatePAN, validateGSTIN);
    expect(result.mapped.city).toBeUndefined();
  });
});
