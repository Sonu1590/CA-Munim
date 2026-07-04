import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChecklistItem } from "@/data/Tasks";
import { Plus, Trash2, MessageCircle, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskName: string;
  clientName: string;
  items: ChecklistItem[];
  onUpdate: (items: ChecklistItem[]) => void | Promise<void>;
}

export function TaskChecklistDrawer({ open, onOpenChange, taskId, taskName, clientName, items: initialItems, onUpdate }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const [newLabel, setNewLabel] = useState("");

  // Re-sync when a fresh checklist arrives from the parent (e.g. after a
  // successful save elsewhere) or when the drawer is opened for a task.
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems, taskId, open]);

  const commit = (next: ChecklistItem[]) => {
    setItems(next);
    onUpdate(next);
  };

  const received = items.filter((i) => i.received).length;
  const pending = items.filter((i) => !i.received);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading">Document Checklist</SheetTitle>
          <div className="text-xs text-muted-foreground">{taskName} · {clientName}</div>
        </SheetHeader>

        <div className="mt-4 mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">{received} of {items.length} received</span>
          <Badge variant="outline">{Math.round((received / Math.max(items.length, 1)) * 100)}%</Badge>
        </div>

        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border">
              <Checkbox
                checked={item.received}
                onCheckedChange={() =>
                  commit(
                    items.map((i) =>
                      i.id === item.id
                        ? { ...i, received: !i.received, source: "manual" as const, receivedAt: !i.received ? new Date().toISOString() : undefined }
                        : i
                    )
                  )
                }
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.received ? "line-through text-muted-foreground" : "font-medium"}`}>{item.label}</p>
                {item.received && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    {item.source === "client_upload" ? <Upload className="h-2.5 w-2.5" /> : null}
                    {item.source === "client_upload" ? "Uploaded by client" : "Marked manually"}
                    {item.receivedAt && ` · ${new Date(item.receivedAt).toLocaleDateString("en-IN")}`}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => commit(items.filter((i) => i.id !== item.id))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No checklist items yet.</p>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <Input placeholder="Add document item…" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Button
            size="icon"
            onClick={() => {
              if (!newLabel.trim()) return;
              commit([...items, { id: crypto.randomUUID(), label: newLabel.trim(), received: false }]);
              setNewLabel("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {pending.length > 0 && (
          <Button
            variant="outline"
            className="w-full gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
            onClick={() =>
              toast.success(`WhatsApp request sent to ${clientName}`, {
                description: `Asked for ${pending.length} pending document(s). Auto-marks checklist on upload.`,
              })
            }
          >
            <MessageCircle className="h-4 w-4" />
            Request {pending.length} pending via WhatsApp
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
