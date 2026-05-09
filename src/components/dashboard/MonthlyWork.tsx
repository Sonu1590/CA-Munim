import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface MonthlyWorkData {
  completed: number;
  total: number;
  byType: { name: string; count: number }[];
}

interface MonthlyWorkProps {
  data?: MonthlyWorkData;
}

export function MonthlyWork({ data }: MonthlyWorkProps) {
  const completed = data?.completed ?? 0;
  const total = data?.total ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const chartData = data?.byType ?? [];

  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">This Month's Work</h2>
      <div className="bg-card rounded-lg card-shadow p-4 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Tasks completed</span>
            <span className="font-semibold">
              {total === 0 ? "No tasks this month" : `${completed}/${total} (${pct}%)`}
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(211, 54%, 24%)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            No task data for this month yet.
          </div>
        )}
      </div>
    </section>
  );
}
