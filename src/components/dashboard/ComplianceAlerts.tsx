import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ComplianceAlert {
  id: string;
  filingType: string;
  dueDate: string;
  clientsAffected: number;
  daysUntilDue: number;
  urgency: "safe" | "upcoming" | "overdue";
}

interface ComplianceAlertsProps {
  alerts?: ComplianceAlert[];
}

const statusStyles = {
  overdue: "border-destructive/30 bg-destructive/5",
  urgent: "border-accent/30 bg-accent/5",
  upcoming: "border-warning/30 bg-warning/5",
  safe: "border-success/30 bg-success/5",
};

const dotStyles = {
  overdue: "bg-destructive",
  urgent: "bg-accent",
  upcoming: "bg-warning",
  safe: "bg-success",
};

function formatDueDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ComplianceAlerts({ alerts }: ComplianceAlertsProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // L12, ISSUES.md — was scrollbar-none with no arrows and no peek hint,
  // so a user had to accidentally discover the horizontal scroll existed.
  // Tracks scroll position so the arrow buttons/edge fade only render when
  // there's actually more content in that direction.
  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
  }, [alerts]);

  const scrollByCard = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * 236, behavior: "smooth" });
  };

  // Show placeholder cards while loading
  if (!alerts || alerts.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-heading font-semibold mb-3">Today's Compliance Alerts</h2>
        <div className="text-sm text-muted-foreground bg-card rounded-lg p-6 text-center card-shadow">
          No upcoming compliance deadlines in the next 30 days.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">Today's Compliance Alerts</h2>
      {/* lg+: wraps into a grid instead of forcing horizontal scroll at
          all, per the review's own suggestion — most desktop-width
          screens have room to just show every alert. Below lg, the
          arrows + right-edge fade make the still-scrollable list's
          affordance obvious (swipe already worked natively; keyboard
          users tabbing through each card's "Send Reminder" button get
          the browser's native scroll-focused-element-into-view). */}
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll compliance alerts left"
            onClick={() => scrollByCard(-1)}
            className="lg:hidden absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-card border border-border shadow-md hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {canScrollRight && (
          <>
            <button
              type="button"
              aria-label="Scroll compliance alerts right"
              onClick={() => scrollByCard(1)}
              className="lg:hidden absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-card border border-border shadow-md hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="lg:hidden pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-background to-transparent" />
          </>
        )}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none scroll-smooth lg:grid lg:grid-cols-3 lg:overflow-visible"
        >
          {alerts.map((a) => {
            // Map urgency — treat "upcoming" with ≤ 7 days as urgent visually
            const visualStatus =
              a.urgency === "overdue"
                ? "overdue"
                : a.daysUntilDue <= 7
                ? "urgent"
                : a.daysUntilDue <= 30
                ? "upcoming"
                : "safe";

            return (
              <div
                key={a.id}
                className={cn(
                  "min-w-[200px] md:min-w-[220px] lg:min-w-0 border rounded-lg p-4 shrink-0 lg:shrink",
                  statusStyles[visualStatus]
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("h-2 w-2 rounded-full", dotStyles[visualStatus])} />
                  <span className="font-heading font-semibold text-sm">{a.filingType}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Due: {formatDueDate(a.dueDate)}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {a.clientsAffected} client{a.clientsAffected !== 1 ? "s" : ""} affected
                </p>
                {a.daysUntilDue < 0 && (
                  <p className="text-xs text-destructive font-medium mb-2">
                    {Math.abs(a.daysUntilDue)} days overdue
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/whatsapp?tab=bulk")}
                  className="flex items-center gap-1.5 text-xs font-medium bg-whatsapp text-whatsapp-foreground px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity w-full justify-center"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Send Reminder
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
