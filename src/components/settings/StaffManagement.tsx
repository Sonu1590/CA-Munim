import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Users, Plus, Mail, Phone, Shield, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { fetchStaffFromSupabase, addStaffToSupabase, updateStaffActiveStatus, type StaffMember } from "@/data/Settings";
import { toast } from "sonner";

const roleIcons = { "Senior CA": ShieldCheck, "Article Clerk": Shield, "Admin Staff": ShieldAlert };
const roleColors = { "Senior CA": "bg-primary/10 text-primary", "Article Clerk": "bg-accent/10 text-accent", "Admin Staff": "bg-muted text-muted-foreground" };
const getRole = (role: StaffMember["role"] | string): StaffMember["role"] =>
  role === "Senior CA" || role === "Article Clerk" || role === "Admin Staff" ? role : "Admin Staff";
const getInitials = (name: string) =>
  (name || "Staff Member")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const formatJoinedDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "Not available" : parsed.toLocaleDateString("en-IN");
};

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: "", role: "Article Clerk" as StaffMember["role"], email: "", phone: "" });
  const staffList = Array.isArray(staff) ? staff : [];

  useEffect(() => {
    const loadStaff = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchStaffFromSupabase();
        setStaff(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message ?? "Unable to load staff members");
        setStaff([]);
      } finally {
        setLoading(false);
      }
    };
    loadStaff();
  }, []);

  const toggleActive = async (id: string) => {
    const existing = staff.find((s) => s.id === id);
    if (!existing) return;
    const updated = { ...existing, isActive: !existing.isActive };
    setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    try {
      await updateStaffActiveStatus(id, updated.isActive);
      toast.success("Staff status updated");
    } catch (err: any) {
      setStaff((prev) => prev.map((s) => (s.id === id ? existing : s)));
      toast.error(err.message ?? "Unable to update staff status");
    }
  };

  const handleAdd = async () => {
    if (!newStaff.name.trim() || !newStaff.email.trim()) { toast.error("Name and email are required"); return; }
    try {
      const member = await addStaffToSupabase({
        name: newStaff.name.trim(),
        role: newStaff.role,
        email: newStaff.email.trim(),
        phone: newStaff.phone.trim(),
        isActive: true,
      });
      setStaff((prev) => [...prev, member]);
      setShowAddModal(false);
      setNewStaff({ name: "", role: "Article Clerk", email: "", phone: "" });
      toast.success("Staff member added.", {
        description: `Share the app URL with them to create their login. They should sign up with this email: ${newStaff.email}`,
      });
    } catch (err: any) {
      toast.error(err.message ?? "Unable to add staff member");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Staff Members</h3>
          <p className="text-sm text-muted-foreground">{staffList.filter((s) => s.isActive).length} active, {staffList.filter((s) => !s.isActive).length} inactive</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2"><Plus className="h-4 w-4" />Add Staff</Button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" />Loading staff...</div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">{error}</div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No staff members found.</div>
        ) : staffList.map((member) => {
          const role = getRole(member.role);
          const RoleIcon = roleIcons[role];
          const memberName = member.name || "Staff Member";
          return (
            <Card key={member.id} className={!member.isActive ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {getInitials(memberName)}
                    </div>
                    <div>
                      <p className="font-medium">{memberName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="secondary" className={`gap-1 text-xs ${roleColors[role]}`}>
                          <RoleIcon className="h-3 w-3" />{role}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{member.email || "No email"}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone || "No phone"}</span>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Joined: {formatJoinedDate(member.joinedDate)}</span>
                        <span className="text-green-600">{member.tasksCompleted} completed</span>
                        <span className="text-orange-500">{member.tasksPending} pending</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${member.id}`} className="text-xs">{member.isActive ? "Active" : "Inactive"}</Label>
                      <Switch id={`active-${member.id}`} checked={member.isActive} onCheckedChange={() => toggleActive(member.id)} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Role Permissions Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Role Permissions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm">
            <div className="flex gap-3"><Badge className="bg-primary/10 text-primary gap-1"><ShieldCheck className="h-3 w-3" />Admin</Badge><span className="text-muted-foreground">Full access to everything including billing, settings, and staff management</span></div>
            <div className="flex gap-3"><Badge className="bg-primary/10 text-primary gap-1"><Shield className="h-3 w-3" />Staff</Badge><span className="text-muted-foreground">Can view and update tasks and documents. Cannot access billing or delete records</span></div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name</Label><Input className="mt-1.5" value={newStaff.name} onChange={(e) => setNewStaff((p) => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Role</Label>
              <Select value={newStaff.role} onValueChange={(v) => setNewStaff((p) => ({ ...p, role: v as StaffMember["role"] }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Senior CA">Senior CA</SelectItem>
                  <SelectItem value="Article Clerk">Article Clerk</SelectItem>
                  <SelectItem value="Admin Staff">Admin Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Email</Label><Input className="mt-1.5" type="email" value={newStaff.email} onChange={(e) => setNewStaff((p) => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input className="mt-1.5" value={newStaff.phone} onChange={(e) => setNewStaff((p) => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button><Button onClick={handleAdd}>Add Staff</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
