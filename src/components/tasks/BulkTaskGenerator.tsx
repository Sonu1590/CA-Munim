import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { taskTypeGroups, months } from "@/data/mockTasks";
import { mockClients } from "@/data/mockClients";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkTaskGenerator({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(1);
  const [taskType, setTaskType] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

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
    if (selectedClients.length === mockClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(mockClients.map((c) => c.id));
    }
  };

  const totalTasks = selectedClients.length * selectedMonths.length;

  const handleGenerate = () => {
    toast.success(`${totalTasks} tasks created successfully!`);
    onOpenChange(false);
    setStep(1);
    setTaskType("");
    setSelectedClients([]);
    setSelectedMonths([]);
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
                {selectedClients.length === mockClients.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-lg p-3">
              {mockClients.map((c) => (
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
            <div className="text-4xl">📋</div>
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
            <Button onClick={handleGenerate} className="bg-accent hover:bg-accent/90 text-white">
              Generate {totalTasks} Tasks
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
