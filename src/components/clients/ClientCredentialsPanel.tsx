import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, Plus, Trash2, Pencil, KeyRound, ShieldAlert, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useUserRole } from "@/hooks/useUserRole";
import {
  fetchClientPortalCredentials, saveClientPortalCredential, revealClientPortalCredential, deleteClientPortalCredential,
  fetchClientDscRecords, saveClientDscRecord, revealClientDscPin, deleteClientDscRecord,
  dscExpiryStatus,
  type ClientPortalCredential, type ClientDscRecord,
} from "@/data/ClientCredentials";

// (M10) A password re-confirmation is required before any reveal — a
// deliberately deferred hardening step, added once it was clear the admin
// role reveals were the only credential-vault control left unrated.
// Verification is cached for a few minutes so an admin doing legitimate
// bulk work (checking several clients' portal logins in a row) isn't
// re-prompted on every single reveal; the server-side rate limit
// (check_reveal_rate_limit(), called inside both reveal RPCs) is the real
// backstop against abuse, this is just step-up friction against e.g. an
// unattended unlocked tab.
const REAUTH_VALID_MS = 5 * 60 * 1000;

const dscStatusStyle: Record<string, string> = {
  expired: "bg-destructive/10 text-destructive",
  expiring_soon: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  valid: "bg-success/10 text-success",
  unknown: "bg-muted text-muted-foreground",
};

const dscStatusLabel: Record<string, string> = {
  expired: "Expired",
  expiring_soon: "Expiring soon",
  valid: "Valid",
  unknown: "No expiry set",
};

// One "Reveal" control for either a portal password or a DSC PIN — fetches
// the plaintext on click (never preloaded with the list) and re-masks on a
// second click without re-fetching, since the value is already in memory.
// `ensureReAuth` (shared across every RevealField in the panel, so the
// cached 5-minute verification window applies panel-wide, not per-field)
// must resolve true before the actual reveal RPC is ever called.
function RevealField({ reveal, ensureReAuth }: { reveal: () => Promise<string>; ensureReAuth: () => Promise<boolean> }) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (value !== null) { setValue(null); return; }
    const authed = await ensureReAuth();
    if (!authed) return;
    setLoading(true);
    try {
      const v = await reveal();
      setValue(v || "(not set)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to reveal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      {value !== null ? value : "••••••••"}
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        title={value !== null ? "Hide" : "Reveal — requires your password and is logged in the Audit Trail"}
        className="text-muted-foreground hover:text-foreground"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : value !== null ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

// Prompts for the signed-in admin's own password and re-verifies it via
// Supabase Auth (the actual server-side check — this component just
// orchestrates it) before letting a reveal proceed. `onConfirm` returns
// whether the password was correct so the dialog can show an inline error
// instead of just closing on failure.
function ReAuthDialog({
  open, onConfirm, onCancel,
}: { open: boolean; onConfirm: (password: string) => Promise<boolean>; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setPassword(""); setError(null); }
  }, [open]);

  const handleConfirm = async () => {
    if (!password) return;
    setVerifying(true);
    setError(null);
    const ok = await onConfirm(password);
    setVerifying(false);
    if (!ok) setError("Incorrect password.");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Confirm your password</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Re-enter your password to reveal this credential. You won't be asked again for 5 minutes.</p>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={verifying || !password}>{verifying ? "Verifying..." : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PortalCredentialForm({
  clientId, editing, onSaved, onCancel,
}: { clientId: string; editing: ClientPortalCredential | null; onSaved: () => void; onCancel: () => void }) {
  const [portalName, setPortalName] = useState(editing?.portalName ?? "");
  const [username, setUsername] = useState(editing?.username ?? "");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!portalName.trim()) { toast.error("Portal name is required"); return; }
    setSaving(true);
    try {
      await saveClientPortalCredential({
        id: editing?.id,
        clientId,
        portalName: portalName.trim(),
        username: username.trim(),
        password: password ? password : null,
        notes: notes.trim(),
      });
      toast.success(editing ? "Credential updated" : "Credential added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save credential");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit Portal Credential" : "Add Portal Credential"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div><Label>Portal *</Label><Input className="mt-1.5" placeholder="e.g. GST Portal, Income Tax e-filing, MCA" value={portalName} onChange={(e) => setPortalName(e.target.value)} /></div>
        <div><Label>Username</Label><Input className="mt-1.5" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
        <div>
          <Label>Password</Label>
          <Input className="mt-1.5" type="password" placeholder={editing?.hasPassword ? "Leave blank to keep the existing password" : ""} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div><Label>Notes</Label><Input className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DscRecordForm({
  clientId, editing, onSaved, onCancel,
}: { clientId: string; editing: ClientDscRecord | null; onSaved: () => void; onCancel: () => void }) {
  const [holderName, setHolderName] = useState(editing?.holderName ?? "");
  const [serial, setSerial] = useState(editing?.dscSerialNumber ?? "");
  const [issuer, setIssuer] = useState(editing?.issuingAuthority ?? "");
  const [tokenType, setTokenType] = useState(editing?.tokenType ?? "");
  const [validFrom, setValidFrom] = useState(editing?.validFrom ?? "");
  const [validUntil, setValidUntil] = useState(editing?.validUntil ?? "");
  const [pin, setPin] = useState("");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!holderName.trim()) { toast.error("Holder name is required"); return; }
    setSaving(true);
    try {
      await saveClientDscRecord({
        id: editing?.id,
        clientId,
        holderName: holderName.trim(),
        dscSerialNumber: serial.trim(),
        issuingAuthority: issuer.trim(),
        tokenType: tokenType.trim(),
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        pin: pin ? pin : null,
        notes: notes.trim(),
      });
      toast.success(editing ? "DSC record updated" : "DSC record added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save DSC record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Edit DSC Record" : "Add DSC Record"}</DialogTitle></DialogHeader>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div><Label>Holder Name *</Label><Input className="mt-1.5" value={holderName} onChange={(e) => setHolderName(e.target.value)} /></div>
        <div><Label>Serial Number</Label><Input className="mt-1.5 font-mono" value={serial} onChange={(e) => setSerial(e.target.value)} /></div>
        <div><Label>Issuing Authority</Label><Input className="mt-1.5" placeholder="e.g. eMudhra, Capricorn, Sify" value={issuer} onChange={(e) => setIssuer(e.target.value)} /></div>
        <div><Label>Token Type</Label><Input className="mt-1.5" placeholder="e.g. USB Token, Cloud" value={tokenType} onChange={(e) => setTokenType(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Valid From</Label><Input className="mt-1.5" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
          <div><Label>Valid Until</Label><Input className="mt-1.5" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
        </div>
        <div>
          <Label>Token PIN</Label>
          <Input className="mt-1.5" type="password" placeholder={editing?.hasPin ? "Leave blank to keep the existing PIN" : ""} value={pin} onChange={(e) => setPin(e.target.value)} />
        </div>
        <div><Label>Notes</Label><Input className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ClientCredentialsPanel({ clientId }: { clientId: string }) {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [credentials, setCredentials] = useState<ClientPortalCredential[]>([]);
  const [dscRecords, setDscRecords] = useState<ClientDscRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credentialModal, setCredentialModal] = useState<"new" | ClientPortalCredential | null>(null);
  const [dscModal, setDscModal] = useState<"new" | ClientDscRecord | null>(null);

  // (M10) Re-auth gate shared by every RevealField in this panel — see
  // REAUTH_VALID_MS above. reAuthResolveRef holds whichever RevealField's
  // toggle() is currently waiting on the dialog; only one reveal can be
  // in flight at a time since it's a modal.
  const [reAuthOpen, setReAuthOpen] = useState(false);
  const lastVerifiedAtRef = useRef<number | null>(null);
  const reAuthResolveRef = useRef<((ok: boolean) => void) | null>(null);

  const ensureReAuth = (): Promise<boolean> => {
    if (lastVerifiedAtRef.current && Date.now() - lastVerifiedAtRef.current < REAUTH_VALID_MS) {
      return Promise.resolve(true);
    }
    setReAuthOpen(true);
    return new Promise((resolve) => { reAuthResolveRef.current = resolve; });
  };

  const handleReAuthConfirm = async (password: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (signInErr) return false;
    lastVerifiedAtRef.current = Date.now();
    setReAuthOpen(false);
    reAuthResolveRef.current?.(true);
    reAuthResolveRef.current = null;
    return true;
  };

  const handleReAuthCancel = () => {
    setReAuthOpen(false);
    reAuthResolveRef.current?.(false);
    reAuthResolveRef.current = null;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [creds, dsc] = await Promise.all([fetchClientPortalCredentials(clientId), fetchClientDscRecords(clientId)]);
      setCredentials(creds);
      setDscRecords(dsc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load credentials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading && isAdmin) load();
    else if (!roleLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, roleLoading, isAdmin]);

  const handleDeleteCredential = async (id: string) => {
    if (!window.confirm("Delete this credential? This cannot be undone.")) return;
    try {
      await deleteClientPortalCredential(id);
      toast.success("Credential deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete credential");
    }
  };

  const handleDeleteDsc = async (id: string) => {
    if (!window.confirm("Delete this DSC record? This cannot be undone.")) return;
    try {
      await deleteClientDscRecord(id);
      toast.success("DSC record deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete DSC record");
    }
  };

  if (roleLoading || loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" />Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Credentials and DSC records are only available to firm admins.</p>
      </div>
    );
  }

  if (error) return <div className="text-center py-8 text-destructive">{error}</div>;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" />Portal Credentials</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setCredentialModal("new")}><Plus className="h-4 w-4" />Add</Button>
        </CardHeader>
        <CardContent className="p-0">
          {credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No portal credentials saved yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {credentials.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.portalName}</p>
                    <p className="text-xs text-muted-foreground">{c.username || "(no username)"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.hasPassword ? <RevealField reveal={() => revealClientPortalCredential(c.id)} ensureReAuth={ensureReAuth} /> : <span className="text-xs text-muted-foreground">(not set)</span>}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCredentialModal(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCredential(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" />DSC Register</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setDscModal("new")}><Plus className="h-4 w-4" />Add</Button>
        </CardHeader>
        <CardContent className="p-0">
          {dscRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No DSC records saved yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {dscRecords.map((d) => {
                const status = dscExpiryStatus(d.validUntil);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{d.holderName}</p>
                        <Badge variant="secondary" className={`text-[10px] gap-1 ${dscStatusStyle[status]}`}>
                          {status === "expiring_soon" && <AlertTriangle className="h-3 w-3" />}
                          {dscStatusLabel[status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {d.issuingAuthority || "-"} {d.tokenType ? `· ${d.tokenType}` : ""} {d.validUntil ? `· Expires ${new Date(`${d.validUntil}T00:00:00`).toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {d.hasPin ? <RevealField reveal={() => revealClientDscPin(d.id)} ensureReAuth={ensureReAuth} /> : null}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDscModal(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDsc(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={credentialModal !== null} onOpenChange={(open) => !open && setCredentialModal(null)}>
        {credentialModal !== null && (
          <PortalCredentialForm
            key={credentialModal === "new" ? "new" : credentialModal.id}
            clientId={clientId}
            editing={credentialModal === "new" ? null : credentialModal}
            onSaved={() => { setCredentialModal(null); load(); }}
            onCancel={() => setCredentialModal(null)}
          />
        )}
      </Dialog>

      <Dialog open={dscModal !== null} onOpenChange={(open) => !open && setDscModal(null)}>
        {dscModal !== null && (
          <DscRecordForm
            key={dscModal === "new" ? "new" : dscModal.id}
            clientId={clientId}
            editing={dscModal === "new" ? null : dscModal}
            onSaved={() => { setDscModal(null); load(); }}
            onCancel={() => setDscModal(null)}
          />
        )}
      </Dialog>

      <ReAuthDialog open={reAuthOpen} onConfirm={handleReAuthConfirm} onCancel={handleReAuthCancel} />
    </div>
  );
}
