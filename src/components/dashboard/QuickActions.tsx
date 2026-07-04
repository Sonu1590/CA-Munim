import { useState } from "react";
import { UserPlus, Send, FileText, Receipt } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { AddClientModal } from "@/components/clients/AddClientModal";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { CreateInvoiceModal } from "@/components/billing/CreateInvoiceModal";
import { BulkSender } from "@/components/whatsapp/BulkSender";

import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";

export function QuickActions() {
  const [clientOpen, setClientOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  const { addClient } = useClients();
  const { addTask } = useTasks();

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">
        Quick Actions
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setClientOpen(true)}
          className="bg-primary text-primary-foreground rounded-lg p-4 flex flex-col items-center gap-2 text-center card-shadow hover:opacity-90 transition-opacity"
        >
          <UserPlus className="h-6 w-6" />
          <span className="text-sm font-medium">
            Add New Client
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setWhatsappOpen(true)}
          className="bg-whatsapp text-whatsapp-foreground rounded-lg p-4 flex flex-col items-center gap-2 text-center card-shadow hover:opacity-90 transition-opacity"
        >
          <Send className="h-6 w-6" />
          <span className="text-sm font-medium">
            Bulk WhatsApp Reminder
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setTaskOpen(true)}
          className="bg-accent text-accent-foreground rounded-lg p-4 flex flex-col items-center gap-2 text-center card-shadow hover:opacity-90 transition-opacity"
        >
          <FileText className="h-6 w-6" />
          <span className="text-sm font-medium">
            Create Task
          </span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setInvoiceOpen(true)}
          className="bg-primary text-primary-foreground rounded-lg p-4 flex flex-col items-center gap-2 text-center card-shadow hover:opacity-90 transition-opacity"
        >
          <Receipt className="h-6 w-6" />
          <span className="text-sm font-medium">
            Generate Invoice
          </span>
        </motion.button>
      </div>

      <AddClientModal
        open={clientOpen}
        onOpenChange={setClientOpen}
        onSave={async (formData) => {
          const result = await addClient(formData);

          if (result.success) {
            toast.success("Client created successfully");
            setClientOpen(false);
          } else {
            toast.error(result.error ?? "Failed to create client");
          }

          return result;
        }}
      />

      <AddTaskModal
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onSave={async (taskData) => {
          const success = await addTask(taskData);

          if (success) {
            toast.success("Task created successfully");
            setTaskOpen(false);
          } else {
            toast.error("Failed to create task");
          }
        }}
      />

      <CreateInvoiceModal
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
      />

      <Dialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
      >
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Bulk WhatsApp Reminder
            </DialogTitle>
          </DialogHeader>

          <div className="min-w-0 p-4">
            <BulkSender />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
