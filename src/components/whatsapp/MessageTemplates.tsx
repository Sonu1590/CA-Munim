import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultTemplates, MessageTemplate, TemplateCategory } from "@/data/mockWhatsapp";
import { Plus, Search, Edit, Copy, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

const categoryColors: Record<TemplateCategory, string> = {
  GST: "bg-blue-100 text-blue-700",
  "Income Tax": "bg-purple-100 text-purple-700",
  TDS: "bg-indigo-100 text-indigo-700",
  ROC: "bg-teal-100 text-teal-700",
  Billing: "bg-amber-100 text-amber-700",
  General: "bg-slate-100 text-slate-700",
};

const categories: TemplateCategory[] = ["General", "GST", "Income Tax", "TDS", "ROC", "Billing"];

export function MessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>(defaultTemplates);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Partial<MessageTemplate>>({});

  const filtered = templates.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || t.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const handleSave = () => {
    if (!editTemplate.name || !editTemplate.body || !editTemplate.category) {
      toast.error("Please fill all required fields");
      return;
    }
    const vars = (editTemplate.body?.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/\{|\}/g, ""));
    if (editTemplate.id) {
      setTemplates((prev) => prev.map((t) => (t.id === editTemplate.id ? { ...t, ...editTemplate, variables: vars } as MessageTemplate : t)));
      toast.success("Template updated");
    } else {
      const newT: MessageTemplate = {
        id: `t-${Date.now()}`,
        name: editTemplate.name,
        category: editTemplate.category as TemplateCategory,
        body: editTemplate.body,
        variables: vars,
        isDefault: false,
      };
      setTemplates((prev) => [...prev, newT]);
      toast.success("Template created");
    }
    setEditOpen(false);
    setEditTemplate({});
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template deleted");
  };

  const handleDuplicate = (t: MessageTemplate) => {
    const dup: MessageTemplate = { ...t, id: `t-${Date.now()}`, name: `${t.name} (Copy)`, isDefault: false };
    setTemplates((prev) => [...prev, dup]);
    toast.success("Template duplicated");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search templates..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditTemplate({}); setEditOpen(true); }} className="bg-accent hover:bg-accent/90 text-white gap-2">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {/* Template Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <Card key={t.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-heading leading-tight">{t.name}</CardTitle>
                <Badge variant="secondary" className={`text-[10px] shrink-0 ${categoryColors[t.category]}`}>{t.category}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{t.body}</p>
              <div className="flex flex-wrap gap-1">
                {t.variables.slice(0, 4).map((v) => (
                  <span key={v} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                ))}
                {t.variables.length > 4 && <span className="text-[10px] text-muted-foreground">+{t.variables.length - 4} more</span>}
              </div>
              <div className="flex items-center gap-1 pt-1 border-t border-border">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewTemplate(t)}><Eye className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditTemplate(t); setEditOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(t)}><Copy className="h-3.5 w-3.5" /></Button>
                {!t.isDefault && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No templates found. Create one to get started!</p>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl bg-[#dcf8c6] p-4 text-sm whitespace-pre-wrap border border-[#25D366]/20">
            <p className="font-medium text-xs text-[#25D366] mb-2">WhatsApp Preview</p>
            {previewTemplate?.body}
          </div>
          <div className="flex flex-wrap gap-1">
            {previewTemplate?.variables.map((v) => (
              <Badge key={v} variant="outline" className="text-xs font-mono">{`{{${v}}}`}</Badge>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editTemplate.id ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={editTemplate.name || ""} onChange={(e) => setEditTemplate((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. GST Return Reminder" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editTemplate.category || ""} onValueChange={(v) => setEditTemplate((p) => ({ ...p, category: v as TemplateCategory }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message Body</Label>
              <Textarea rows={6} value={editTemplate.body || ""} onChange={(e) => setEditTemplate((p) => ({ ...p, body: e.target.value }))} placeholder="Use {{variable_name}} for dynamic content..." />
              <p className="text-xs text-muted-foreground">
                Available: {`{{client_name}}, {{firm_name}}, {{due_date}}, {{filing_type}}, {{amount}}, {{upload_link}}`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-[#25D366] hover:bg-[#25D366]/90 text-white">Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
