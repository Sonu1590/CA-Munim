import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useClients, type ClientFormData, type ClientType } from "@/hooks/useClients";
import { validatePAN, validateGSTIN } from "@/lib/indianTaxUtils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

type Step = "upload" | "map" | "preview" | "importing" | "done";

// Target import fields. name/phone/date_of_birth are required by the same
// addClient() this reuses (see useClients.ts — date_of_birth throws if
// empty), so every parsed row needs all three mapped and populated or it
// will be reported as a per-row failure rather than silently skipped.
const TARGET_FIELDS: { key: keyof ClientFormData | "skip"; label: string; required?: boolean }[] = [
  { key: "name", label: "Client Name", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "date_of_birth", label: "Date of Birth / Incorporation", required: true },
  { key: "type", label: "Client Type" },
  { key: "email", label: "Email" },
  { key: "pan", label: "PAN" },
  { key: "gstin", label: "GSTIN" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "annual_fees", label: "Annual Fees" },
  { key: "skip", label: "— Don't import —" },
];

const CLIENT_TYPES: ClientType[] = ["Individual", "HUF", "Sole Proprietor", "Partnership", "LLP", "Private Ltd", "Public Ltd", "Trust", "Society", "AOP", "BOI"];

// Best-guess mapping from a raw spreadsheet header to a target field —
// the user reviews/overrides every guess before anything is imported.
function guessField(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (/name|client/.test(h)) return "name";
  if (/phone|mobile|contact|whatsapp/.test(h)) return "phone";
  if (/dob|birth|incorporat/.test(h)) return "date_of_birth";
  if (/^type$|category|entity|constitution/.test(h)) return "type";
  if (/email|mail/.test(h)) return "email";
  if (/^pan$|pannumber|pancard/.test(h)) return "pan";
  if (/gst/.test(h)) return "gstin";
  if (/city|town/.test(h)) return "city";
  if (/state/.test(h)) return "state";
  if (/fee|billing/.test(h)) return "annual_fees";
  return "skip";
}

function guessClientType(raw: string): ClientType {
  const v = raw.trim().toLowerCase();
  const match = CLIENT_TYPES.find((t) => t.toLowerCase() === v || v.includes(t.toLowerCase()) || t.toLowerCase().includes(v));
  return match ?? "Individual";
}

// Excel stores dates as a day-count serial number when cellDates isn't
// honored by a given sheet/cell format — handle both a real Date and a
// plain string the way it actually arrives from sheet_to_json.
function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return "";
}

interface ParsedRow {
  raw: Record<string, unknown>;
  mapped: Partial<ClientFormData>;
  errors: string[];
}

export function ImportClientsModal({ open, onOpenChange, onImported }: Props) {
  const { addClient } = useClients();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: { row: number; name: string; error: string }[] }>({ success: 0, failed: [] });

  const reset = () => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setRows([]);
    setResults({ success: 0, failed: [] });
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length === 0) {
        toast.error("No rows found in this file.");
        return;
      }
      const detectedHeaders = Object.keys(json[0]);
      const initialMapping: Record<string, string> = {};
      detectedHeaders.forEach((h) => { initialMapping[h] = guessField(h); });

      setHeaders(detectedHeaders);
      setRawRows(json);
      setMapping(initialMapping);
      setStep("map");
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to read this file. Use a .xlsx, .xls, or .csv export.");
    }
  };

  const buildPreview = () => {
    const usedFields = new Set(Object.values(mapping).filter((f) => f !== "skip"));
    const missingRequired = TARGET_FIELDS.filter((f) => f.required && !usedFields.has(f.key as string));
    if (missingRequired.length > 0) {
      toast.error(`Map a column for: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    const parsed: ParsedRow[] = rawRows.map((raw) => {
      const mapped: Partial<ClientFormData> = { services_subscribed: [], mca_filings: [], directors: [] };
      for (const header of headers) {
        const field = mapping[header];
        if (field === "skip" || !field) continue;
        const value = raw[header];
        if (field === "date_of_birth") mapped.date_of_birth = formatDate(value);
        else if (field === "type") mapped.type = guessClientType(String(value ?? ""));
        else if (field === "annual_fees") mapped.annual_fees = Number(value) || 0;
        else (mapped as any)[field] = String(value ?? "").trim();
      }
      if (!mapped.type) mapped.type = "Individual";

      const errors: string[] = [];
      if (!mapped.name) errors.push("Missing name");
      if (!mapped.phone) errors.push("Missing phone");
      if (!mapped.date_of_birth) errors.push("Missing/unparseable date of birth");
      if (mapped.pan) {
        const panCheck = validatePAN(mapped.pan, mapped.type);
        if (!panCheck.isValid) errors.push("Invalid PAN format");
      }
      if (mapped.gstin) {
        const gstinCheck = validateGSTIN(mapped.gstin);
        if (!gstinCheck.isValid) errors.push("Invalid GSTIN format");
      }

      return { raw, mapped, errors };
    });

    setRows(parsed);
    setStep("preview");
  };

  const runImport = async () => {
    setImporting(true);
    setStep("importing");
    let success = 0;
    const failed: { row: number; name: string; error: string }[] = [];

    const importable = rows.filter((r) => r.errors.length === 0);
    for (let i = 0; i < importable.length; i++) {
      const row = importable[i];
      const result = await addClient(row.mapped as ClientFormData);
      if (result.success) {
        success++;
      } else {
        failed.push({ row: i + 1, name: row.mapped.name ?? "(unnamed)", error: result.error ?? "Unknown error" });
      }
    }

    setResults({ success, failed });
    setImporting(false);
    setStep("done");
    onImported?.();
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Clients from Excel
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-12 cursor-pointer hover:bg-muted/50">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to select a file</span>
              <span className="text-xs text-muted-foreground">.xlsx, .xls, or .csv</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              First row must be column headers. Existing clients are matched by PAN — a row with a PAN already in your client list will be skipped.
            </p>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong>{fileName}</strong> — {rawRows.length} rows found. Match each column to a field.
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{h}</p>
                    <p className="text-xs text-muted-foreground truncate">e.g. "{String(rawRows[0]?.[h] ?? "")}"</p>
                  </div>
                  <Select value={mapping[h] ?? "skip"} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key as string}>{f.label}{f.required ? " *" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-600"><Check className="h-4 w-4" />{validCount} ready to import</span>
              {invalidCount > 0 && <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="h-4 w-4" />{invalidCount} will be skipped</span>}
            </div>
            <div className="border border-border rounded-lg max-h-72 overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className={`px-3 py-2 text-sm flex items-center justify-between gap-2 ${i > 0 ? "border-t border-border" : ""} ${r.errors.length > 0 ? "bg-destructive/5" : ""}`}>
                  <div className="min-w-0">
                    <span className="font-medium">{r.mapped.name || "(no name)"}</span>
                    <span className="text-muted-foreground ml-2">{r.mapped.phone}</span>
                  </div>
                  {r.errors.length > 0 ? (
                    <span className="text-xs text-destructive shrink-0">{r.errors.join(", ")}</span>
                  ) : (
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="font-heading font-semibold">Importing {validCount} clients…</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3">
            <div className="text-center py-4 space-y-2">
              <Check className="h-10 w-10 text-green-600 mx-auto" />
              <p className="font-heading font-semibold text-lg">{results.success} clients imported</p>
              {results.failed.length > 0 && <p className="text-sm text-muted-foreground">{results.failed.length} failed</p>}
            </div>
            {results.failed.length > 0 && (
              <div className="border border-border rounded-lg max-h-60 overflow-y-auto">
                {results.failed.map((f) => (
                  <div key={f.row} className="px-3 py-2 text-sm border-t border-border first:border-t-0 flex items-center justify-between gap-2">
                    <span>{f.name}</span>
                    <span className="text-xs text-destructive">{f.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step === "map" && (
            <>
              <Button variant="outline" onClick={reset}><X className="h-4 w-4 mr-1" />Cancel</Button>
              <Button onClick={buildPreview} className="bg-accent hover:bg-accent/90 text-white">Next: Preview</Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={runImport} disabled={validCount === 0 || importing} className="bg-accent hover:bg-accent/90 text-white">
                Import {validCount} Clients
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={close} className="bg-accent hover:bg-accent/90 text-white">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
