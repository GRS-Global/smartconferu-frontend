import { useState } from "react";
import type { AnalyticsData } from "../data";
import { Building2, Database, BarChart3, Globe2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AnalyticsCard, AnalyticsStatCard, AnalyticsEmptyState, CountryFlag, SectionLabel, StatChip, FilteredTable } from "../components";
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from "../chart-theme";

function fmt(n: number | string | null | undefined) {
  return typeof n === "number" ? n.toLocaleString() : n;
}
function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 1000) / 10}%`;
}

export default function InstitutionsTab({ data }: { data: AnalyticsData }) {
  const inst = data.institutions;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "domestic" | "international">("all");

  if (!inst) {
    return (
      <AnalyticsCard>
        <AnalyticsEmptyState icon={Building2} title="No institution data" message="Author affiliations for this conference aren't normalized into institutions yet." />
      </AnalyticsCard>
    );
  }

  const top10 = inst.table.slice(0, 10);
  const chartData = top10.map((r) => ({ name: r.name.length > 28 ? `${r.name.slice(0, 27)}…` : r.name, Submitted: r.submitted, Accepted: r.accepted }));
  const submittedSum = inst.table.reduce((sum, r) => sum + r.submitted, 0);
  const acceptedSum = inst.table.reduce((sum, r) => sum + r.accepted, 0);

  return (
    <div className="space-y-5">
      <SectionLabel icon={Database}>Institution Data</SectionLabel>
      <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-2.5">Author affiliations, deduplicated into institutions, across all submissions.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AnalyticsStatCard icon={Building2} tone="primary" value={fmt(inst.unique)} label="Unique Affiliations" sublabel="Deduplicated entries" />
        <AnalyticsStatCard tone="warning" value={fmt(inst.domestic)} label="Domestic Orgs" sublabel={`${pct(inst.domestic, inst.unique)} of unique`} progress={inst.unique ? inst.domestic / inst.unique : 0} />
        <AnalyticsStatCard tone="secondary" value={fmt(inst.international)} label="International Orgs" sublabel={`${pct(inst.international, inst.unique)} of unique`} progress={inst.unique ? inst.international / inst.unique : 0} />
      </div>

      <SectionLabel icon={BarChart3}>Top Institutions</SectionLabel>
      <AnalyticsCard title="Top 10 Organizations by Submissions">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Unique Orgs", value: fmt(inst.unique) },
            { label: "Domestic", value: fmt(inst.domestic) },
            { label: "International", value: fmt(inst.international) },
          ].map((k) => (
            <div key={k.label} style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-lg px-2 py-2.5 text-center">
              <div style={{ color: "var(--navy)" }} className="text-base font-extrabold">{k.value}</div>
              <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ height: Math.max(260, chartData.length * 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
              <XAxis type="number" {...AXIS_STYLE} />
              <YAxis type="category" dataKey="name" {...AXIS_STYLE} width={170} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="Submitted" name="Submitted" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} barSize={14} />
              <Bar dataKey="Accepted" name="Accepted" fill={CHART_COLORS.success} radius={[0, 6, 6, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsCard>

      <SectionLabel icon={Globe2}>Institution Analytics</SectionLabel>
      <AnalyticsCard>
        <FilteredTable
          rows={inst.table}
          query={query} setQuery={setQuery}
          filter={{ value: filter, onChange: setFilter }}
          matchDomestic={(r) => r.country === data.summary.domesticCountry}
          searchPlaceholder="Search affiliations…"
          chips={
            <>
              <StatChip label="Affiliations" value={fmt(inst.unique)} />
              <StatChip label="Papers" value={fmt(submittedSum)} />
              <StatChip label="Accepted" value={fmt(acceptedSum)} />
            </>
          }
          columns={[
            { key: "name", label: "Institution" },
            { key: "country", label: "Country", render: (r) => <span className="inline-flex items-center gap-1.5"><CountryFlag country={r.country} /> {r.country}</span> },
            { key: "submitted", label: "Submitted", align: "right", render: (r) => fmt(r.submitted) },
            { key: "accepted", label: "Accepted", align: "right", render: (r) => fmt(r.accepted) },
            { key: "rate", label: "Accept %", align: "right", render: (r) => `${Math.round((r.accepted / r.submitted) * 1000) / 10}%` },
          ]}
        />
      </AnalyticsCard>
    </div>
  );
}
