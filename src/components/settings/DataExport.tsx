import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Users, ClipboardList, Receipt, Archive } from "lucide-react";
import { toast } from "sonner";

const exports = [
  { label: "Export All Clients", desc: "Download client master list with all details", icon: Users, format: "CSV" },
  { label: "Export All Tasks", desc: "Download complete task history with statuses", icon: ClipboardList, format: "Excel" },
  { label: "Export All Invoices", desc: "Download invoice register with payment status", icon: Receipt, format: "CSV" },
];

export function DataExport() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Data & Export</h3>
        <p className="text-sm text-muted-foreground">Export your data or request a full backup</p>
      </div>

      <div className="grid gap-4">
        {exports.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success(`${item.format} file download started`)}>
                <Download className="h-4 w-4" />{item.format}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Archive className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h4 className="font-medium">Request Full Data Backup</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Download a ZIP file containing all your data — clients, tasks, documents, invoices, and settings</p>
          <Button variant="outline" className="gap-2" onClick={() => toast.success("Backup request submitted. You'll receive a download link via email.")}>
            <Download className="h-4 w-4" />Request Backup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
