"use client";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORY_COLOR, CATEGORY_LABEL, fmtDate, money, num } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

export function DonutChart({ data, currency, total }: { data: Dashboard["categories"]; currency: string; total: string }) {
  const top = data[0];
  return (
    <div>
      <div className="relative mx-auto h-48 w-48">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data.map((d) => ({ ...d, v: num(d.amount) }))} dataKey="v" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.category} fill={CATEGORY_COLOR[d.category]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => money(v, currency)} />
          </PieChart>
        </ResponsiveContainer>
        {top && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-label-sm text-muted">Top spend</span><span className="text-headline-sm">{CATEGORY_LABEL[top.category].split(" ")[0]} {Math.round(top.percent)}%</span></div>}
      </div>
      <ul className="mt-5 space-y-2.5">
        {data.map((d) => (
          <li key={d.category} className="flex items-center gap-2 text-body-md">
            <span className="h-3 w-3 rounded-full" style={{ background: CATEGORY_COLOR[d.category] }} />
            <span className="flex-1">{CATEGORY_LABEL[d.category]}</span>
            <span className="tnum text-muted">{Math.round(d.percent)}%</span><span className="tnum w-24 text-right font-semibold">{money(d.amount, currency)}</span>
          </li>
        ))}
      </ul>
      <span className="sr-only">Total {money(total, currency)}</span>
    </div>
  );
}

export function DailyChart({ data, currency }: { data: Dashboard["daily"]; currency: string }) {
  return (
    <div className="h-52">
      <ResponsiveContainer>
        <LineChart data={data.map((d) => ({ date: fmtDate(d.date, { month: "short", day: "numeric" }), v: num(d.amount) }))} margin={{ left: -10, right: 8, top: 8 }}>
          <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} axisLine={false} tickLine={false} width={50} />
          <Tooltip formatter={(v: number) => money(v, currency)} contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--line))", background: "rgb(var(--surface))" }} />
          <Line type="monotone" dataKey="v" stroke="rgb(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
