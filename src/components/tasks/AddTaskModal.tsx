// src/components/tasks/AddTaskModal.tsx

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useStaff } from "@/hooks/useStaff";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Calendar } from "@/components/ui/calendar";

import { cn } from "@/lib/utils";

import { useClients } from "@/hooks/useClients";
import { TaskFormData, TaskPriority } from "@/hooks/useTasks";
import { useFinancialYear } from "@/context/financialYear";
import { financialYears } from "@/data/Tasks";
import type { Task } from "@/data/Tasks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (data: TaskFormData) => Promise<void | boolean> | void | boolean;
  task?: Task | null;
}

export function AddTaskModal({
  open,
  onOpenChange,
  onSave,
  task,
}: Props) {
  const { clients, loading: clientsLoading } = useClients();
  const { staff, loading: staffLoading } = useStaff();
  const { selectedFY } = useFinancialYear();
  const [client, setClient] = useState("");
  const [taskType, setTaskType] = useState("");
  const [customName, setCustomName] = useState("");

  const [financialYear, setFinancialYear] = useState(selectedFY);

  const [period, setPeriod] = useState("Q1");

  const [dueDate, setDueDate] = useState<Date>();
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const [priority, setPriority] = useState<TaskPriority>("medium");

  const [notes, setNotes] = useState("");

  const [assignedTo, setAssignedTo] = useState("");

  const resetForm = () => {
    setClient("");
    setTaskType("");
    setCustomName("");
    setFinancialYear(selectedFY);
    setPeriod("Q1");
    setDueDate(undefined);
    setPriority("medium");
    setNotes("");
    setAssignedTo("");
  };

  const availableFYs = [selectedFY, ...financialYears.filter((year) => year !== selectedFY)];

  useEffect(() => {
    if (!open) return;
    if (!task) {
      setClient("");
      setTaskType("");
      setCustomName("");
      setFinancialYear(selectedFY);
      setPeriod("Q1");
      setDueDate(undefined);
      setPriority("medium");
      setNotes("");
      setAssignedTo("");
      return;
    }

    setClient(task.clientId ?? "");
    setTaskType(task.taskType ?? "");
    setCustomName(task.customTaskName ?? "");
    setFinancialYear(task.financialYear || selectedFY);
    setPeriod((task as any).period ?? task.quarter ?? task.month ?? "Q1");
    setDueDate(task.dueDate ? parseISO(task.dueDate) : undefined);
    setPriority(task.priority ?? "medium");
    setNotes(task.notes ?? "");
    setAssignedTo((task as any).assignedToId ?? "");
  }, [open, task, selectedFY]);

  const handleClose = (value: boolean) => {
    if (!value) {
      resetForm();
    }

    onOpenChange(value);
  };

  const handleSave = async () => {
    if (!client || !taskType) {
      toast.error("Please select client and task type");
      return;
    }

    if (!onSave) {
      toast.error("Task save handler missing");
      return;
    }

    try 
    {
      const payload: TaskFormData = {
        client_id: client,
        task_type: taskType,
        custom_name: customName || undefined,
        financial_year: financialYear,
        period,
        due_date: dueDate
          ? format(dueDate, "yyyy-MM-dd")
          : "",
        priority,
        notes,
        assigned_to: assignedTo || undefined,
        document_checklist: [],
      };

      console.log("FINAL TASK INSERT", payload);

      const result = await onSave(payload);
      if (result === false) return;

      handleClose(false);
    } catch (err) {
      console.error("Task creation failed:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to create task"
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {task ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Client
              </label>

              <Select
                value={client}
                onValueChange={setClient}
                disabled={!!task}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>

                <SelectContent>
                  {clientsLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Loading clients...
                    </div>
                  ) : (
                    clients.map((c) => (
                      <SelectItem
                        key={c.id}
                        value={c.id}
                      >
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Task Type
              </label>

              <Select
                value={taskType}
                onValueChange={setTaskType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="GST Filing">
                    GST Filing
                  </SelectItem>

                  <SelectItem value="TDS Return">
                    TDS Return
                  </SelectItem>

                  <SelectItem value="ITR Filing">
                    ITR Filing
                  </SelectItem>

                  <SelectItem value="ROC Filing">
                    ROC Filing
                  </SelectItem>

                  <SelectItem value="Audit">
                    Audit
                  </SelectItem>

                  <SelectItem value="Other">
                    Other
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {taskType === "Other" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Custom Task Name
              </label>

              <Input
                value={customName}
                onChange={(e) =>
                  setCustomName(e.target.value)
                }
                placeholder="Enter custom task name"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Financial Year
              </label>

              <Select
                value={financialYear}
                onValueChange={setFinancialYear}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {availableFYs.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Period
              </label>

              <Select
                value={period}
                onValueChange={setPeriod}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Q1">
                    Q1 (Apr-Jun)
                  </SelectItem>

                  <SelectItem value="Q2">
                    Q2 (Jul-Sep)
                  </SelectItem>

                  <SelectItem value="Q3">
                    Q3 (Oct-Dec)
                  </SelectItem>

                  <SelectItem value="Q4">
                    Q4 (Jan-Mar)
                  </SelectItem>

                  <SelectItem value="Annual">
                    Annual
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Due Date
            </label>

            <Popover open={dueDateOpen} onOpenChange={setDueDateOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate &&
                      "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />

                  {dueDate ? (
                    format(dueDate, "dd/MM/yyyy")
                  ) : (
                    <span>Pick a due date</span>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent
                className="w-auto p-0"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    setDueDate(date);
                    setDueDateOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Priority
              </label>

              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="low">
                    Low
                  </SelectItem>

                  <SelectItem value="medium">
                    Medium
                  </SelectItem>

                  <SelectItem value="high">
                    High
                  </SelectItem>

                  <SelectItem value="urgent">
                    Urgent
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Assigned To
              </label>

              <Select  value={assignedTo}  onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign staff member" />
                 </SelectTrigger>

                <SelectContent>
                  {staffLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">
                    Loading staff...
                    </div>
                  ) : (
                    staff.map((member) => (
                      <SelectItem
                        key={member.id}
                        value={member.id}
                      >
                        {member.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Notes
            </label>

            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              placeholder="Additional notes..."
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>

            <Button onClick={handleSave}>
              {task ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
