import { useState } from "react";
import { Task } from "@/data/Tasks";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths, differenceInDays, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskTypeIcon } from "./TaskTypeIcon";

interface Props {
  tasks: Task[];
}

function getDotColor(dueDate: string, status: string) {
  if (status === "completed") return "bg-green-500";
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return "bg-red-500";
  if (days <= 7) return "bg-orange-500";
  return "bg-green-500";
}

// M42, ISSUES.md — the same red/orange/green severity scheme as
// getDueDateBadgeClasses (lib/taskDisplay.ts), so a day's count pill uses
// the same colors as the due-date badges shown everywhere else in Tasks.
const severityRank: Record<string, number> = { "bg-red-500": 3, "bg-orange-500": 2, "bg-green-500": 1 };

function getDayBadgeClasses(dayTasks: Task[]) {
  const worst = dayTasks.reduce(
    (acc, t) => {
      const dot = getDotColor(t.dueDate, t.status);
      return severityRank[dot] > severityRank[acc] ? dot : acc;
    },
    "bg-green-500",
  );
  if (worst === "bg-red-500") return "bg-red-100 text-red-700";
  if (worst === "bg-orange-500") return "bg-orange-100 text-orange-700";
  return "bg-green-100 text-green-700";
}

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TaskCalendarView({ tasks }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const getTasksForDay = (day: Date) =>
    tasks.filter((t) => isSameDay(parseISO(t.dueDate), day));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Previous month" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-heading font-semibold">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Next month" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
        ))}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const dayTasks = getTasksForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <Popover key={day.toISOString()}>
              <PopoverTrigger asChild>
                <button
                  className={`relative flex flex-col items-center justify-start gap-1 p-1.5 rounded-lg min-h-[52px] text-sm transition-colors hover:bg-muted ${
                    isToday ? "ring-2 ring-primary bg-primary/5" : ""
                  } ${!isSameMonth(day, currentMonth) ? "text-muted-foreground" : ""}`}
                >
                  {/* M42, ISSUES.md — today was only a light bg-primary/10
                      tint, easy to miss; a solid circle around the date
                      number (plus the ring above) is a much stronger,
                      more conventional "today" marker. */}
                  <span
                    className={
                      isToday
                        ? "flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold"
                        : "text-xs"
                    }
                  >
                    {format(day, "d")}
                  </span>
                  {/* M42, ISSUES.md — was up to 3 dots + a "+N" overflow
                      label, which made a busy day (e.g. "+74") barely
                      readable. A single count pill, tinted by the day's
                      worst severity, is legible at any task count. */}
                  {dayTasks.length > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold ${getDayBadgeClasses(dayTasks)}`}
                    >
                      {dayTasks.length}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              {dayTasks.length > 0 && (
                <PopoverContent className="w-64 p-3" align="center">
                  <p className="text-xs font-semibold mb-2">{format(day, "dd MMM yyyy")}</p>
                  <div className="space-y-2">
                    {dayTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <TaskTypeIcon taskType={t.taskType} className="h-3.5 w-3.5" />
                        <div>
                          <p className="font-medium">{t.taskType}</p>
                          <p className="text-muted-foreground">{t.clientName}</p>
                        </div>
                        <div className={`ml-auto h-2 w-2 rounded-full ${getDotColor(t.dueDate, t.status)}`} />
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500" /> Filed / 7+ days
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-orange-500" /> Due soon
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-red-500" /> Overdue
        </div>
      </div>
    </div>
  );
}
