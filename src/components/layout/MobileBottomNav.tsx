import { useState } from "react";
import { Home, Users, ClipboardList, MessageCircle, MoreHorizontal, FolderOpen, Receipt, BarChart3, Settings, Calculator } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const tabs = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Clients", icon: Users, path: "/clients" },
  { label: "Tasks", icon: ClipboardList, path: "/tasks" },
  { label: "WhatsApp", icon: MessageCircle, path: "/whatsapp" },
];

// H14, ISSUES.md — "More" used to hard-redirect to /settings, leaving
// Documents/Billing/Reports/Penalty Calculator with no mobile nav path at
// all. Same labels/icons/paths as DesktopSidebar.tsx's own nav list, so
// "More" is a real menu of everything the bottom nav's 4 fixed tabs don't
// already cover, not a settings shortcut.
const moreItems = [
  { label: "Documents", icon: FolderOpen, path: "/documents" },
  { label: "Billing & Fees", icon: Receipt, path: "/billing" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Penalty Calculator", icon: Calculator, path: "/penalty-calculator" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isMoreActive = moreItems.some((item) => location.pathname.startsWith(item.path));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-mobile-surface border-t border-mobile-divider shadow-mobile-md z-50 font-mobile-body">
        <div className="flex items-center justify-around py-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-bold transition-colors",
                  isActive ? "text-mobile-accent" : "text-mobile-neutral-600"
                )
              }
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-bold transition-colors",
              isMoreActive ? "text-mobile-accent" : "text-mobile-neutral-600"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription className="sr-only">The rest of CA Munim's modules not shown in the bottom nav.</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-1 mt-4">
            {moreItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    isActive ? "bg-accent/10 text-accent" : "text-foreground hover:bg-muted"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
