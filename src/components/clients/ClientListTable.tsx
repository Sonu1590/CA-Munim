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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientListTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onView: (client: Client) => void;
}

const typeBadgeColor: Record<string, string> = {
  Individual: "bg-blue-100 text-blue-700",
  HUF: "bg-violet-100 text-violet-700",
  "Sole Proprietor": "bg-teal-100 text-teal-700",
  Partnership: "bg-amber-100 text-amber-800",
  LLP: "bg-orange-100 text-orange-700",
  "Private Ltd": "bg-indigo-100 text-indigo-700",
  "Public Ltd": "bg-purple-100 text-purple-700",
  Trust: "bg-emerald-100 text-emerald-700",
  Society: "bg-pink-100 text-pink-700",
  AOP: "bg-cyan-100 text-cyan-700",
  BOI: "bg-rose-100 text-rose-700",
};

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
      {/* M43/M36, ISSUES.md — round 3: the table-fixed + min-w-[1040px]
          fix from round 2 wasn't actually a CSS clipping bug — it made
          the table genuinely wider than a viewport narrower than
          ~1040px, so whatever column sat at the edge of what was
          actually visible (without the user scrolling right) rendered
          as a partial glyph, which read exactly like clipping and kept
          shifting between rounds as the column widths changed. Fixed
          for real this time by not requiring horizontal scroll at all
          below `xl` (1280px): Last Activity — the least-valuable column
          on this row, PAN/Phone/Pending Fees all earn their space more
          — is hidden entirely under that width instead of fighting for
          it, so the table just fits. Client Name is the one column
          without an explicit width, so it absorbs whatever's left of
          the table's 100% width per the CSS table-layout:fixed spec. */}
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Client Name</TableHead>
            <TableHead className="w-[130px]">PAN</TableHead>
            <TableHead className="w-[140px]">Phone</TableHead>
            <TableHead className="w-[110px] text-center">Active Tasks</TableHead>
            <TableHead className="w-[130px] text-right">Pending Fees</TableHead>
            <TableHead className="w-[120px] hidden xl:table-cell whitespace-nowrap">Last Activity</TableHead>
            <TableHead className="w-[140px] sticky right-0 z-10 bg-background text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.45)]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="group cursor-pointer" onClick={() => onView(client)}>
              <TableCell>
                {/* M43, ISSUES.md — a long name (e.g. with a "Private Ltd"
                    suffix, or a raw seed-data id) used to wrap to two
                    lines and wrap the type badge mid-word with it.
                    Truncate the name with a tooltip for the full value;
                    the badge stays on one line and never shrinks. */}
                <div className="flex items-center gap-2 min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium truncate max-w-[14rem]">{client.name}</span>
                    </TooltipTrigger>
                    <TooltipContent>{client.name}</TooltipContent>
                  </Tooltip>
                  <span
                    className={`shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      typeBadgeColor[client.type] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {client.type}
                  </span>
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
              <TableCell className="w-[120px] hidden xl:table-cell text-sm text-muted-foreground whitespace-nowrap">
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
