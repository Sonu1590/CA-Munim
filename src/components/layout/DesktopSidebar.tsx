import { Home, Users, ClipboardList, FolderOpen, MessageCircle, Receipt, BarChart3, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: Home, path: "/" },
  { label: "Clients", icon: Users, path: "/clients" },
  { label: "Tasks & Deadlines", icon: ClipboardList, path: "/tasks" },
  { label: "Documents", icon: FolderOpen, path: "/documents" },
  { label: "WhatsApp Center", icon: MessageCircle, path: "/whatsapp" },
  { label: "Billing & Fees", icon: Receipt, path: "/billing" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function DesktopSidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card min-h-screen">
      {/* Firm branding */}
      <div className="p-5 border-b border-border">
        <h1 className="text-xl font-heading font-bold text-primary">CA Munim</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sharma & Associates</p>
        <span className="inline-block mt-2 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">
          FY 2025-26
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
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

      {/* User info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
            RS
          </div>
          <div>
            <p className="text-sm font-medium">CA Rajesh Sharma</p>
            <p className="text-xs text-muted-foreground">M.No. 123456</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
