// Lightweight in-memory store for task document checklists (UI-only demo)
import { ChecklistItem, mockTasks, Task } from "@/data/Tasks";

type Listener = () => void;

const checklists = new Map<string, ChecklistItem[]>();

// Seed from mock tasks
mockTasks.forEach((t) => {
  if (t.documentChecklist) checklists.set(t.id, t.documentChecklist.map((i) => ({ ...i })));
});

const listeners = new Set<Listener>();

export const taskChecklistStore = {
  get(taskId: string): ChecklistItem[] {
    return checklists.get(taskId) ?? [];
  },
  set(taskId: string, items: ChecklistItem[]) {
    checklists.set(taskId, items);
    listeners.forEach((l) => l());
  },
  toggle(taskId: string, itemId: string) {
    const items = checklists.get(taskId) ?? [];
    const next = items.map((i) =>
      i.id === itemId
        ? { ...i, received: !i.received, source: "manual" as const, receivedAt: !i.received ? new Date().toISOString() : undefined }
        : i
    );
    this.set(taskId, next);
  },
  add(taskId: string, label: string) {
    const items = checklists.get(taskId) ?? [];
    const next = [...items, { id: `${Date.now()}`, label, received: false }];
    this.set(taskId, next);
  },
  remove(taskId: string, itemId: string) {
    const items = checklists.get(taskId) ?? [];
    this.set(taskId, items.filter((i) => i.id !== itemId));
  },
  // Simulate a client uploading the requested document via portal link
  markReceivedByLabel(clientId: string, docLabel: string): { task: Task; updated: boolean } | null {
    const task = mockTasks.find((t) => t.clientId === clientId && checklists.has(t.id));
    if (!task) return null;
    const items = checklists.get(task.id) ?? [];
    const idx = items.findIndex((i) => i.label.toLowerCase().includes(docLabel.toLowerCase().split(" ")[0]));
    let next: ChecklistItem[];
    if (idx >= 0) {
      next = items.map((it, i) =>
        i === idx ? { ...it, received: true, source: "client_upload" as const, receivedAt: new Date().toISOString() } : it
      );
    } else {
      next = [...items, { id: `${Date.now()}`, label: docLabel, received: true, source: "client_upload", receivedAt: new Date().toISOString() }];
    }
    this.set(task.id, next);
    return { task, updated: true };
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
