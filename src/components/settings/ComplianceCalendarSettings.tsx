import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarClock, Save, Loader2 } from "lucide-react";
import { fetchFilingCategoriesFromSupabase, saveFilingCategoriesToSupabase, type FilingCategory } from "@/data/Settings";
import { toast } from "sonner";

export function ComplianceCalendarSettings() {
  const [categories, setCategories] = useState<FilingCategory[]>([]);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [reminderDays, setReminderDays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchFilingCategoriesFromSupabase();
        setCategories(data);
        setReminderDays(Object.fromEntries(data.map((c) => [c.id, "7"])));
      } catch (err: any) {
        setError(err.message ?? "Unable to load filing categories");
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, []);

  const toggleCategory = (id: string) => {
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Filing Types to Track
          </CardTitle>
          <CardDescription>Select which compliance filings to monitor and generate tasks for</CardDescription>
        </CardHeader>
        <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading compliance settings...</div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <Checkbox checked={cat.enabled} onCheckedChange={() => toggleCategory(cat.id)} />
                  <span className="text-sm font-medium">{cat.label}</span>
                </div>
                {cat.enabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Remind</span>
                    <Input className="w-14 h-8 text-center text-xs" type="number" value={reminderDays[cat.id]} onChange={(e) => setReminderDays((p) => ({ ...p, [cat.id]: e.target.value }))} />
                    <span className="text-xs text-muted-foreground hidden sm:inline">days before</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Auto-Generate Tasks</CardTitle>
          <CardDescription>Automatically create recurring compliance tasks each period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable auto-generation</p>
              <p className="text-xs text-muted-foreground">E.g., auto-create GSTR-3B tasks every month for all GST-registered clients</p>
            </div>
            <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={async () => {
            try {
              await saveFilingCategoriesToSupabase(categories);
              toast.success("Compliance calendar settings saved");
            } catch (err: any) {
              toast.error(err.message ?? "Unable to save settings");
            }
          }}
          className="gap-2"
        ><Save className="h-4 w-4" />Save Settings</Button>
      </div>
    </div>
  );
}
