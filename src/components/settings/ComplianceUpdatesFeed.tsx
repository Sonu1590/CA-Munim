import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, AlertTriangle, Info, AlertCircle, Loader2 } from "lucide-react";
import { fetchComplianceUpdatesFromSupabase, type ComplianceUpdate } from "@/data/Settings";

const severityConfig = {
  info: { icon: Info, color: "bg-blue-100 text-blue-700", label: "Info" },
  important: { icon: AlertCircle, color: "bg-orange-100 text-orange-700", label: "Important" },
  urgent: { icon: AlertTriangle, color: "bg-red-100 text-red-700", label: "Urgent" },
};

export function ComplianceUpdatesFeed() {
  const [updates, setUpdates] = useState<ComplianceUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUpdates = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchComplianceUpdatesFromSupabase();
        setUpdates(data);
      } catch (err: any) {
        setError(err.message ?? "Unable to load updates");
      } finally {
        setLoading(false);
      }
    };
    loadUpdates();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" />Compliance Updates</h3>
        <p className="text-sm text-muted-foreground">Recent regulatory changes and deadline updates from the CA Munim team</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading updates...</div>
      ) : error ? (
        <div className="p-8 text-center text-destructive">{error}</div>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => {
          const config = severityConfig[update.severity];
          const Icon = config.icon;
          return (
            <Card key={update.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-sm">{update.title}</h4>
                      <Badge variant="secondary" className={`text-xs ${config.color}`}>{config.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{update.body}</p>
                    <p className="text-xs text-muted-foreground mt-2">Published: {new Date(update.publishedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
