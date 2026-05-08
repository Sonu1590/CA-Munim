import { Client } from "@/data/Clients";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Pencil, Eye, Phone } from "lucide-react";
import { motion } from "framer-motion";

interface ClientCardsProps {
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
};

export function ClientCards({ clients, onEdit }: ClientCardsProps) {
  return (
    <div className="md:hidden space-y-3">
      {clients.map((client, i) => (
        <motion.div
          key={client.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
        >
          <Card className="card-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-heading font-semibold text-sm">
                    {client.name}
                  </h3>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium inline-block mt-1 ${
                      typeBadgeColor[client.type] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {client.type}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[hsl(var(--whatsapp))]"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(client)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 text-xs mt-3">
                <div className="text-muted-foreground">PAN</div>
                <div className="font-mono tracking-wider text-right">
                  {client.pan}
                </div>
                <div className="text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </div>
                <div className="text-right">{client.phone}</div>
                <div className="text-muted-foreground">Active Tasks</div>
                <div className="text-right">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {client.activeTasks}
                  </Badge>
                </div>
                <div className="text-muted-foreground">Pending Fees</div>
                <div
                  className={`text-right font-medium ${
                    client.feesOverdue ? "text-destructive" : ""
                  }`}
                >
                  ₹{client.pendingFees.toLocaleString("en-IN")}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
