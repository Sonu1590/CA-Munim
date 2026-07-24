import { Mail, Phone, Plus, ShieldCheck, Shield } from "lucide-react";
import { StaffMember } from "@/data/Settings";

const roleIcons = { admin: ShieldCheck, staff: Shield };

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

interface MobileTeamScreenProps {
  staff: StaffMember[];
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  onToggleActive: (id: string) => void;
  onAddStaff: () => void;
}

export function MobileTeamScreen({ staff, loading, error, isAdmin, onToggleActive, onAddStaff }: MobileTeamScreenProps) {
  const activeCount = staff.filter((s) => s.isActive).length;
  const inactiveCount = staff.filter((s) => !s.isActive).length;

  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-8 min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mobile-heading font-normal text-2xl">Team</span>
        {isAdmin && (
          <button
            type="button"
            onClick={onAddStaff}
            aria-label="Add staff member"
            className="w-10 h-10 rounded-full bg-mobile-accent text-white flex items-center justify-center shadow-mobile-sm"
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
        )}
      </div>
      <div className="text-xs text-mobile-neutral-600 mb-4">{activeCount} active, {inactiveCount} inactive</div>

      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600">Loading staff...</div>
        ) : error ? (
          <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-accent-700">{error}</div>
        ) : staff.length === 0 ? (
          <div className="bg-mobile-neutral-100 rounded-mobile-md p-6 text-center text-sm text-mobile-neutral-600">No staff members found.</div>
        ) : (
          staff.map((member) => {
            const RoleIcon = roleIcons[member.role];
            const memberName = member.name || "Staff Member";
            return (
              <div
                key={member.id}
                className={`bg-mobile-neutral-100 rounded-mobile-md p-3.5 shadow-mobile-sm ${!member.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-11 h-11 rounded-full bg-mobile-accent-2-200 text-mobile-accent-2-800 flex items-center justify-center font-bold text-sm">
                    {getInitials(memberName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">
                      {memberName}
                      {member.jobTitle && <span className="text-mobile-neutral-600 font-normal"> · {member.jobTitle}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-mobile-neutral-200 text-mobile-neutral-700 flex items-center gap-1">
                        <RoleIcon className="h-3 w-3" />
                        {member.role === "admin" ? "Admin" : "Staff"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1.5 text-xs text-mobile-neutral-600">
                      <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{member.email || "No email"}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{member.phone || "No phone"}</span>
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[11px] text-mobile-neutral-500">
                      <span>Joined {formatJoinedDate(member.joinedDate)}</span>
                      <span>{member.tasksCompleted} done · {member.tasksPending} pending</span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onToggleActive(member.id)}
                    className={`w-full mt-3 rounded-full py-1.5 text-xs font-bold ${
                      member.isActive
                        ? "bg-mobile-neutral-200 text-mobile-neutral-700"
                        : "bg-mobile-accent text-white"
                    }`}
                  >
                    {member.isActive ? "Mark Inactive" : "Mark Active"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
