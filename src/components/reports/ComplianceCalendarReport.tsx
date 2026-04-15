import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Calendar } from "lucide-react";
import { mockClients } from "@/data/mockClients";
import { dueDateRules } from "@/data/mockTasks";

const calendarMonths = [
  { month: "April", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "GSTR-4"] },
  { month: "May", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "24Q", "26Q"] },
  { month: "June", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "Form 16", "Advance Tax"] },
  { month: "July", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "ITR Filing"] },
  { month: "August", filings: ["GSTR-1", "GSTR-3B", "TDS Challan"] },
  { month: "September", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "DIR-3 KYC"] },
  { month: "October", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "ITR Filing"] },
  { month: "November", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "MGT-7"] },
  { month: "December", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "GSTR-9"] },
  { month: "January", filings: ["GSTR-1", "GSTR-3B", "TDS Challan"] },
  { month: "February", filings: ["GSTR-1", "GSTR-3B", "TDS Challan"] },
  { month: "March", filings: ["GSTR-1", "GSTR-3B", "TDS Challan", "Advance Tax"] },
];

export function ComplianceCalendarReport() {
  const [clientId, setClientId] = useState(mockClients[0]?.id || "");
  const client = mockClients.find((c) => c.id === clientId);

  const applicableFilings = (filings: string[]) => {
    if (!client) return filings;
    return filings.filter((f) => {
      if (["GSTR-1", "GSTR-3B", "GSTR-9", "GSTR-4"].includes(f)) return client.servicesSubscribed.includes("GST Returns");
      if (["ITR Filing"].includes(f)) return client.servicesSubscribed.includes("ITR Filing");
      if (["TDS Challan", "24Q", "26Q", "Form 16"].includes(f)) return client.servicesSubscribed.includes("TDS Returns");
      if (["MGT-7", "AOC-4", "DIR-3 KYC"].includes(f)) return client.servicesSubscribed.includes("ROC / MCA Compliance");
      if (f === "Advance Tax") return client.servicesSubscribed.includes("ITR Filing");
      return true;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-heading">Compliance Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {mockClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {client && (
          <div className="mb-4 p-3 bg-primary/5 rounded-xl text-sm border border-primary/10">
            <p className="font-medium">{client.name}</p>
            <p className="text-xs text-muted-foreground">Services: {client.servicesSubscribed.join(", ")}</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {calendarMonths.map((m) => {
            const filings = applicableFilings(m.filings);
            return (
              <div key={m.month} className="border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{m.month}</span>
                </div>
                {filings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No filings applicable</p>
                ) : (
                  <ul className="space-y-1.5">
                    {filings.map((f) => (
                      <li key={f} className="text-xs flex items-start gap-2">
                        <span className="text-accent mt-0.5">●</span>
                        <div>
                          <span className="font-medium">{f}</span>
                          {dueDateRules[f] && (
                            <p className="text-muted-foreground">{dueDateRules[f]}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
