import { useState } from "react";
import { Plus, X, Users, ClipboardList, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { cn } from "@/lib/utils";

export function MobileFAB() {
  const [open, setOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    {
      label: "Add Client",
      icon: Users,
      onClick: () => {
        setOpen(false);
        setClientOpen(true);
      },
    },
    {
      label: "Add Task",
      icon: ClipboardList,
      onClick: () => {
        setOpen(false);
        setTaskOpen(true);
      },
    },
    {
      label: "New Invoice",
      icon: Receipt,
      onClick: () => {
        setOpen(false);
        navigate("/billing");
      },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-foreground/20 z-40 animate-in fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="md:hidden fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 font-mobile-body">
        {/* Quick action buttons */}
        {open &&
          actions.map((a, i) => (
            <div
              key={a.label}
              className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="bg-mobile-surface text-mobile-text text-xs font-bold px-2.5 py-1 rounded-mobile-sm shadow-mobile-md border border-mobile-divider">
                {a.label}
              </span>
              <button
                onClick={a.onClick}
                className="h-11 w-11 rounded-full bg-mobile-surface border border-mobile-divider shadow-mobile-md flex items-center justify-center text-mobile-accent-700 hover:bg-mobile-accent-100 transition-colors"
                aria-label={a.label}
              >
                <a.icon className="h-5 w-5" />
              </button>
            </div>
          ))}

        {/* Main FAB */}
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "h-14 w-14 rounded-full bg-mobile-accent text-white shadow-mobile-lg flex items-center justify-center transition-transform",
            open && "rotate-45"
          )}
          aria-label="Quick add"
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      <AddClientModal open={clientOpen} onOpenChange={setClientOpen} />
      <AddTaskModal open={taskOpen} onOpenChange={setTaskOpen} />
    </>
  );
}
