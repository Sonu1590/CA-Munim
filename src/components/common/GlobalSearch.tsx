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
import { mockClients } from "@/data/mockClients";
import { mockTasks } from "@/data/mockTasks";
import { mockInvoices } from "@/data/mockBilling";
import { Users, ClipboardList, Receipt } from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

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
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Clients">
          {mockClients.slice(0, 20).map((c) => (
            <CommandItem
              key={`c-${c.id}`}
              value={`client ${c.name} ${c.pan} ${c.phone}`}
              onSelect={() => go("/clients")}
            >
              <Users className="mr-2 h-4 w-4 text-primary" />
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{c.pan}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Tasks">
          {mockTasks.slice(0, 20).map((t) => (
            <CommandItem
              key={`t-${t.id}`}
              value={`task ${t.taskName} ${t.clientName}`}
              onSelect={() => go("/tasks")}
            >
              <ClipboardList className="mr-2 h-4 w-4 text-primary" />
              <span className="flex-1">{t.taskName}</span>
              <span className="text-xs text-muted-foreground">{t.clientName}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Invoices">
          {mockInvoices.slice(0, 20).map((i) => (
            <CommandItem
              key={`i-${i.id}`}
              value={`invoice ${i.invoiceNumber} ${i.clientName}`}
              onSelect={() => go("/billing")}
            >
              <Receipt className="mr-2 h-4 w-4 text-primary" />
              <span className="flex-1">{i.invoiceNumber}</span>
              <span className="text-xs text-muted-foreground">{i.clientName}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
