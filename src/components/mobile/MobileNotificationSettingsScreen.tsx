import { Loader2 } from "lucide-react";

const notificationItems = [
  { key: "deadlineReminders", label: "Deadline Reminders", desc: "Auto-send reminders before filing due dates" },
  { key: "documentReceived", label: "Document Received Alerts", desc: "Notify when a client uploads documents" },
  { key: "paymentReceived", label: "Payment Received Alerts", desc: "Confirm payment receipt to clients" },
  { key: "taskAssigned", label: "Task Assigned Alerts", desc: "Notify staff when tasks are assigned" },
] as const;

type NotificationKey = (typeof notificationItems)[number]["key"];

interface MobileNotificationSettingsScreenProps {
  notifications: Record<NotificationKey, boolean>;
  onNotificationChange: (key: NotificationKey, value: boolean) => void;
  reminderDays: string;
  onReminderDaysChange: (value: string) => void;
  loadingPrefs: boolean;
  saving: boolean;
  onSave: () => void;
}

export function MobileNotificationSettingsScreen({
  notifications,
  onNotificationChange,
  reminderDays,
  onReminderDaysChange,
  loadingPrefs,
  saving,
  onSave,
}: MobileNotificationSettingsScreenProps) {
  return (
    <div className="bg-mobile-bg font-mobile-body text-mobile-text -mx-4 -mt-4 px-4 pt-6 pb-8 min-h-[calc(100vh-8rem)]">
      <div className="font-mobile-heading font-normal text-2xl mb-1">Notifications</div>
      <div className="text-xs text-mobile-neutral-600 mb-4">Choose which automated alerts send via WhatsApp</div>

      <div className="bg-mobile-neutral-100 rounded-mobile-lg shadow-mobile-sm divide-y divide-mobile-divider">
        {notificationItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <div className="font-bold text-sm">{item.label}</div>
              <div className="text-xs text-mobile-neutral-600">{item.desc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifications[item.key]}
              onClick={() => onNotificationChange(item.key, !notifications[item.key])}
              disabled={loadingPrefs}
              className={`shrink-0 w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
                notifications[item.key] ? "bg-mobile-accent" : "bg-mobile-neutral-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-mobile-sm transition-transform ${
                  notifications[item.key] ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {notifications.deadlineReminders && (
        <div className="bg-mobile-neutral-100 rounded-mobile-lg shadow-mobile-sm p-3.5 mt-2.5">
          <div className="text-xs font-bold text-mobile-neutral-600 mb-1.5">Reminder Lead Time</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-mobile-neutral-600">Send</span>
            <input
              type="number"
              value={reminderDays}
              onChange={(e) => onReminderDaysChange(e.target.value)}
              disabled={loadingPrefs}
              className="w-16 text-center border border-mobile-neutral-300 rounded-mobile-sm bg-mobile-surface py-1.5 text-sm outline-none disabled:opacity-50"
            />
            <span className="text-sm text-mobile-neutral-600">days before due date</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={saving || loadingPrefs}
        className="w-full mt-4 rounded-full py-3 bg-mobile-accent text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Notification Settings
      </button>
    </div>
  );
}
