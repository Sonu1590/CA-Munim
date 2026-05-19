import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { taskTypeGroups, months } from "@/data/Tasks";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AlertCircle, Check, ListChecks, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}

export function BulkTaskGenerator({ open, onOpenChange, onGenerated }: Props) {
  const { clients, loading: clientsLoading, error: clientsError } = useClients();
  const [step, setStep] = useState(1);
  const [taskType, setTaskType] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

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

  const totalTasks = selectedClients.length * selectedMonths.length;

  const calculateDueDate = (type: string, month: string) => {
    const monthIndex = months.indexOf(month);
    const periodYear = monthIndex <= 8 ? 2025 : 2026;
    const periodMonth = monthIndex <= 8 ? monthIndex + 3 : monthIndex - 9;
    const nextMonth = new Date(periodYear, periodMonth + 1, 1);

    const dateForDay = (day: number) =>
      new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day).toISOString().split("T")[0];

    if (type === "GSTR-1") return dateForDay(11);
    if (type === "GSTR-3B") return dateForDay(20);
    if (type === "TDS Challan") {
      if (month === "March") return "2026-04-30";
      return dateForDay(7);
    }
    if (["24Q", "26Q", "27Q", "27EQ"].includes(type)) {
      if (["June", "September", "December"].includes(month)) return dateForDay(31);
      if (month === "March") return "2026-05-31";
    }
    if (type === "GSTR-9" || type === "GSTR-9C") return "2026-12-31";
    if (type === "GSTR-4") return "2026-04-30";
    if (type === "CMP-08") return dateForDay(18);
    if (type === "ITR Filing") return "2026-07-31";
    if (type === "Tax Audit" || type === "Form 3CD") return "2026-09-30";
    if (type === "DIR-3 KYC") return "2025-09-30";
    return dateForDay(20);
  };

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

      const tasksToInsert = [];
      for (const clientId of selectedClients) {
        for (const month of selectedMonths) {
          tasksToInsert.push({
            firm_id: staffRow.firm_id,
            client_id: clientId,
            task_type: taskType,
            financial_year: "FY 2025-26",
            period: month,
            due_date: calculateDueDate(taskType, month),
            status: "pending",
            priority: "medium",
            document_checklist: [],
          });
        }
      }

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
            <Button onClick={handleGenerate} disabled={generating} className="bg-accent hover:bg-accent/90 text-white">
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
