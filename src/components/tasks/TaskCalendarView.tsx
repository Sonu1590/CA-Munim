import { useState } from "react";
import { Task, taskTypeIcons } from "@/data/mockTasks";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths, differenceInDays, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-heading font-semibold">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
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
                  className={`relative flex flex-col items-center justify-start p-1.5 rounded-lg min-h-[52px] text-sm transition-colors hover:bg-muted ${
                    isToday ? "bg-primary/10 font-bold text-primary" : ""
                  } ${!isSameMonth(day, currentMonth) ? "text-muted-foreground" : ""}`}
                >
                  <span className="text-xs">{format(day, "d")}</span>
                  {dayTasks.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {dayTasks.slice(0, 3).map((t) => (
                        <div key={t.id} className={`h-1.5 w-1.5 rounded-full ${getDotColor(t.dueDate, t.status)}`} />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              </PopoverTrigger>
              {dayTasks.length > 0 && (
                <PopoverContent className="w-64 p-3" align="center">
                  <p className="text-xs font-semibold mb-2">{format(day, "dd MMM yyyy")}</p>
                  <div className="space-y-2">
                    {dayTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs">
                        <span>{taskTypeIcons[t.taskType] || "⚡"}</span>
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
