import { ReactNode } from "react";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex w-full">
      <DesktopSidebar />
      <main className="flex-1 pb-20 md:pb-0 overflow-auto">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
