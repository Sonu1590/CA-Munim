import type { ClientFormData, ClientType } from "@/hooks/useClients";

export const CLIENT_TYPES: ClientType[] = ["Individual", "HUF", "Sole Proprietor", "Partnership", "LLP", "Private Ltd", "Public Ltd", "Trust", "Society", "AOP", "BOI"];

// Best-guess mapping from a raw spreadsheet header to a target field — the
// user reviews/overrides every guess before anything is imported, so a
// wrong guess here costs a click, not bad data.
export function guessField(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/name|client/.test(h)) return "name";
  if (/phone|mobile|contact|whatsapp/.test(h)) return "phone";
  if (/dob|birth|incorporat/.test(h)) return "date_of_birth";
  if (/^type$|category|entity|constitution/.test(h)) return "type";
  if (/email|mail/.test(h)) return "email";
  if (/^pan$|pannumber|pancard/.test(h)) return "pan";
  if (/gstfiling|filingfreq|qrmp/.test(h)) return "gst_filing_freq";
  if (/gst/.test(h)) return "gstin";
  if (/city|town/.test(h)) return "city";
  if (/state/.test(h)) return "state";
  if (/fee|billing/.test(h)) return "annual_fees";
  return "skip";
}

export function guessClientType(raw: string): ClientType {
  // "Limited" is the common spelled-out form CAs' own spreadsheets use;
  // ClientType only recognizes the abbreviation "Ltd".
  const v = raw.trim().toLowerCase().replace(/\blimited\b/g, "ltd");
  const match = CLIENT_TYPES.find((t) => t.toLowerCase() === v || v.includes(t.toLowerCase()) || t.toLowerCase().includes(v));
  return match ?? "Individual";
}

// Normalizes free-text spreadsheet values ("Q", "QRMP", "Qtrly", "monthly")
// to the exact "Monthly"/"Quarterly" values the app's own Select uses —
// generate-recurring-tasks and BulkTaskGenerator both check === "Quarterly".
export function guessGstFilingFreq(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  if (/quarter|qrmp|qtr|^q$/.test(v)) return "Quarterly";
  if (/month/.test(v)) return "Monthly";
  return "";
}

const pad = (n: number) => String(n).padStart(2, "0");

// Excel stores dates as a day-count serial number when cellDates isn't
// honored by a given sheet/cell format — handle both a real Date (the
// normal case, since the importer reads with cellDates: true) and a plain
// string, since sheet_to_json can still hand back either depending on the
// source file's own cell formatting. Reads local Y/M/D components rather
// than going through toISOString(), which converts to UTC first and can
// silently shift the date by a day depending on the browser's timezone —
// the same class of bug flagged elsewhere in this app's due-date math.
export function formatDate(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();

    // Already Y-M-D — extract directly rather than round-tripping through
    // new Date(), which parses a bare date string as UTC midnight; reading
    // it back with local getters could silently shift it a day either way
    // depending on the browser's timezone.
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    // DD/MM/YYYY or DD-MM-YYYY — the format this app uses everywhere else
    // (en-IN locale), and the most likely format in a CA's own spreadsheet.
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${pad(Number(dmyMatch[2]))}-${pad(Number(dmyMatch[1]))}`;

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
    }
  }
  return "";
}

export interface ParsedRow {
  raw: Record<string, unknown>;
  mapped: Partial<ClientFormData>;
  errors: string[];
}

// Applies a header->field mapping to one raw spreadsheet row and validates
// it against the same required fields addClient() itself enforces, plus
// PAN/GSTIN format — pulled out of the component so it's testable without
// rendering React or touching Supabase.
export function mapAndValidateRow(
  raw: Record<string, unknown>,
  headers: string[],
  mapping: Record<string, string>,
  validatePAN: (pan: string, clientType?: string) => { isValid: boolean },
  validateGSTIN: (gstin: string) => { isValid: boolean },
): ParsedRow {
  const mapped: Partial<ClientFormData> = { services_subscribed: [], mca_filings: [], directors: [] };
  for (const header of headers) {
    const field = mapping[header];
    if (field === "skip" || !field) continue;
    const value = raw[header];
    if (field === "date_of_birth") mapped.date_of_birth = formatDate(value);
    else if (field === "type") mapped.type = guessClientType(String(value ?? ""));
    else if (field === "gst_filing_freq") mapped.gst_filing_freq = guessGstFilingFreq(String(value ?? ""));
    else if (field === "annual_fees") mapped.annual_fees = Number(value) || 0;
    else (mapped as any)[field] = String(value ?? "").trim();
  }
  if (!mapped.type) mapped.type = "Individual";

  const errors: string[] = [];
  if (!mapped.name) errors.push("Missing name");
  if (!mapped.phone) errors.push("Missing phone");
  if (!mapped.date_of_birth) errors.push("Missing/unparseable date of birth");
  if (mapped.pan) {
    if (!validatePAN(mapped.pan, mapped.type).isValid) errors.push("Invalid PAN format");
  }
  if (mapped.gstin) {
    if (!validateGSTIN(mapped.gstin).isValid) errors.push("Invalid GSTIN format");
  }

  return { raw, mapped, errors };
}
