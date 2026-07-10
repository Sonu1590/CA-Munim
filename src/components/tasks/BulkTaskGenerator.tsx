import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { taskTypeGroups, months } from "@/data/Tasks";
import { useClients, type Client } from "@/hooks/useClients";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AlertCircle, Check, ListChecks, Loader2 } from "lucide-react";
import { useFinancialYear } from "@/context/financialYear";
import { fetchComplianceRulesFromSupabase, selectRuleForFY, computeDueDate, type ComplianceRule } from "@/data/ComplianceRules";
import { qrmpCategory, QRMP_QUARTER_END_MONTHS } from "@/lib/gstQrmp";

// Maps this UI's TaskType labels to compliance_rules.filing_type keys. 24Q/
// 26Q/27Q/27EQ and ITR share one row each since their due-date rules don't
// currently differ (matches the behavior this replaces).
const FILING_TYPE_MAP: Record<string, string> = {
  "GSTR-1": "GSTR-1_MONTHLY",
  "GSTR-3B": "GSTR-3B_MONTHLY_ABOVE5CR",
  "GSTR-9": "GSTR-9",
  "GSTR-9C": "GSTR-9C",
  "GSTR-4": "GSTR-4",
  "CMP-08": "CMP-08",
  "TDS Challan": "TDS_CHALLAN",
  "24Q": "TDS_RETURN_24Q_26Q",
  "26Q": "TDS_RETURN_24Q_26Q",
  "27Q": "TDS_RETURN_24Q_26Q",
  "27EQ": "TDS_RETURN_24Q_26Q",
  "ITR Filing": "ITR_NON_AUDIT",
  "Tax Audit": "TAX_AUDIT",
  "Form 3CD": "TAX_AUDIT",
  "DIR-3 KYC": "DIR-3 KYC",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}

export function BulkTaskGenerator({ open, onOpenChange, onGenerated }: Props) {
  const { selectedFY: currentFY } = useFinancialYear();
  const { clients, loading: clientsLoading, error: clientsError } = useClients();
  const [step, setStep] = useState(1);
  const [taskType, setTaskType] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [rulesError, setRulesError] = useState<string | null>(null);

  useEffect(() => {
    fetchComplianceRulesFromSupabase()
      .then(setRules)
      .catch((err: any) => setRulesError(err.message ?? "Unable to load compliance rules"));
  }, []);

  const toggleClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const selectAllClients = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map((c) => c.id));
    }
  };

  useEffect(() => {
    const allowed = new Set(clients.map((c) => c.id));
    const sanitized = selectedClients.filter((id) => allowed.has(id));
    if (sanitized.length === selectedClients.length) return;
    setSelectedClients(sanitized);
  }, [clients, selectedClients]);

  // month/year of the return PERIOD being filed — used for monthly/quarterly
  // rules (annual rules like GSTR-9/ITR/DIR-3 KYC ignore period entirely).
  const periodFor = (month: string, fyStart: number) => {
    const monthIndex = months.indexOf(month);
    return {
      month: monthIndex <= 8 ? monthIndex + 4 : monthIndex - 8, // 1-12
      year: monthIndex <= 8 ? fyStart : fyStart + 1,
    };
  };

  // Returns null when a QRMP (quarterly) client has no return due in this
  // particular month — GSTR-3B/GSTR-1 only fall due at quarter-end for them,
  // unlike every other filing type here, which is always due somewhere.
  const calculateDueDate = (type: string, month: string, client?: Client): string | null => {
    const fyStart = Number(currentFY.match(/FY (\d{4})-/)?.[1] ?? new Date().getFullYear());
    const isQrmpClient = (type === "GSTR-3B" || type === "GSTR-1") && client?.gst_filing_freq === "Quarterly";

    if (isQrmpClient && !QRMP_QUARTER_END_MONTHS.has(month)) return null;

    let filingType = FILING_TYPE_MAP[type];
    if (isQrmpClient) {
      filingType = type === "GSTR-3B"
        ? (qrmpCategory(client!.state) === "CAT1" ? "GSTR-3B_QRMP_CAT1" : "GSTR-3B_QRMP_CAT2")
        : "GSTR-1_QRMP";
    }

    const rule = filingType ? selectRuleForFY(rules, filingType, fyStart) : undefined;
    const dueDate = rule ? computeDueDate(rule, fyStart, periodFor(month, fyStart)) : null;
    if (!dueDate) {
      console.error(`No compliance rule found for filing type "${filingType}" — falling back to 20th of following month.`);
      const { month: pMonth, year: pYear } = periodFor(month, fyStart);
      const nextMonth = pMonth === 12 ? 1 : pMonth + 1;
      const nextYear = pMonth === 12 ? pYear + 1 : pYear;
      return `${nextYear}-${String(nextMonth).padStart(2, "0")}-20`;
    }
    return dueDate;
  };

  const { plannedTasks, skippedQrmp } = useMemo(() => {
    const plannedTasks: { clientId: string; month: string; dueDate: string }[] = [];
    let skippedQrmp = 0;
    for (const clientId of selectedClients) {
      const client = clients.find((c) => c.id === clientId);
      for (const month of selectedMonths) {
        const dueDate = calculateDueDate(taskType, month, client);
        if (dueDate === null) { skippedQrmp++; continue; }
        plannedTasks.push({ clientId, month, dueDate });
      }
    }
    return { plannedTasks, skippedQrmp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClients, selectedMonths, taskType, clients, rules, currentFY]);

  const totalTasks = plannedTasks.length;

  const handleGenerate = async () => {
    if (!taskType || selectedClients.length === 0 || selectedMonths.length === 0) return;

    setGenerating(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: staffRow } = await supabase
        .from("staff")
        .select("firm_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!staffRow?.firm_id) throw new Error("Firm not found");

      const tasksToInsert = plannedTasks.map(({ clientId, month, dueDate }) => ({
        firm_id: staffRow.firm_id,
        client_id: clientId,
        task_type: taskType,
        financial_year: currentFY,
        period: month,
        due_date: dueDate,
        status: "pending",
        priority: "medium",
        document_checklist: [],
      }));

      const batchSize = 50;
      for (let i = 0; i < tasksToInsert.length; i += batchSize) {
        const batch = tasksToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from("tasks")
          .insert(batch);

        if (error) {
          failCount += batch.length;
          console.error("Batch insert error:", error);
        } else {
          successCount += batch.length;
        }
      }

      if (failCount > 0) {
        toast.warning(`${successCount} tasks created, ${failCount} failed. Check console for details.`);
      } else {
        toast.success(`${successCount} tasks created successfully!`);
      }
      onOpenChange(false);
      onGenerated?.();
      setStep(1);
      setTaskType("");
      setSelectedClients([]);
      setSelectedMonths([]);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Generate Recurring Tasks</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && <div className={`h-0.5 w-6 ${step > s ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {rulesError && (
              <div className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {rulesError} — due dates will fall back to a generic estimate.
              </div>
            )}
            <Label>Select Filing Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {Object.entries(taskTypeGroups).map(([group, types]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Clients</Label>
              <Button variant="ghost" size="sm" onClick={selectAllClients} className="text-xs">
                {selectedClients.length === clients.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
              {clientsLoading && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading clients...
                </div>
              )}
              {clientsError && (
                <div className="text-xs text-destructive flex items-center gap-1.5 py-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {clientsError}
                </div>
              )}
              {!clientsLoading && !clientsError && clients.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer py-1">
                  <Checkbox
                    checked={selectedClients.includes(c.id)}
                    onCheckedChange={() => toggleClient(c.id)}
                  />
                  <span className="text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{c.type}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedClients.length} clients selected</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Select Months to Generate</Label>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer p-2 border border-border rounded-lg hover:bg-muted">
                  <Checkbox
                    checked={selectedMonths.includes(m)}
                    onCheckedChange={() => toggleMonth(m)}
                  />
                  <span className="text-sm">{m}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-6 space-y-3">
            <ListChecks className="h-10 w-10 mx-auto text-primary" />
            <p className="text-lg font-heading font-semibold">Ready to Generate</p>
            <p className="text-sm text-muted-foreground">
              <strong>{totalTasks}</strong> tasks will be created for <strong>{selectedClients.length}</strong> clients × <strong>{selectedMonths.length}</strong> months
            </p>
            <p className="text-sm text-muted-foreground">Filing type: <strong>{taskType}</strong></p>
            {skippedQrmp > 0 && (
              <p className="text-xs text-muted-foreground">
                {skippedQrmp} client-month{skippedQrmp === 1 ? "" : "s"} skipped — quarterly (QRMP) filers have no return due outside quarter-end months.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
          )}
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !taskType) || (step === 2 && selectedClients.length === 0) || (step === 3 && selectedMonths.length === 0)}
              className="bg-accent hover:bg-accent/90 text-white"
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={generating || totalTasks === 0} className="bg-accent hover:bg-accent/90 text-white">
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</>
              ) : (
                `Generate ${totalTasks} Tasks`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
