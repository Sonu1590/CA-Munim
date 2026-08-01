import { Client } from "@/hooks/useClients";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageCircle, Pencil, Eye } from "lucide-react";

interface ClientListTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onView: (client: Client) => void;
}

// Same wa.me convention as MobileClientsScreen.tsx's waLink() — assumes a
// 10-digit number is a domestic Indian mobile and prefixes the country code.
function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountryCode}`;
}

export function ClientListTable({ clients, onEdit, onView }: ClientListTableProps) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-md border">
      {/* M36, ISSUES.md — round 5: the real bug behind the Client Name
          column reading "Aarav Tr…" wasn't the column width at all — it
          was a hardcoded `max-w-[14rem]` (224px) on the name `<span>`
          itself from the M43 pass, which capped the visible name at a
          fixed pixel width regardless of how much room the column
          actually had, badge-beside-name or not. Fixed at the root:
          dropped that cap, and restructured to match the stacked
          name/type-sub-label pattern `ComplianceStatusReport.tsx`
          already uses (type as a plain line under the name, not beside
          it) — frees the width the badge used to take from the name's
          own line, and now Name genuinely gets the most space (30%) of
          any column, PAN/Phone/Pending Fees next, Last Activity (hidden
          below `xl`) and Actions least, explicit percentages summing to
          100% so nothing is negotiating or silently absorbing leftover
          space. `title` gives a native tooltip for the rare name that's
          still too long for 30% of the table. */}
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Client Name</TableHead>
            <TableHead className="w-[15%]">PAN</TableHead>
            <TableHead className="w-[15%]">Phone</TableHead>
            <TableHead className="w-[8%] text-center">Active Tasks</TableHead>
            <TableHead className="w-[12%] text-right">Pending Fees</TableHead>
            <TableHead className="w-[12%] hidden xl:table-cell whitespace-nowrap">Last Activity</TableHead>
            <TableHead className="w-[8%] sticky right-0 z-10 bg-background text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="group cursor-pointer" onClick={() => onView(client)}>
              <TableCell>
                <div className="min-w-0" title={client.name}>
                  <p className="font-medium truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.type}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs tracking-wider">
                  {client.pan}
                </span>
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">{client.phone}</TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="text-xs">
                  {client.activeTasks}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={
                    client.feesOverdue
                      ? "text-destructive font-semibold"
                      : "text-foreground"
                  }
                >
                  ₹{client.pendingFees.toLocaleString("en-IN")}
                </span>
              </TableCell>
              <TableCell className="hidden xl:table-cell text-sm text-muted-foreground whitespace-nowrap">
                {new Date(client.lastActivity).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="sticky right-0 z-10 bg-background text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)] group-hover:bg-muted/50">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-[hsl(var(--whatsapp))] hover:text-[hsl(var(--whatsapp))] hover:bg-[hsl(var(--whatsapp))]/10"
                    title="WhatsApp"
                    aria-label={`Send WhatsApp message to ${client.name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <a href={waLink(client.phone)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    title="Edit"
                    aria-label={`Edit ${client.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(client);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    title="View"
                    aria-label={`View ${client.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onView(client);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
