import { FileText, MessageCircle, Receipt, CheckCircle2 } from "lucide-react";

const activities = [
  { icon: CheckCircle2, text: "ITR filed for Ramesh Gupta", time: "10 min ago", color: "text-success" },
  { icon: MessageCircle, text: "Document received from Priya Sharma via WhatsApp", time: "25 min ago", color: "text-whatsapp" },
  { icon: Receipt, text: "Invoice sent to Mehta Traders — ₹3,500", time: "1 hr ago", color: "text-accent" },
  { icon: FileText, text: "GSTR-3B filed for Verma Enterprises", time: "2 hrs ago", color: "text-success" },
  { icon: MessageCircle, text: "WhatsApp reminder sent to 12 clients for TDS Challan", time: "3 hrs ago", color: "text-whatsapp" },
];

export function RecentActivity() {
  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">Recent Activity</h2>
      <div className="bg-card rounded-lg card-shadow divide-y divide-border">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-3 p-3.5">
            <div className={`${a.color} mt-0.5`}>
              <a.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{a.text}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
