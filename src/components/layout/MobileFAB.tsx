import { useState } from "react";
import { Plus, X, Users, ClipboardList, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AddClientModal } from "@/components/clients/AddClientModal";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";

export function MobileFAB() {
  const [open, setOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const navigate = useNavigate();
  // Own data connections rather than receiving them from whichever page
  // happens to be mounted — this FAB renders globally on every page.
  const { addClient } = useClients();
  const { addTask } = useTasks();

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

      {/* bottom-24 (H15, ISSUES.md) — was bottom-20, sitting flush against
          the bottom nav with no visual clearance. */}
      <div className="md:hidden fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 font-mobile-body">
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

      <AddClientModal
        open={clientOpen}
        onOpenChange={setClientOpen}
        onSave={async (formData) => {
          const result = await addClient(formData);
          if (result.success) {
            toast.success("Client added");
            setClientOpen(false);
          } else {
            toast.error(result.error ?? "Could not save client. Please check the details and try again.");
          }
          return result;
        }}
      />
      <AddTaskModal
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onSave={async (taskData) => {
          const success = await addTask(taskData);
          if (success) {
            toast.success("Task created successfully");
            setTaskOpen(false);
          } else {
            toast.error("Failed to add task. Please try again.");
          }
        }}
      />
    </>
  );
}
