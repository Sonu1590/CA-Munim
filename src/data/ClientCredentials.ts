import { supabase } from "@/lib/supabase";

export interface ClientPortalCredential {
  id: string;
  clientId: string;
  portalName: string;
  username: string;
  hasPassword: boolean;
  notes: string;
  updatedAt: string;
}

export interface ClientDscRecord {
  id: string;
  clientId: string;
  holderName: string;
  dscSerialNumber: string;
  issuingAuthority: string;
  tokenType: string;
  validFrom: string;
  validUntil: string;
  hasPin: boolean;
  notes: string;
  updatedAt: string;
}

// Lists never carry the plaintext secret or the vault_secret_id itself —
// vault_secret_id is only ever read here to derive hasPassword/hasPin and
// is never rendered or passed anywhere; reveal_client_portal_credential()/
// reveal_client_dsc_pin() are the only paths that ever return a secret,
// one at a time, on explicit user action.
export async function fetchClientPortalCredentials(clientId: string): Promise<ClientPortalCredential[]> {
  const { data, error } = await supabase
    .from("client_portal_credentials")
    .select("id, client_id, portal_name, username, vault_secret_id, notes, updated_at")
    .eq("client_id", clientId)
    .order("portal_name");

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    portalName: row.portal_name,
    username: row.username ?? "",
    hasPassword: row.vault_secret_id != null,
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  }));
}

export async function saveClientPortalCredential(input: {
  id?: string;
  clientId: string;
  portalName: string;
  username: string;
  password: string | null; // null = leave the stored password unchanged
  notes: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_client_portal_credential", {
    p_id: input.id ?? null,
    p_client_id: input.clientId,
    p_portal_name: input.portalName,
    p_username: input.username || null,
    p_password: input.password,
    p_notes: input.notes || null,
  });
  if (error) throw error;
  return data as string;
}

export async function revealClientPortalCredential(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("reveal_client_portal_credential", { p_id: id });
  if (error) throw error;
  return (data as string) ?? "";
}

export async function deleteClientPortalCredential(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_client_portal_credential", { p_id: id });
  if (error) throw error;
}

export async function fetchClientDscRecords(clientId: string): Promise<ClientDscRecord[]> {
  const { data, error } = await supabase
    .from("client_dsc_records")
    .select("id, client_id, holder_name, dsc_serial_number, issuing_authority, token_type, valid_from, valid_until, pin_vault_secret_id, notes, updated_at")
    .eq("client_id", clientId)
    .order("valid_until", { ascending: true, nullsFirst: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    holderName: row.holder_name,
    dscSerialNumber: row.dsc_serial_number ?? "",
    issuingAuthority: row.issuing_authority ?? "",
    tokenType: row.token_type ?? "",
    validFrom: row.valid_from ?? "",
    validUntil: row.valid_until ?? "",
    hasPin: row.pin_vault_secret_id != null,
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  }));
}

export async function saveClientDscRecord(input: {
  id?: string;
  clientId: string;
  holderName: string;
  dscSerialNumber: string;
  issuingAuthority: string;
  tokenType: string;
  validFrom: string | null;
  validUntil: string | null;
  pin: string | null; // null = leave the stored PIN unchanged
  notes: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_client_dsc_record", {
    p_id: input.id ?? null,
    p_client_id: input.clientId,
    p_holder_name: input.holderName,
    p_dsc_serial_number: input.dscSerialNumber || null,
    p_issuing_authority: input.issuingAuthority || null,
    p_token_type: input.tokenType || null,
    p_valid_from: input.validFrom || null,
    p_valid_until: input.validUntil || null,
    p_pin: input.pin,
    p_notes: input.notes || null,
  });
  if (error) throw error;
  return data as string;
}

export async function revealClientDscPin(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("reveal_client_dsc_pin", { p_id: id });
  if (error) throw error;
  return (data as string) ?? "";
}

export async function deleteClientDscRecord(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_client_dsc_record", { p_id: id });
  if (error) throw error;
}

export type DscExpiryStatus = "expired" | "expiring_soon" | "valid" | "unknown";

export function dscExpiryStatus(validUntil: string, asOf: Date = new Date()): DscExpiryStatus {
  if (!validUntil) return "unknown";
  const until = new Date(`${validUntil}T00:00:00`);
  const daysLeft = Math.ceil((until.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 30) return "expiring_soon";
  return "valid";
}
