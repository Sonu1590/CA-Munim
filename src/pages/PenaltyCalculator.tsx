import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, AlertTriangle, IndianRupee } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { filingTypes, calculatePenalty } from "@/lib/penaltyRules";
import { FYHint } from "@/components/common/FYHint";
import { Badge } from "@/components/ui/badge";

const GST_FILING_IDS = ["gstr3b", "gstr1", "gstr9"];

export default function PenaltyCalculator() {
  const [filingId, setFilingId] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [actualDate, setActualDate] = useState<Date>();
  const [turnover, setTurnover] = useState("");
  const [isNilReturn, setIsNilReturn] = useState(false);
  const [incomeBelow5L, setIncomeBelow5L] = useState(false);
  const [actualShortfall, setActualShortfall] = useState("");

  const isGstFiling = GST_FILING_IDS.includes(filingId);

  const result = useMemo(() => {
    if (!filingId || !dueDate || !actualDate) return null;
    return calculatePenalty(filingId, dueDate, actualDate, {
      turnover: Number(turnover) || 0,
      isNilReturn,
      incomeBelow5L,
      actualShortfall: Number(actualShortfall) || 0,
    });
  }, [filingId, dueDate, actualDate, turnover, isNilReturn, incomeBelow5L, actualShortfall]);

  const selectedFiling = filingTypes.find((f) => f.id === filingId);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl md:text-2xl font-heading font-bold">Penalty Calculator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estimate late filing penalties under Indian tax & company law (illustrative).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">Filing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Filing Type</Label>
              <Select value={filingId} onValueChange={setFilingId}>
                <SelectTrigger><SelectValue placeholder="Select filing type" /></SelectTrigger>
                <SelectContent>
                  {filingTypes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Original Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "dd/MM/yyyy") : "Pick due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <FYHint date={dueDate} />
              </div>
              <div>
                <Label>Actual Filing Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !actualDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {actualDate ? format(actualDate, "dd/MM/yyyy") : "Pick actual date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={actualDate} onSelect={setActualDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <FYHint date={actualDate} />
              </div>
            </div>

            {isGstFiling && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Checkbox id="nilReturn" checked={isNilReturn} onCheckedChange={(v) => setIsNilReturn(v === true)} />
                  <Label htmlFor="nilReturn" className="font-normal cursor-pointer">This is a nil return (₹20/day, capped at ₹500)</Label>
                </div>
                {!isNilReturn && (
                  <div>
                    <Label>Annual Turnover (₹)</Label>
                    <Input type="number" placeholder="e.g. 8000000" value={turnover} onChange={(e) => setTurnover(e.target.value)} className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Determines the late-fee cap slab.</p>
                  </div>
                )}
              </div>
            )}

            {filingId === "itr" && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Checkbox id="incomeBelow5L" checked={incomeBelow5L} onCheckedChange={(v) => setIncomeBelow5L(v === true)} />
                <Label htmlFor="incomeBelow5L" className="font-normal cursor-pointer">Total income ≤ ₹5 lakh (caps penalty at ₹1,000)</Label>
              </div>
            )}

            {filingId === "advTax" && (
              <div className="pt-2 border-t">
                <Label>Actual Tax Shortfall (₹)</Label>
                <Input type="number" placeholder="e.g. 45000" value={actualShortfall} onChange={(e) => setActualShortfall(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">The real shortfall between tax due and tax paid for this instalment.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {result && selectedFiling && (
          <Card className="border-accent/40 bg-accent/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-accent" />
                  Estimated Penalty
                </CardTitle>
                <Badge variant="outline" className="text-xs">{selectedFiling.section}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-1">
                <IndianRupee className="h-6 w-6 text-destructive" />
                <span className="text-3xl font-heading font-bold text-destructive">
                  {result.amount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Days late:</span> <span className="font-medium">{result.daysLate}</span></p>
                <p><span className="text-muted-foreground">Calculation:</span> {result.breakdown}</p>
              </div>
              <p className="text-xs text-muted-foreground italic pt-2 border-t">
                Disclaimer: Estimates based on standard rules; actual penalty may vary with turnover, interest, and tax liability.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
