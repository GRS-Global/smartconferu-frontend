"use client";
/* "Platform activity" (the prototype's dashboard chart): papers submitted and reviews sent per month,
   all conferences, with a year picker. Two series: legend, hover tooltip, and a table view. */
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { loadMonthlyActivity } from "../services";
import { useData } from "../use-data";
import { Card, CardTitle } from "./ui";

const SUBMISSIONS = "#7C3AED";
const REVIEWS = "#06B6D4";

export function ActivityChart() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [asTable, setAsTable] = useState(false);
  const { data } = useData(() => loadMonthlyActivity(year), [year]);
  const years = data?.years ?? [year];
  return (
    <Card>
      <CardTitle
        title="Platform activity"
        subtitle="Papers submitted and reviews sent, all conferences"
        right={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAsTable((t) => !t)} className="text-[12.5px] font-semibold cursor-pointer" style={{ color: "var(--primary)" }}>
              {asTable ? "Chart" : "Table"}
            </button>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="sa-input !w-auto !py-1.5 cursor-pointer" aria-label="Year">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        }
      />
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-0">Month</th>
                <th>Submissions</th>
                <th>Reviews</th>
              </tr>
            </thead>
            <tbody>
              {(data?.months ?? []).map((m) => (
                <tr key={m.month}>
                  <td className="!pl-0">{m.month}</td>
                  <td className="tabular-nums">{m.submissions}</td>
                  <td className="tabular-nums">{m.reviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.months ?? []} barGap={2} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} width={40} allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "var(--primary-soft)" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12.5 }} />
              <Bar isAnimationActive={false} dataKey="submissions" name="Submissions" fill={SUBMISSIONS} radius={[4, 4, 0, 0]} maxBarSize={12} />
              <Bar isAnimationActive={false} dataKey="reviews" name="Reviews" fill={REVIEWS} radius={[4, 4, 0, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="flex gap-5 mt-3 text-[12.5px]" style={{ color: "var(--text-soft)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: SUBMISSIONS }} />
          Submissions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: REVIEWS }} />
          Reviews
        </span>
      </div>
    </Card>
  );
}
