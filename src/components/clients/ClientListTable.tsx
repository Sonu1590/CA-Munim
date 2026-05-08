import { Client } from "@/data/Clients";
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

export function ClientListTable({ clients, onEdit }: ClientListTableProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client Name</TableHead>
            <TableHead>PAN</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-center">Active Tasks</TableHead>
            <TableHead className="text-right">Pending Fees</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="group">
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{client.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
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
              <TableCell className="text-sm">{client.phone}</TableCell>
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
              <TableCell className="text-sm text-muted-foreground">
                {new Date(client.lastActivity).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[hsl(var(--whatsapp))] hover:text-[hsl(var(--whatsapp))] hover:bg-[hsl(var(--whatsapp))]/10"
                    title="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Edit"
                    onClick={() => onEdit(client)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="View"
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
