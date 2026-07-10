import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { fetchAuditLog, type AuditLogEntry } from "@/data/AuditLog";
import { useUserRole } from "@/hooks/useUserRole";

const tableLabels: Record<string, string> = {
  clients: "Client",
  invoices: "Invoice",
  payments: "Payment",
  tasks: "Task",
  staff: "Staff",
};

const actionLabels: Record<AuditLogEntry["action"], string> = {
  insert: "Created",
  update: "Updated",
  delete: "Deleted",
};

const actionStyles: Record<AuditLogEntry["action"], string> = {
  insert: "bg-success/10 text-success",
  update: "bg-primary/10 text-primary",
  delete: "bg-destructive/10 text-destructive",
};

export function fieldDiff(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string[] {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const skip = new Set(["updated_at", "created_at"]);
  const diffs: string[] = [];
  for (const key of keys) {
    if (skip.has(key)) continue;
    const before = JSON.stringify(oldData[key]);
    const after = JSON.stringify(newData[key]);
    if (before !== after) diffs.push(`${key}: ${before ?? "null"} → ${after ?? "null"}`);
  }
  return diffs;
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const diffs = entry.action === "update" ? fieldDiff(entry.oldData, entry.newData) : [];
  const canExpand = diffs.length > 0;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3.5 text-left disabled:cursor-default"
        onClick={() => canExpand && setExpanded((v) => !v)}
        disabled={!canExpand}
      >
        {canExpand ? (
          expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <Badge variant="secondary" className={`text-xs shrink-0 ${actionStyles[entry.action]}`}>
          {actionLabels[entry.action]}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">
            <span className="font-medium">{tableLabels[entry.tableName] ?? entry.tableName}</span>
            {entry.recordLabel ? <span className="text-muted-foreground"> — {entry.recordLabel}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {entry.changedByName ?? "System"} · {new Date(entry.changedAt).toLocaleString("en-IN")}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="px-3.5 pb-3.5 pl-11 space-y-1">
          {diffs.map((line, i) => (
            <p key={i} className="text-xs font-mono text-muted-foreground break-all">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditTrail() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAuditLog();
        setEntries(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit trail");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading audit trail...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">The audit trail is only available to firm admins.</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Audit Trail</h3>
        <p className="text-sm text-muted-foreground">Every change to clients, invoices, payments, tasks, and staff — who, what, and when.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No changes recorded yet.</p>
          ) : (
            <div>
              {entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
