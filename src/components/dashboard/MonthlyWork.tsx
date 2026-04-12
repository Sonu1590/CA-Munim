import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "ITR", count: 42 },
  { name: "GST", count: 78 },
  { name: "TDS", count: 35 },
  { name: "ROC", count: 12 },
  { name: "Other", count: 8 },
];

const completed = 98;
const total = 175;
const pct = Math.round((completed / total) * 100);

export function MonthlyWork() {
  return (
    <section>
      <h2 className="text-lg font-heading font-semibold mb-3">This Month's Work</h2>
      <div className="bg-card rounded-lg card-shadow p-4 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Tasks completed</span>
            <span className="font-semibold">{completed}/{total} ({pct}%)</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Chart */}
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="count" fill="hsl(211, 54%, 24%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
