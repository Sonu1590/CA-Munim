import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Users, ClipboardList, Receipt, Loader2 } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import { useBilling } from "@/hooks/useBilling";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // ── Real data from Supabase ──────────────────────────────────────────────
  const { clients, loading: loadingClients } = useClients();
  const { tasks, loading: loadingTasks } = useTasks();
  const { invoices, loading: loadingInvoices } = useBilling();

  const loading = loadingClients || loadingTasks || loadingInvoices;

  // ── Keyboard shortcut ────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search clients, tasks, invoices… (⌘K)" />
      <CommandList>
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>

            {/* ── Clients ── */}
            {clients.length > 0 && (
              <CommandGroup heading="Clients">
                {clients.slice(0, 20).map((c) => (
                  <CommandItem
                    key={`c-${c.id}`}
                    value={`client ${c.name} ${c.pan} ${c.phone}`}
                    onSelect={() => go("/clients")}
                  >
                    <Users className="mr-2 h-4 w-4 text-primary" />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {c.pan}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* ── Tasks ── */}
            {tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {tasks.slice(0, 20).map((t) => {
                  const name = t.customName || t.taskType;
                  return (
                    <CommandItem
                      key={`t-${t.id}`}
                      value={`task ${name} ${t.clientName}`}
                      onSelect={() => go("/tasks")}
                    >
                      <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                      <span className="flex-1">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.clientName}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* ── Invoices ── */}
            {invoices.length > 0 && (
              <CommandGroup heading="Invoices">
                {invoices.slice(0, 20).map((i) => (
                  <CommandItem
                    key={`i-${i.id}`}
                    value={`invoice ${i.invoiceNumber} ${i.clientName}`}
                    onSelect={() => go("/billing")}
                  >
                    <Receipt className="mr-2 h-4 w-4 text-primary" />
                    <span className="flex-1">{i.invoiceNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {i.clientName}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Empty state when DB has no data yet */}
            {!loading &&
              clients.length === 0 &&
              tasks.length === 0 &&
              invoices.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No data yet. Add clients and tasks to search them here.
                </div>
              )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
