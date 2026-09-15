import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Clock, FileText, Sparkles, TrendingUp } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import { Card, EmptyState, PageSkeleton, usePageReady } from "../components/ui";
import { cn } from "../utils/cn";

type Range = "7" | "30" | "90" | "12m";

const RANGES: { id: Range; label: string; days: number }[] = [
  { id: "7", label: "7 Days", days: 7 },
  { id: "30", label: "30 Days", days: 30 },
  { id: "90", label: "90 Days", days: 90 },
  { id: "12m", label: "12 Months", days: 365 },
];

const DONUT_COLORS = ["#4f46e5", "#7c3aed", "#0ea5e9", "#f59e0b", "#0a66c2", "#10b981", "#ec4899", "#94a3b8"];

const CHART_TOOLTIP = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "14px",
    boxShadow: "var(--shadow-pop)",
    fontSize: "12.5px",
    color: "var(--ink)",
  },
  labelStyle: { color: "var(--mute)", fontWeight: 700, marginBottom: 4 },
  itemStyle: { color: "var(--ink)" },
} as const;

function Kpi({ icon: Icon, label, value, sub, tint }: { icon: typeof Sparkles; label: string; value: string; sub: string; tint: string }) {
  return (
    <Card className="p-4.5">
      <div className="flex items-center gap-3.5">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm", tint)}>
          <Icon className="h-5.5 w-5.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-tight text-ink">{value}</p>
          <p className="text-[12.5px] font-medium text-mute">{label}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-medium text-soft">{sub}</p>
    </Card>
  );
}

export default function Insights() {
  const { stats, recentTransformations } = useApp();
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const [range, setRange] = useState<Range>("30");

  const hasData = recentTransformations.length > 0;

  const usageData = useMemo(() => {
    const windowDays = RANGES.find((r) => r.id === range)?.days ?? 30;
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const inWindow = recentTransformations.filter((t) => new Date(t.time).getTime() >= cutoff);

    const byMonth = range === "12m";
    const buckets = new Map<string, number>();
    inWindow.forEach((t) => {
      const d = new Date(t.time);
      const key = byMonth
        ? d.toLocaleDateString(undefined, { month: "short" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    return Array.from(buckets.entries()).map(([label, transformations]) => ({ label, transformations }));
  }, [range, recentTransformations]);

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    recentTransformations.forEach((t) => counts.set(t.target, (counts.get(t.target) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([name, value], i) => ({ name, value, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [recentTransformations]);

  const axis = dark ? "#99a3c0" : "#8a92ab";
  const grid = dark ? "rgba(151,163,199,0.14)" : "#e5e8f3";
  const total = distribution.reduce((a, b) => a + b.value, 0);
  const mostUsed = distribution[0];

  const pageReady = usePageReady(650);
  if (!pageReady) return <PageSkeleton />;

  return (
    <div className="space-y-5">
      <div className="anim-slide-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Insights</h1>
          <p className="mt-1 text-[14px] text-mute">Understand how your government workspace is using ERA.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-card)]">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "focus-ring rounded-full px-3.5 py-1.5 text-xs font-bold transition",
                range === r.id ? "btn-gradient text-white shadow" : "text-mute hover:text-ink"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="anim-slide-up grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "40ms" }}>
        <Kpi icon={Sparkles} label="Total Transformations" value={String(stats.transformations)} sub="All-time in your workspace" tint="bg-gradient-to-br from-violet-500 to-fuchsia-600" />
        <Kpi icon={FileText} label="Documents Processed" value={String(stats.documents)} sub="Across your workspace" tint="bg-gradient-to-br from-indigo-500 to-violet-600" />
        <Kpi icon={Clock} label="Hours Saved" value={`${stats.hours.toFixed(1)} hrs`} sub="Estimated vs manual work" tint="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <Kpi
          icon={TrendingUp}
          label="Most Used Work Type"
          value={mostUsed ? mostUsed.name : "—"}
          sub={mostUsed ? `${Math.round((mostUsed.value / total) * 100)}% of transformations` : "No transformations yet"}
          tint="bg-gradient-to-br from-sky-500 to-blue-600"
        />
      </div>

      {!hasData ? (
        <Card className="anim-slide-up p-10" style={{ animationDelay: "80ms" }}>
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="No insights available yet."
            description="Insights will appear here after you upload documents and generate content."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Usage line */}
            <Card className="anim-slide-up p-5 xl:col-span-2" style={{ animationDelay: "80ms" }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold text-ink">Usage Over Time</h2>
                  <p className="text-xs text-mute">Transformations generated in your workspace</p>
                </div>
                <span className="flex items-center gap-4 text-xs font-medium text-mute">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" /> Transformations</span>
                </span>
              </div>
              {usageData.length === 0 ? (
                <div className="flex h-72 items-center justify-center">
                  <EmptyState
                    icon={<TrendingUp className="h-6 w-6" />}
                    title="No activity in this range"
                    description="Try a wider time range, or generate more content."
                  />
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={usageData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gTrans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11.5 }} axisLine={false} tickLine={false} dy={6} />
                      <YAxis tick={{ fill: axis, fontSize: 11.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...CHART_TOOLTIP} />
                      <Area type="monotone" dataKey="transformations" name="Transformations" stroke="#4f46e5" strokeWidth={2.5} fill="url(#gTrans)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Donut */}
            <Card className="anim-slide-up p-5" style={{ animationDelay: "100ms" }}>
              <h2 className="text-[15px] font-bold text-ink">Transformation Distribution</h2>
              <p className="text-xs text-mute">Share by output type</p>
              <div className="relative mx-auto mt-2 h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} strokeWidth={0}>
                      {distribution.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-extrabold text-ink">{total}</p>
                  <p className="text-[11px] font-medium text-soft">Total</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {distribution.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-[12.5px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 text-mute">{d.name}</span>
                    <span className="font-bold text-ink">{Math.round((d.value / total) * 100)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Counts by type */}
          <Card className="anim-slide-up p-5" style={{ animationDelay: "120ms" }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-ink">Transformations by Type</h2>
                <p className="text-xs text-mute">Count of each output type generated in your workspace</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 4, right: 8, left: -14, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: axis, fontSize: 11.5 }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={{ fill: axis, fontSize: 11.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP} cursor={{ fill: dark ? "rgba(151,163,199,0.06)" : "rgba(16,23,49,0.04)" }} />
                  <Bar dataKey="value" name="Transformations" radius={[6, 6, 0, 0]}>
                    {distribution.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
