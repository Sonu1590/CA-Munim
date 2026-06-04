// Utility functions for Indian tax/compliance UI helpers

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const PAN_ENTITY_MAP: Record<string, string> = {
  P: "Individual / Person",
  C: "Company",
  H: "HUF",
  F: "Firm / LLP",
  A: "Association of Persons (AOP)",
  T: "Trust",
  B: "Body of Individuals (BOI)",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government",
};

/** Expected 4th PAN character for each client type (Income Tax entity codes). */
export const CLIENT_TYPE_PAN_CHAR: Record<string, string> = {
  Individual: "P",
  "Sole Proprietor": "P",
  HUF: "H",
  Partnership: "F",
  LLP: "F",
  "Private Ltd": "C",
  "Public Ltd": "C",
  Trust: "T",
  Society: "T",
  AOP: "A",
  BOI: "B",
};

export type PanValidationResult = {
  isValid: boolean;
  entityType: string | null;
  entityChar: string | null;
  value: string;
  /** Set when PAN format is valid but 4th char does not match selected client type. */
  clientTypeMismatch: string | null;
  /** Set when format is valid but 4th char is not a known entity code. */
  unknownEntityCode: string | null;
};

export function getPanEntityLabel(char: string): string | null {
  return PAN_ENTITY_MAP[char] ?? null;
}

export function validatePAN(pan: string, clientType?: string): PanValidationResult {
  const value = pan.trim().toUpperCase();
  const isValid = PAN_REGEX.test(value);
  const entityChar = isValid ? value[3] : null;
  const entityType = entityChar ? getPanEntityLabel(entityChar) : null;

  let unknownEntityCode: string | null = null;
  if (isValid && entityChar && !entityType) {
    unknownEntityCode = `4th character '${entityChar}' is not a valid PAN entity code. Use P (Individual), C (Company), H (HUF), F (Firm), A (AOP), T (Trust), or B (BOI).`;
  }

  let clientTypeMismatch: string | null = null;
  if (isValid && entityChar && clientType) {
    const expectedChar = CLIENT_TYPE_PAN_CHAR[clientType];
    if (expectedChar && entityChar !== expectedChar) {
      const expectedLabel = PAN_ENTITY_MAP[expectedChar] ?? expectedChar;
      const foundLabel = entityType ?? `code '${entityChar}'`;
      clientTypeMismatch = `For ${clientType}, PAN 4th character should be '${expectedChar}' (${expectedLabel}), not '${entityChar}' (${foundLabel}).`;
    }
  }

  return {
    isValid,
    entityType,
    entityChar,
    value,
    clientTypeMismatch,
    unknownEntityCode,
  };
}

// GST state codes (first 2 digits of GSTIN)
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam",
  "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman & Nicobar", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh",
};

export function validateGSTIN(gstin: string) {
  const value = gstin.trim().toUpperCase();
  const isValid = GSTIN_REGEX.test(value);
  const stateCode = value.slice(0, 2);
  const stateName = GST_STATE_CODES[stateCode] ?? null;
  return { isValid, stateCode, stateName, value };
}

// Financial Year auto-detection (April–March)
// Returns "FY YYYY-YY" for a given Date
export function getFinancialYear(date: Date | string | null | undefined, fallback = "-"): string {
  if (!date) return fallback;
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  if (isNaN(d.getTime())) return fallback;
  const month = d.getMonth(); // 0=Jan
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1; // April = 3
  const endYY = String((startYear + 1) % 100).padStart(2, "0");
  return `FY ${startYear}-${endYY}`;
}

export function getCurrentFinancialYear(date = new Date()): string {
  return getFinancialYear(date, "");
}
