import { useState } from "react";
import type { AnalyticsData } from "../data";
import { Globe2, LayoutList, Database } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AnalyticsCard, AnalyticsStatCard, AnalyticsEmptyState, CountryFlag, SectionLabel, StatChip, FilteredTable, MiniTile } from "../components";
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from "../chart-theme";

function fmt(n: number | string | null | undefined) {
  return typeof n === "number" ? n.toLocaleString() : n;
}

export default function CountriesTab({ data }: { data: AnalyticsData }) {
  const c = data.countries;
  const s = data.summary;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "domestic" | "international">("all");

  if (!c) {
    return (
      <AnalyticsCard>
        <AnalyticsEmptyState icon={Globe2} title="No country data" message="Author country isn't tracked for this conference yet." />
      </AnalyticsCard>
    );
  }

  const others = c.table.filter((r) => r.country !== c.leadingCountry.country).slice(0, 10);
  const papersSum = c.table.reduce((sum, r) => sum + r.papersSubmitted, 0);
  const acceptedSum = c.table.reduce((sum, r) => sum + r.papersAccepted, 0);
  const domesticCountryCount = c.table.filter((r) => r.country === s.domesticCountry).length;

  return (
    <div className="space-y-5">
      <SectionLabel icon={Database}>Domestic vs International</SectionLabel>
      <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-2.5">Papers by author country, from each submission&apos;s declared country field.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AnalyticsStatCard icon={Globe2} tone="primary" value={fmt(c.unique)} label="Unique Countries" sublabel={`${fmt(s.totalPapers)} papers in total`} />
        <AnalyticsStatCard tone="warning" value={`${fmt(s.domesticAccepted)} / ${fmt(s.domesticPapers)}`} label="Domestic Accepted / Papers" sublabel={`${s.domesticAcceptRate}% acceptance · ${s.domesticPct}% of submissions`} />
        <AnalyticsStatCard tone="secondary" value={`${fmt(s.internationalAccepted)} / ${fmt(s.internationalPapers)}`} label="International Accepted / Papers" sublabel={`${s.internationalAcceptRate}% acceptance · ${s.internationalPct}% of submissions`} />
        <AnalyticsStatCard tone="success" value={`${fmt(s.accepted)} / ${fmt(s.totalPapers)}`} label="Overall Accepted / Papers" sublabel={`${s.acceptanceRate}% acceptance`} />
      </div>

      <SectionLabel icon={LayoutList}>Charts</SectionLabel>
      <div className="grid sm:grid-cols-2 gap-5">
        <AnalyticsCard title="Domestic vs International">
          <div className="grid grid-cols-4 gap-2 mb-3">
            <MiniTile label="Domestic" value={fmt(s.domesticPapers)} />
            <MiniTile label="International" value={fmt(s.internationalPapers)} />
            <MiniTile label="Dom Accept %" value={`${s.domesticAcceptRate}%`} />
            <MiniTile label="Intl Accept %" value={`${s.internationalAcceptRate}%`} />
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Accepted", Domestic: s.domesticAccepted, International: s.internationalAccepted },
                  { name: "Rejected", Domestic: s.domesticRejected, International: s.internationalRejected },
                ]}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="name" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} width={40} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Domestic" name={`Domestic (${s.domesticCountry})`} fill={CHART_COLORS.warning} radius={[6, 6, 0, 0]} />
                <Bar dataKey="International" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Other Top Countries">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniTile label="Countries" value={fmt(c.unique)} />
            <MiniTile label="Top Country" value={<span className="inline-flex items-center gap-1.5"><CountryFlag country={c.leadingCountry.country} size={13} /> {c.leadingCountry.country}</span>} />
            <MiniTile label="Top Papers" value={fmt(c.leadingCountry.papers)} />
          </div>
          <div style={{ background: "var(--warning-soft)", border: "1px solid var(--warning-border)" }} className="rounded-xl p-3 flex items-center justify-between gap-3 mb-3">
            <div>
              <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-bold uppercase tracking-wide">Leading Country</div>
              <div style={{ color: "var(--navy)" }} className="text-sm font-bold flex items-center gap-1.5 mt-0.5">
                <CountryFlag country={c.leadingCountry.country} size={15} /> {c.leadingCountry.country}
              </div>
            </div>
            <div className="text-right">
              <div style={{ color: "var(--warning)" }} className="text-lg font-extrabold leading-none">{fmt(c.leadingCountry.papers)}</div>
              <div style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-0.5">papers · {c.leadingCountry.sharePct}% of total</div>
            </div>
          </div>
          <div style={{ height: Math.max(200, others.length * 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={others} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
                <XAxis type="number" {...AXIS_STYLE} />
                <YAxis type="category" dataKey="country" {...AXIS_STYLE} width={100} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="papersSubmitted" name="Papers" fill={CHART_COLORS.accent} radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-2">{c.leadingCountry.country} is shown above so the remaining countries stay comparable.</p>
        </AnalyticsCard>
      </div>

      <SectionLabel icon={Globe2}>Country Analytics</SectionLabel>
      <AnalyticsCard>
        <FilteredTable
          rows={c.table}
          query={query} setQuery={setQuery}
          filter={{ value: filter, onChange: setFilter }}
          matchDomestic={(r) => r.country === s.domesticCountry}
          searchPlaceholder="Search countries…"
          chips={
            <>
              <StatChip label="Countries" value={fmt(c.unique)} />
              <StatChip label="Papers" value={fmt(papersSum)} />
              <StatChip label="Accepted" value={fmt(acceptedSum)} />
              <StatChip label="Domestic" value={fmt(domesticCountryCount)} />
              <StatChip label="International" value={fmt(c.unique - domesticCountryCount)} />
            </>
          }
          columns={[
            { key: "country", label: "Country", render: (r) => <span className="inline-flex items-center gap-1.5"><CountryFlag country={r.country} /> {r.country}</span> },
            { key: "authorsSubmitted", label: "Authors Submitted", align: "right", render: (r) => fmt(r.authorsSubmitted) },
            { key: "authorsAccepted", label: "Authors Accepted", align: "right", render: (r) => fmt(r.authorsAccepted) },
            { key: "papersSubmitted", label: "Papers Submitted", align: "right", render: (r) => fmt(r.papersSubmitted) },
            { key: "papersAccepted", label: "Papers Accepted", align: "right", render: (r) => fmt(r.papersAccepted) },
            { key: "affiliations", label: "Unique Affiliations", align: "right", render: (r) => fmt(r.affiliations) },
            { key: "acceptanceRate", label: "Accept %", align: "right", render: (r) => `${r.acceptanceRate}%` },
          ]}
        />
      </AnalyticsCard>
    </div>
  );
}
