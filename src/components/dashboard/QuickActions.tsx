import { UserPlus, Send, FileText, Receipt } from "lucide-react";
import { motion } from "framer-motion";

const actions = [
  { label: "Add New Client", icon: UserPlus, bg: "bg-primary", fg: "text-primary-foreground" },
  { label: "Bulk WhatsApp Reminder", icon: Send, bg: "bg-whatsapp", fg: "text-whatsapp-foreground" },
  { label: "Create Task", icon: FileText, bg: "bg-accent", fg: "text-accent-foreground" },
  { label: "Generate Invoice", icon: Receipt, bg: "bg-primary", fg: "text-primary-foreground" },
];

export function QuickActions() {
  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a, i) => (
          <motion.button
            key={a.label}
            whileTap={{ scale: 0.97 }}
            className={`${a.bg} ${a.fg} rounded-lg p-4 flex flex-col items-center gap-2 text-center card-shadow hover:opacity-90 transition-opacity`}
          >
            <a.icon className="h-6 w-6" />
            <span className="text-sm font-medium">{a.label}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
