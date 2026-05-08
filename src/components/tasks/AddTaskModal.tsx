import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { taskTypeGroups, dueDateRules, staffMembers, financialYears, quarters, months, TaskType } from "@/data/Tasks";
import { mockClients } from "@/data/Clients";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTaskModal({ open, onOpenChange }: Props) {
  const [client, setClient] = useState("");
  const [taskType, setTaskType] = useState("");
  const [customName, setCustomName] = useState("");
  const [fy, setFy] = useState("FY 2025-26");
  const [quarter, setQuarter] = useState("");
  const [month, setMonth] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  const dueDateRule = dueDateRules[taskType as TaskType];

  const handleSave = () => {
    if (!client || !taskType) {
      toast.error("Please select client and task type");
      return;
    }
    toast.success("Task created successfully!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Add New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client */}
          <div>
            <Label>Client</Label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {mockClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task Type */}
          <div>
            <Label>Task Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger><SelectValue placeholder="Select task type" /></SelectTrigger>
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

          {taskType === "Custom" && (
            <div>
              <Label>Custom Task Name</Label>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Enter task name" />
            </div>
          )}

          {/* FY + Quarter/Month */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Financial Year</Label>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {financialYears.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quarter / Month</Label>
              <Select value={quarter || month} onValueChange={(v) => {
                if (quarters.includes(v)) { setQuarter(v); setMonth(""); }
                else { setMonth(v); setQuarter(""); }
              }}>
                <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Quarters</SelectLabel>
                    {quarters.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Months</SelectLabel>
                    {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Label>Due Date</Label>
              {dueDateRule && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{dueDateRule}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "dd/MM/yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Priority + Assigned */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staffMembers.map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes / Special Instructions</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} className="bg-accent hover:bg-accent/90 text-white">Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
