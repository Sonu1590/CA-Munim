import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, CheckCircle2, IndianRupee, TrendingUp } from "lucide-react";
import { getFYSummary } from "@/data/mockReports";
import { financialYears } from "@/data/mockTasks";

const chartConfig = {
  billed: { label: "Billed", color: "hsl(var(--primary))" },
  collected: { label: "Collected", color: "hsl(var(--accent))" },
};

export function FYSummaryReport() {
  const [fy, setFy] = useState("FY 2025-26");
  const summary = getFYSummary(fy);

  const metrics = [
    { label: "Total Clients", value: summary.totalClients, icon: Users, color: "text-primary" },
    { label: "Filings Completed", value: summary.totalFilings, icon: CheckCircle2, color: "text-green-600" },
    { label: "Total Invoiced", value: `₹${summary.totalInvoiced.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-primary" },
    { label: "Total Collected", value: `₹${summary.totalCollected.toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-green-600" },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-heading">Financial Year Summary</CardTitle>
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-lg font-bold font-heading">{m.value}</p>
            </div>
          ))}
        </div>
        {/* Pending collection */}
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-medium">Pending Collection</span>
          <span className="text-lg font-bold text-destructive">₹{summary.pendingCollection.toLocaleString("en-IN")}</span>
        </div>
        {/* Monthly chart */}
        <div>
          <p className="text-sm font-medium mb-3">Monthly Fees: Billed vs Collected</p>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={summary.monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="billed" fill="var(--color-billed)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" fill="var(--color-collected)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
