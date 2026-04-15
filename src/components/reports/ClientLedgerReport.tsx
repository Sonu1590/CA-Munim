import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { mockClients } from "@/data/mockClients";
import { getClientLedger } from "@/data/mockReports";

export function ClientLedgerReport() {
  const [clientId, setClientId] = useState(mockClients[0]?.id || "");
  const ledger = getClientLedger(clientId);
  const client = mockClients.find((c) => c.id === clientId);
  const balance = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-heading">Client Ledger</CardTitle>
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
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {client && (
          <div className="mb-4 p-3 bg-muted/50 rounded-xl text-sm">
            <p className="font-medium">{client.name}</p>
            <p className="text-xs text-muted-foreground">PAN: {client.pan} · {client.city}, {client.state}</p>
          </div>
        )}

        {ledger.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No invoices or payments found for this client.</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium">Debit (₹)</th>
                    <th className="text-right p-3 font-medium">Credit (₹)</th>
                    <th className="text-right p-3 font-medium">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="p-3 text-muted-foreground">{new Date(e.date).toLocaleDateString("en-IN")}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={e.type === "Invoice" ? "secondary" : "default"} className="text-xs">{e.type}</Badge>
                          <span className="text-sm truncate max-w-[300px]">{e.description}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono">{e.debit > 0 ? e.debit.toLocaleString("en-IN") : "—"}</td>
                      <td className="p-3 text-right font-mono text-green-600">{e.credit > 0 ? e.credit.toLocaleString("en-IN") : "—"}</td>
                      <td className="p-3 text-right font-mono font-medium">{e.balance.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {ledger.map((e, i) => (
                <div key={i} className="border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={e.type === "Invoice" ? "secondary" : "default"} className="text-xs">{e.type}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("en-IN")}</span>
                  </div>
                  <p className="text-xs">{e.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    {e.debit > 0 && <span>Debit: <span className="font-mono font-medium">₹{e.debit.toLocaleString("en-IN")}</span></span>}
                    {e.credit > 0 && <span className="text-green-600">Credit: <span className="font-mono font-medium">₹{e.credit.toLocaleString("en-IN")}</span></span>}
                    <span className="font-medium">Bal: ₹{e.balance.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Summary */}
            <div className={`mt-4 p-3 rounded-xl flex items-center justify-between ${balance > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-green-50 border border-green-200"}`}>
              <span className="text-sm font-medium">Outstanding Balance</span>
              <span className={`text-lg font-bold font-mono ${balance > 0 ? "text-destructive" : "text-green-600"}`}>
                ₹{balance.toLocaleString("en-IN")}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
