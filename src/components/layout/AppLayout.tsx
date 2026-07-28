import { ReactNode } from "react";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileFAB } from "./MobileFAB";
import { usePwaUsageSignal } from "@/hooks/usePwaUsageSignal";

export function AppLayout({ children }: { children: ReactNode }) {
  usePwaUsageSignal();

  return (
    <div className="min-h-screen flex w-full">
      <DesktopSidebar />
      {/* pb-28 (H15, ISSUES.md) — was pb-20, which exactly matched the
          bottom nav's own height with no room for the floating FAB on top
          of it. Since MobileFAB is `position: fixed`, it covers whatever
          content happens to render at its screen coordinates whenever
          scrolled into that range, not just the very end of a list — the
          extra padding gives the last card's content genuine clearance
          from both the nav and the FAB once scrolled to the bottom. */}
      <main className="flex-1 pb-28 md:pb-0 overflow-auto">
        {children}
      </main>
      <MobileFAB />
      <MobileBottomNav />
    </div>
  );
}

