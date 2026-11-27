import { useState } from "react";
import type { AnalyticsData } from "../data";
import { MapPinned, Trophy, FileText, CheckCircle2, LayoutList, Database } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { legendText } from "../chart-theme";
import { AnalyticsCard, AnalyticsStatCard, AnalyticsEmptyState, SectionLabel, StatChip, MiniTile, FilteredTable } from "../components";
import { CHART_COLORS, CHART_CATEGORICAL, TOOLTIP_STYLE, AXIS_STYLE } from "../chart-theme";

function fmt(n: number | string | null | undefined) {
  return typeof n === "number" ? n.toLocaleString() : n;
}

export default function RegionTab({ data }: { data: AnalyticsData }) {
  const r = data.region;
  const s = data.summary;
  const [query, setQuery] = useState("");

  if (!r) {
    return (
      <AnalyticsCard>
        <AnalyticsEmptyState icon={MapPinned} title="No region data" message="Regional grouping needs author country data, which this conference doesn't have yet." />
      </AnalyticsCard>
    );
  }

  const pieData = r.table.map((row) => ({ name: row.region, value: row.papersSubmitted }));
  const others = r.table.filter((row) => row.region !== r.leadingRegion.region);
  const submittedVsAccepted = r.table.map((row) => ({ region: row.region, Submitted: row.papersSubmitted, Accepted: row.papersAccepted }));

  return (
    <div className="space-y-5">
      <SectionLabel icon={Database}>Region Overview</SectionLabel>
      <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-2.5">Papers rolled up from country data into regions.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AnalyticsStatCard icon={MapPinned} tone="primary" value={r.regionsWithPapers} label="Regions with Papers" sublabel={`${r.regionsWithPapers} regions tracked`} />
        <AnalyticsStatCard icon={Trophy} tone="warning" value={r.leadingRegion.region} label="Leading Region" sublabel={`${fmt(r.leadingRegion.papers)} papers · ${r.leadingRegion.sharePct}%`} />
        <AnalyticsStatCard icon={FileText} tone="secondary" value={`${fmt(s.accepted)} / ${fmt(s.totalPapers)}`} label="Accepted / Papers (all regions)" sublabel={`${s.acceptanceRate}% acceptance`} />
        <AnalyticsStatCard icon={CheckCircle2} tone="success" value={`${fmt(s.domesticAccepted)} / ${fmt(s.domesticPapers)}`} label={`${s.domesticCountry} Region Accepted / Papers`} sublabel={`${s.domesticAcceptRate}% acceptance`} />
      </div>

      <SectionLabel icon={LayoutList}>Charts</SectionLabel>
      <div className="grid sm:grid-cols-2 gap-5">
        <AnalyticsCard title="Other Regions by Papers">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniTile label="Regions" value={r.regionsWithPapers} />
            <MiniTile label="Top Region" value={r.leadingRegion.region} />
            <MiniTile label="Top Papers" value={fmt(r.leadingRegion.papers)} />
          </div>
          <div style={{ background: "var(--warning-soft)", border: "1px solid var(--warning-border)" }} className="rounded-xl p-3 flex items-center justify-between gap-3 mb-3">
            <div>
              <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-bold uppercase tracking-wide">Leading Region</div>
              <div style={{ color: "var(--navy)" }} className="text-sm font-bold mt-0.5">{r.leadingRegion.region}</div>
            </div>
            <div className="text-right">
              <div style={{ color: "var(--warning-ink)" }} className="text-lg font-extrabold leading-none">{fmt(r.leadingRegion.papers)}</div>
              <div style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-0.5">papers · {r.leadingRegion.sharePct}% of regional total</div>
            </div>
          </div>
          <div style={{ height: Math.max(220, others.length * 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={others} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
                <XAxis type="number" {...AXIS_STYLE} />
                <YAxis type="category" dataKey="region" {...AXIS_STYLE} width={100} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="papersSubmitted" name="Papers" fill={CHART_COLORS.secondary} radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-2">{r.leadingRegion.region} is shown above so the remaining regions stay comparable.</p>
        </AnalyticsCard>

        <AnalyticsCard title="Share of Papers by Region">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <MiniTile label="Papers" value={fmt(s.totalPapers)} />
            <MiniTile label="Accepted" value={fmt(s.accepted)} />
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={1.5}>
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={CHART_CATEGORICAL[i % CHART_CATEGORICAL.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend formatter={legendText} wrapperStyle={{ fontSize: 11 }} layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Submitted vs Accepted by Region">
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={submittedVsAccepted} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
              <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
              <XAxis dataKey="region" {...AXIS_STYLE} angle={-35} textAnchor="end" height={60} interval={0} />
              <YAxis {...AXIS_STYLE} width={40} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend formatter={legendText} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Submitted" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
              <Bar dataKey="Accepted" fill={CHART_COLORS.success} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsCard>

      <SectionLabel icon={MapPinned}>Region Analytics</SectionLabel>
      <AnalyticsCard>
        <FilteredTable
          rows={r.table}
          query={query} setQuery={setQuery}
          searchPlaceholder="Search regions…"
          chips={
            <>
              <StatChip label="Regions" value={r.regionsWithPapers} />
              <StatChip label="Papers" value={fmt(s.totalPapers)} />
              <StatChip label="Accepted" value={fmt(s.accepted)} />
            </>
          }
          columns={[
            { key: "region", label: "Region" },
            { key: "countries", label: "Countries", align: "right" },
            { key: "authorsSubmitted", label: "Authors Submitted", align: "right", render: (row) => fmt(row.authorsSubmitted) },
            { key: "authorsAccepted", label: "Authors Accepted", align: "right", render: (row) => fmt(row.authorsAccepted) },
            { key: "papersSubmitted", label: "Papers Submitted", align: "right", render: (row) => fmt(row.papersSubmitted) },
            { key: "papersAccepted", label: "Papers Accepted", align: "right", render: (row) => fmt(row.papersAccepted) },
            { key: "sharePct", label: "Share", align: "right", render: (row) => `${row.sharePct}%` },
          ]}
        />
      </AnalyticsCard>
    </div>
  );
}
