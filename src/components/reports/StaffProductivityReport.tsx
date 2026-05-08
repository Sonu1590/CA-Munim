import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { getStaffProductivity, type StaffProductivity } from "@/data/Reports";

export function StaffProductivityReport() {
  const [data, setData] = useState<StaffProductivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getStaffProductivity();
        setData(result);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load staff productivity");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const maxTasks = Math.max(...data.map((d) => d.completed + d.pending + d.overdue), 1);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-heading">Staff Productivity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading staff productivity...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No staff productivity data available.</div>
        ) : (
          data.map((staff) => {
            const total = staff.completed + staff.pending + staff.overdue;
            const completionRate = total > 0 ? Math.round((staff.completed / total) * 100) : 0;
            return (
              <div key={staff.name} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                      {staff.initials}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{staff.name}</p>
                      <p className="text-xs text-muted-foreground">{total} total tasks</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold font-heading">{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
                    ✅ {staff.completed} Completed
                  </Badge>
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                    ⏳ {staff.pending} Pending
                  </Badge>
                  {staff.overdue > 0 && (
                    <Badge variant="secondary" className="text-xs bg-red-100 text-red-800 border-red-200">
                      ❌ {staff.overdue} Overdue
                    </Badge>
                  )}
                  {staff.avgDays > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Avg: {staff.avgDays} days
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
