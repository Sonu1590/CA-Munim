import { useState, useEffect } from "react";
import { Home, Users, ClipboardList, FolderOpen, MessageCircle, Receipt, BarChart3, Settings, Calculator, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const navItems = [
  { label: "Dashboard", icon: Home, path: "/" },
  { label: "Clients", icon: Users, path: "/clients" },
  { label: "Tasks & Deadlines", icon: ClipboardList, path: "/tasks" },
  { label: "Documents", icon: FolderOpen, path: "/documents" },
  { label: "WhatsApp Center", icon: MessageCircle, path: "/whatsapp" },
  { label: "Billing & Fees", icon: Receipt, path: "/billing" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Penalty Calculator", icon: Calculator, path: "/penalty-calculator" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

interface FirmInfo {
  firmName: string;
  caName: string;
  icaiNumber: string;
  initials: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Current FY label — auto-calculated
function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  if (month >= 4) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  }
  return `FY ${year - 1}-${String(year).slice(-2)}`;
}

export function DesktopSidebar() {
  const navigate = useNavigate();
  const [firm, setFirm] = useState<FirmInfo>({
    firmName: "",
    caName: "",
    icaiNumber: "",
    initials: "CA",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadFirmInfo() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: staffRow, error: staffError } = await supabase
          .from("staff")
          .select("name, firm_id")
          .eq("auth_user_id", user.id)
          .single();

        if (staffError) {
          console.warn("Unable to load sidebar staff info:", staffError);
          return;
        }

        const staffName = (staffRow as any)?.name || "";
        const firmId = (staffRow as any)?.firm_id;

        let firmData: any = null;
        if (firmId) {
          const { data, error: firmError } = await supabase
            .from("firms")
            .select("name, ca_name, icai_number")
            .eq("id", firmId)
            .single();

          if (firmError) {
            console.warn("Unable to load sidebar firm details:", firmError);
          } else {
            firmData = data;
          }
        }

        const caName = firmData?.ca_name || staffName || user.email || "";
        const firmName = firmData?.name || "";
        const icaiNumber = firmData?.icai_number || "";

        setFirm({
          firmName,
          caName,
          icaiNumber,
          initials: getInitials(caName),
        });
      } finally {
        setLoaded(true);
      }
    }

    loadFirmInfo();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Logout failed. Please try again.");
    } else {
      navigate("/login");
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card min-h-screen">
      {/* Firm branding */}
      <div className="p-5 border-b border-border">
        <h1 className="text-xl font-heading font-bold text-primary">CA Munim</h1>
        <p className="text-sm text-muted-foreground mt-0.5 truncate">
          {loaded ? (firm.firmName || firm.caName || "Your practice") : "Loading..."}
        </p>
        <span className="inline-block mt-2 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">
          {getCurrentFY()}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
            {firm.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {loaded ? (firm.caName || "Setup your profile") : "Loading..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {firm.icaiNumber ? `M.No. ${firm.icaiNumber}` : "CA"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
