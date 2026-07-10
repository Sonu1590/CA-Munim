import { supabase } from "@/lib/supabase";

export type AuditAction = "insert" | "update" | "delete";

export interface AuditLogEntry {
  id: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  changedByName: string | null;
  changedAt: string;
  recordLabel: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

// Best-effort human label for a row so the list reads like "Updated client
// Aarav Traders" rather than a bare UUID — falls back through the field
// each tracked table is most likely to have a readable name/description in.
export function labelFor(tableName: string, data: Record<string, unknown> | null): string {
  if (!data) return "";
  const candidates: Record<string, string[]> = {
    clients: ["name"],
    invoices: ["invoice_number"],
    payments: ["reference", "amount"],
    tasks: ["task_type"],
    staff: ["name"],
  };
  for (const field of candidates[tableName] ?? ["name"]) {
    const value = data[field];
    if (value != null && value !== "") return String(value);
  }
  return "";
}

export async function fetchAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, table_name, record_id, action, changed_by_name, old_data, new_data, changed_at")
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  type Row = {
    id: string;
    table_name: string;
    record_id: string;
    action: AuditAction;
    changed_by_name: string | null;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    changed_at: string;
  };

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action,
    changedByName: row.changed_by_name,
    changedAt: row.changed_at,
    recordLabel: labelFor(row.table_name, row.new_data ?? row.old_data),
    oldData: row.old_data,
    newData: row.new_data,
  }));
}
