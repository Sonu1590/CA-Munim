import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockClients } from "@/data/mockClients";
import { documentRequestTypes } from "@/data/mockDocuments";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string;
}

export function DocumentRequestModal({ open, onOpenChange, preselectedClientId }: Props) {
  const [clientId, setClientId] = useState(preselectedClientId || "");
  const [docType, setDocType] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [dueDate, setDueDate] = useState("");

  const isCustom = docType === "Custom";
  const client = mockClients.find((c) => c.id === clientId);

  const handleSend = () => {
    if (!clientId || !docType || !dueDate) {
      toast.error("Please fill all required fields");
      return;
    }
    const docName = isCustom ? customLabel : docType;
    const message = `Hello ${client?.name}, Sharma & Associates requires your ${docName} by ${new Date(dueDate).toLocaleDateString("en-IN")}. Please upload it using the link we've shared.`;
    
    toast.success("Document request sent via WhatsApp!", {
      description: message.substring(0, 100) + "...",
    });
    onOpenChange(false);
    setClientId("");
    setDocType("");
    setCustomLabel("");
    setDueDate("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Request Document from Client</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {mockClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
              <SelectContent>
                {documentRequestTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="Custom">Custom (type your own)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCustom && (
            <div className="space-y-2">
              <Label>Custom Document Label</Label>
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Rent Agreement" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Submission Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          {clientId && docType && dueDate && (
            <div className="rounded-xl bg-[#dcf8c6] p-3 text-sm text-foreground border border-[#25D366]/20">
              <p className="font-medium text-xs text-[#25D366] mb-1">WhatsApp Preview</p>
              <p>Hello {client?.name}, Sharma & Associates requires your {isCustom ? customLabel : docType} by {new Date(dueDate).toLocaleDateString("en-IN")}. Please upload it using the link we've shared.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} className="bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-2">
            <MessageCircle className="h-4 w-4" />
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
