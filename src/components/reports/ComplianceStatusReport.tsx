import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { getComplianceData, type FilingStatus, type ClientComplianceRow } from "@/data/Reports";
import { financialYears } from "@/data/Tasks";

const statusIcon: Record<FilingStatus, { label: string; className: string }> = {
  filed: { label: "✅ Filed", className: "bg-green-100 text-green-800 border-green-200" },
  pending: { label: "⏳ Pending", className: "bg-orange-100 text-orange-800 border-orange-200" },
  overdue: { label: "❌ Overdue", className: "bg-red-100 text-red-800 border-red-200" },
  na: { label: "— N/A", className: "bg-muted text-muted-foreground" },
};

export function ComplianceStatusReport() {
  const [fy, setFy] = useState("FY 2025-26");
  const [data, setData] = useState<ClientComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const report = await getComplianceData(fy);
        setData(report);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load compliance data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fy]);

  const StatusBadge = ({ status }: { status: FilingStatus }) => (
    <Badge variant="outline" className={`text-xs font-medium ${statusIcon[status].className}`}>
      {statusIcon[status].label}
    </Badge>
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-heading">Client Compliance Status</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {financialYears.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading compliance data...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : (
          <>
            {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium">Client</th>
                <th className="text-center p-3 font-medium">GSTR-1</th>
                <th className="text-center p-3 font-medium">GSTR-3B</th>
                <th className="text-center p-3 font-medium">ITR</th>
                <th className="text-center p-3 font-medium">TDS</th>
                <th className="text-center p-3 font-medium">ROC</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.clientId} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3">
                    <p className="font-medium">{row.clientName}</p>
                    <p className="text-xs text-muted-foreground">{row.clientType}</p>
                  </td>
                  <td className="p-3 text-center"><StatusBadge status={row.gstr1} /></td>
                  <td className="p-3 text-center"><StatusBadge status={row.gstr3b} /></td>
                  <td className="p-3 text-center"><StatusBadge status={row.itr} /></td>
                  <td className="p-3 text-center"><StatusBadge status={row.tds} /></td>
                  <td className="p-3 text-center"><StatusBadge status={row.roc} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 p-4">
            {data.map((row) => (
              <div key={row.clientId} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{row.clientName}</p>
                    <p className="text-xs text-muted-foreground">{row.clientType}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">GSTR-1</span>
                    <StatusBadge status={row.gstr1} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">GSTR-3B</span>
                    <StatusBadge status={row.gstr3b} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">ITR</span>
                    <StatusBadge status={row.itr} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">TDS</span>
                    <StatusBadge status={row.tds} />
                  </div>
                  <div className="flex items-center justify-between text-xs col-span-2">
                    <span className="text-muted-foreground">ROC</span>
                    <StatusBadge status={row.roc} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
