import { supabase } from '@/lib/supabase';
import { useState, useRef, useEffect, DragEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileText, CheckCircle2, X, Calendar, Building2, Loader2 } from "lucide-react";
import { fetchFirmProfileFromSupabase } from "@/data/Settings";
import { toast } from "sonner";

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  progress: number;
  done: boolean;
  error?: boolean;
  path?: string; // storage path once the file is uploaded
}

const STORAGE_BUCKET = "ca-munim-documents";

interface DocumentRequest {
  documentName: string;
  clientName: string;
  clientId?: string;
  dueDate: string;
}

const MAX_FILE_MB = 10;
const ACCEPTED = [".pdf", ".jpg", ".jpeg", ".png"];

const emptyFirm = {
  firmName: "",
  caName: "",
  icaiMembershipNo: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  phone: "",
  email: "",
  firmPan: "",
  firmGstin: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
  upiId: "",
};

export default function UploadPortal() {
  // ── All hooks inside the component ──────────────────────────────────────
  const { token } = useParams();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [firm, setFirm] = useState(emptyFirm);
  const [loadingFirm, setLoadingFirm] = useState(true);
  const [firmError, setFirmError] = useState<string | null>(null);
  const [request, setRequest] = useState<DocumentRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch firm profile ───────────────────────────────────────────────────
  useEffect(() => {
    const loadFirm = async () => {
      setLoadingFirm(true);
      setFirmError(null);
      try {
        const profile = await fetchFirmProfileFromSupabase();
        setFirm(profile as typeof emptyFirm);
      } catch (err: any) {
        setFirmError(err.message ?? "Unable to load firm profile");
      } finally {
        setLoadingFirm(false);
      }
    };
    loadFirm();
  }, []);

  // ── Fetch document request by token ─────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setLoadingRequest(false);
      setRequestError("Invalid upload link.");
      return;
    }
    setLoadingRequest(true);
    supabase
      .rpc('get_upload_request', { p_token: token })
      .then(({ data, error }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row) {
          setRequestError("This upload link is invalid or has already been used.");
        } else {
          setRequest({
            documentName: row.custom_label ?? row.document_type ?? 'Document',
            clientName: row.client_name ?? 'Client',
            clientId: row.client_id,
            dueDate: row.due_date ?? '',
          });
        }
        setLoadingRequest(false);
      });
  }, [token]);

  // ── File handling ────────────────────────────────────────────────────────
  const handleFiles = async (list: FileList | File[]) => {
    if (!token) {
      toast.error("Invalid upload link.");
      return;
    }

    const incoming = Array.from(list);
    for (const f of incoming) {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        toast.error(`${f.name}: only PDF, JPG, PNG allowed`);
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name}: max ${MAX_FILE_MB}MB`);
        continue;
      }

      const entry: UploadedFile = {
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        progress: 15,
        done: false,
      };
      setFiles((prev) => [...prev, entry]);

      // Real upload to the private Supabase storage bucket.
      const safeName = f.name.replace(/[^\w.\-]+/g, "_");
      const path = `client-uploads/${token}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, f, { cacheControl: "3600", upsert: false, contentType: f.type || undefined });

      setFiles((prev) =>
        prev.map((x) => {
          if (x !== entry && !(x.name === entry.name && !x.path && !x.error)) return x;
          return error
            ? { ...x, error: true, done: false, progress: 0 }
            : { ...x, path, progress: 100, done: true };
        })
      );

      if (error) toast.error(`${f.name}: upload failed. Please try again.`);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    const uploaded = files.filter((f) => f.done && f.path);
    const stillUploading = files.some((f) => !f.done && !f.error);

    if (uploaded.length === 0 || stillUploading) {
      toast.error("Please wait for all files to finish uploading");
      return;
    }
    if (!token) {
      toast.error("Invalid upload link.");
      return;
    }

    setSubmitting(true);
    try {
      // Record the uploaded files against the correct firm/client and mark the
      // request complete. The token is validated server-side inside the RPC.
      const { error } = await supabase.rpc("record_client_upload", {
        p_token: token,
        p_files: uploaded.map((f) => ({
          name: f.name,
          url: f.path,
          size: f.size,
          type: f.type,
        })),
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || "Submission failed. Please try again or contact your CA.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  // ── Loading / error states ───────────────────────────────────────────────
  if (loadingRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading upload details...</span>
        </div>
      </div>
    );
  }

  if (requestError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-md space-y-3">
          <X className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-heading font-bold">Invalid Link</h2>
          <p className="text-sm text-muted-foreground">{requestError}</p>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* White-label firm header — no CA Munim branding */}
      <header className="bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            {loadingFirm ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : firmError ? (
              <div className="text-sm text-destructive">{firmError}</div>
            ) : (
              <>
                <h1 className="font-heading font-bold text-base text-foreground">
                  {firm.firmName || firm.caName || "CA Firm"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {firm.phone} · {firm.email}
                </p>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {submitted ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-xl font-heading font-bold">Document uploaded successfully</h2>
            <p className="text-sm text-muted-foreground">
              {firm.firmName || firm.caName || "Your CA"} has been notified. You may close this window.
            </p>
            <div className="text-xs text-muted-foreground pt-4 border-t">
              Reference: <span className="font-mono">{token?.slice(0, 8).toUpperCase() ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Request info card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Document requested
              </p>
              <h2 className="text-lg font-heading font-bold text-foreground">
                {request?.documentName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                For: {request?.clientName}
              </p>
              {request?.dueDate && (
                <div className="flex items-center gap-1.5 mt-3 text-sm text-accent font-medium">
                  <Calendar className="h-4 w-4" />
                  Due by{" "}
                  {new Date(request.dueDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3" />
              <p className="font-heading font-semibold text-foreground">
                Drop files here or tap to upload
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, JPG, PNG · max {MAX_FILE_MB}MB each
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED.join(",")}
                hidden
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                {files.map((f) => (
                  <div key={f.name} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        onClick={() => removeFile(f.name)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Progress value={f.progress} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !files.some((f) => f.done && f.path) ||
                files.some((f) => !f.done && !f.error)
              }
              className="w-full h-11 bg-primary"
            >
              {submitting ? "Submitting..." : `Submit to ${firm.firmName || firm.caName || "your CA"}`}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Your files are securely shared with {firm.firmName || firm.caName || "your CA"} only. No account needed.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center text-[11px] text-muted-foreground py-4">
        © {new Date().getFullYear()} {firm.firmName || firm.caName || "CA Firm"}
      </footer>
    </div>
  );
}
