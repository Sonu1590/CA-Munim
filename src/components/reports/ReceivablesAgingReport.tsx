import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Download, Loader2, IndianRupee, AlertTriangle } from "lucide-react";
import { getReceivablesAging, type ReceivablesAging, type AgingBucketLabel } from "@/data/Reports";
import { downloadHtmlReport, formatINR, slugifyFileName } from "@/lib/downloads";
import { toast } from "sonner";

const chartConfig = {
  amount: { label: "Outstanding", color: "hsl(var(--accent))" },
};

const bucketBadgeStyle: Record<AgingBucketLabel, string> = {
  "Current": "text-muted-foreground",
  "1-30 days": "text-muted-foreground",
  "31-60 days": "text-[hsl(var(--warning))]",
  "61-90 days": "text-destructive",
  "90+ days": "text-destructive font-bold",
};

export function ReceivablesAgingReport() {
  const [aging, setAging] = useState<ReceivablesAging | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getReceivablesAging();
        setAging(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load receivables aging");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const overdue90Plus = aging?.bucketTotals.find((b) => b.label === "90+ days")?.amount ?? 0;

  const downloadReport = () => {
    if (!aging) return;
    downloadHtmlReport(
      `${slugifyFileName("receivables-aging")}.html`,
      "Receivables Aging Report",
      aging.byClient,
      [
        { header: "Client", value: (row) => row.clientName },
        { header: "Current", value: (row) => formatINR(row.buckets["Current"]), align: "right" },
        { header: "1-30 days", value: (row) => formatINR(row.buckets["1-30 days"]), align: "right" },
        { header: "31-60 days", value: (row) => formatINR(row.buckets["31-60 days"]), align: "right" },
        { header: "61-90 days", value: (row) => formatINR(row.buckets["61-90 days"]), align: "right" },
        { header: "90+ days", value: (row) => formatINR(row.buckets["90+ days"]), align: "right" },
        { header: "Total", value: (row) => formatINR(row.total), align: "right" },
      ],
      { "Total outstanding": formatINR(aging.totalOutstanding) },
    );
    toast.success("Receivables aging report downloaded");
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg font-heading">Receivables Aging</CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={downloadReport}
            disabled={loading || !!error || !aging || aging.byClient.length === 0}
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading receivables aging...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : aging && aging.byClient.length > 0 ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IndianRupee className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Total Outstanding</span>
                </div>
                <p className="text-lg font-bold font-heading">{formatINR(aging.totalOutstanding)}</p>
              </div>
              <div className={`border rounded-xl p-4 ${overdue90Plus > 0 ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`h-4 w-4 ${overdue90Plus > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">90+ Days Overdue</span>
                </div>
                <p className={`text-lg font-bold font-heading ${overdue90Plus > 0 ? "text-destructive" : ""}`}>{formatINR(overdue90Plus)}</p>
              </div>
            </div>

            {/* Bucket chart */}
            <div>
              <p className="text-sm font-medium mb-3">Outstanding by Age</p>
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <BarChart data={aging.bucketTotals} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Per-client table */}
            <div>
              <p className="text-sm font-medium mb-3">By Client</p>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium">Client</th>
                      <th className="text-right p-3 font-medium">Current</th>
                      <th className="text-right p-3 font-medium">1-30</th>
                      <th className="text-right p-3 font-medium">31-60</th>
                      <th className="text-right p-3 font-medium">61-90</th>
                      <th className="text-right p-3 font-medium">90+</th>
                      <th className="text-right p-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.byClient.map((row) => (
                      <tr key={row.clientId} className="border-b border-border/50">
                        <td className="p-3 truncate max-w-[200px]">{row.clientName}</td>
                        {(["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"] as AgingBucketLabel[]).map((bucket) => (
                          <td key={bucket} className={`p-3 text-right font-mono ${bucketBadgeStyle[bucket]}`}>
                            {row.buckets[bucket] > 0 ? row.buckets[bucket].toLocaleString("en-IN") : "—"}
                          </td>
                        ))}
                        <td className="p-3 text-right font-mono font-medium">{row.total.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {aging.byClient.map((row) => (
                  <div key={row.clientId} className="border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{row.clientName}</span>
                      <span className="font-mono font-bold text-sm">₹{row.total.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {(["Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"] as AgingBucketLabel[])
                        .filter((bucket) => row.buckets[bucket] > 0)
                        .map((bucket) => (
                          <span key={bucket} className={bucketBadgeStyle[bucket]}>
                            {bucket}: ₹{row.buckets[bucket].toLocaleString("en-IN")}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">No outstanding receivables 🎉</div>
        )}
      </CardContent>
    </Card>
  );
}
