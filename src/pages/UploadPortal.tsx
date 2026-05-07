import { useState, useRef, DragEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileText, CheckCircle2, X, Calendar, Building2 } from "lucide-react";
import { mockFirmProfile } from "@/data/mockSettings";
import { taskChecklistStore } from "@/lib/taskChecklistStore";
import { toast } from "sonner";

interface UploadedFile {
  name: string;
  size: number;
  progress: number;
  done: boolean;
}

// Simulated request lookup from token (UI-only)
const mockRequest = {
  documentName: "Form 16 (FY 2024-25)",
  clientName: "Ramesh Kumar Gupta",
  clientId: "1",
  dueDate: "2025-04-25",
};

const MAX_FILE_MB = 10;
const ACCEPTED = [".pdf", ".jpg", ".jpeg", ".png"];

export default function UploadPortal() {
  const { token } = useParams();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const firm = mockFirmProfile;

  const handleFiles = (list: FileList | File[]) => {
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
      const entry: UploadedFile = { name: f.name, size: f.size, progress: 0, done: false };
      setFiles((prev) => [...prev, entry]);
      // Simulate upload progress
      const interval = setInterval(() => {
        setFiles((prev) =>
          prev.map((x) => {
            if (x.name !== entry.name) return x;
            const next = Math.min(x.progress + 15 + Math.random() * 20, 100);
            return { ...x, progress: next, done: next >= 100 };
          })
        );
      }, 250);
      setTimeout(() => clearInterval(interval), 3000);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = () => {
    if (files.length === 0 || files.some((f) => !f.done)) {
      toast.error("Please wait for uploads to finish");
      return;
    }
    // Auto-update the related task's document checklist
    taskChecklistStore.markReceivedByLabel(mockRequest.clientId, mockRequest.documentName);
    setSubmitted(true);
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* White-label firm header (no CA Munim branding) */}
      <header className="bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-base text-foreground">{firm.firmName}</h1>
            <p className="text-xs text-muted-foreground">{firm.phone} · {firm.email}</p>
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
              {firm.firmName} has been notified. You may close this window.
            </p>
            <div className="text-xs text-muted-foreground pt-4 border-t">
              Reference: <span className="font-mono">{token?.slice(0, 8).toUpperCase() ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Document requested</p>
              <h2 className="text-lg font-heading font-bold text-foreground">{mockRequest.documentName}</h2>
              <p className="text-sm text-muted-foreground mt-1">For: {mockRequest.clientName}</p>
              <div className="flex items-center gap-1.5 mt-3 text-sm text-accent font-medium">
                <Calendar className="h-4 w-4" />
                Due by {new Date(mockRequest.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <UploadCloud className="h-10 w-10 mx-auto text-primary mb-3" />
              <p className="font-heading font-semibold text-foreground">Drop files here or tap to upload</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG · max {MAX_FILE_MB}MB each</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED.join(",")}
                hidden
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                {files.map((f) => (
                  <div key={f.name} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => removeFile(f.name)} className="text-muted-foreground hover:text-destructive">
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
              disabled={files.length === 0 || files.some((f) => !f.done)}
              className="w-full h-11 bg-primary"
            >
              Submit to {firm.firmName}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Your files are securely shared with {firm.firmName} only. No account needed.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center text-[11px] text-muted-foreground py-4">
        © {new Date().getFullYear()} {firm.firmName}
      </footer>
    </div>
  );
}
