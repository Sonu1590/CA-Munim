import { mockDocumentRequests } from "@/data/mockDocuments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-accent/20 text-accent border-accent/30",
  submitted: "bg-success/20 text-success border-success/30",
  overdue: "bg-destructive/20 text-destructive border-destructive/30",
};

export function BulkDocumentStatus() {
  const pendingRequests = mockDocumentRequests.filter((r) => r.status !== "submitted");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading">Pending Document Requests</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockDocumentRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium text-sm">{req.clientName}</TableCell>
                  <TableCell className="text-sm">{req.documentType}</TableCell>
                  <TableCell className="text-sm">{new Date(req.dueDate).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[req.status]}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status !== "submitted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/10 gap-1"
                        onClick={() => toast.success(`Reminder sent to ${req.clientName}`)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Remind
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2 p-4">
          {mockDocumentRequests.map((req) => (
            <div key={req.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{req.clientName}</p>
                <Badge variant="outline" className={statusColors[req.status]}>
                  {req.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{req.documentType} • Due: {new Date(req.dueDate).toLocaleDateString("en-IN")}</p>
              {req.status !== "submitted" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/10 gap-1"
                  onClick={() => toast.success(`Reminder sent to ${req.clientName}`)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Send Reminder
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
