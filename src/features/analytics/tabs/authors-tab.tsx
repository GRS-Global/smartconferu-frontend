import type { ReactNode } from "react";
import { useState } from "react";
import type { AnalyticsData } from "../data";
import { Users, Repeat, UserCheck, User, Database, BarChart3, Globe2 } from "lucide-react";
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

// A prominent callout above a histogram, calling out its single biggest bucket — e.g. "most
// authors only ever submit once" is the headline, the full distribution is the supporting detail.
function Callout({ label, descriptor, value, sublabel }: { label: string; descriptor: string; value: ReactNode; sublabel: string }) {
  return (
    <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-bold uppercase tracking-wide">{label}</div>
        <div style={{ color: "var(--ink-muted)" }} className="text-xs mt-0.5">{descriptor}</div>
      </div>
      <div className="text-right shrink-0">
        <div style={{ color: "var(--navy)" }} className="text-xl font-extrabold leading-none">{value}</div>
        <div style={{ color: "var(--ink-faint)" }} className="text-[11px] mt-0.5">{sublabel}</div>
      </div>
    </div>
  );
}

export default function AuthorsTab({ data }: { data: AnalyticsData }) {
  const a = data.authors;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "domestic" | "international">("all");

  if (!a) {
    return (
      <AnalyticsCard>
        <AnalyticsEmptyState icon={Users} title="No author analytics yet" message="Author breakdowns need more submission volume before patterns are meaningful." />
      </AnalyticsCard>
    );
  }

  const countryTable = data.countries?.table;
  const authorsSubmittedTotal = countryTable?.reduce((sum, c) => sum + c.authorsSubmitted, 0) ?? 0;
  const authorsAcceptedTotal = countryTable?.reduce((sum, c) => sum + c.authorsAccepted, 0);
  const domesticAuthors = countryTable?.find((c) => c.country === data.summary.domesticCountry)?.authorsSubmitted;
  const domesticPct = countryTable && domesticAuthors != null ? Math.round((domesticAuthors / authorsSubmittedTotal) * 1000) / 10 : null;

  return (
    <div className="space-y-5">
      <SectionLabel icon={Database}>Conference Data</SectionLabel>
      <p style={{ color: "var(--ink-faint)" }} className="text-xs -mt-2.5">Author counts across all submissions in this conference, regardless of decision status.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AnalyticsStatCard
          icon={Users} tone="primary" value={fmt(a.unique)} label="Unique Authors"
          sublabel={domesticPct != null ? `${domesticPct}% domestic · ${Math.round((100 - domesticPct) * 10) / 10}% international` : null}
        />
        <AnalyticsStatCard icon={Repeat} tone="secondary" value={fmt(a.repeatAuthors)} label="Repeat Authors" sublabel={`${a.repeatAuthorsPct}% with 2+ papers`} />
        <AnalyticsStatCard icon={UserCheck} tone="success" value={a.avgAuthorsPerPaper} label="Avg. Authors / Paper" sublabel={`Max ${a.maxAuthorsOnPaper} on one paper`} />
        <AnalyticsStatCard icon={User} tone="warning" value={fmt(a.singleAuthorPapers)} label="Single-Author Papers" sublabel={`${a.singleAuthorPapersPct}% of submissions`} />
      </div>

      <SectionLabel icon={BarChart3}>Author Analytics by Submission</SectionLabel>
      <div className="grid sm:grid-cols-2 gap-5">
        <AnalyticsCard title="Submissions per Author">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Average", value: a.avgSubmissionsPerAuthor },
              { label: "Maximum", value: a.maxSubmissionsByAuthor },
              { label: "Single Paper", value: fmt(a.singlePaperAuthors) },
              { label: "Multiple Papers", value: fmt(a.multiPaperAuthors) },
            ].map((k) => (
              <div key={k.label} style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-lg px-2 py-2 text-center">
                <div style={{ color: "var(--navy)" }} className="text-sm font-extrabold">{k.value}</div>
                <div style={{ color: "var(--ink-faint)" }} className="text-[9.5px] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{k.label}</div>
              </div>
            ))}
          </div>
          <Callout
            label="Single-Paper Authors" descriptor="1 submission"
            value={fmt(a.singlePaperAuthors)} sublabel={`authors · ${pct(a.singlePaperAuthors, a.unique)} of unique`}
          />
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.submissionsPerAuthorHistogram} margin={{ top: 8, right: 8, left: -20, bottom: 16 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="bucket" {...AXIS_STYLE} label={{ value: "Submissions", position: "insideBottom", offset: -4, fontSize: 11, fill: CHART_COLORS.axisText }} />
                <YAxis {...AXIS_STYLE} width={44} label={{ value: "Authors", angle: -90, position: "insideLeft", fontSize: 11, fill: CHART_COLORS.axisText }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="authors" name="Authors" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Authors per Submission">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Average", value: a.avgAuthorsPerPaper },
              { label: "Maximum", value: a.maxAuthorsOnPaper },
              { label: "Single Author", value: fmt(a.singleAuthorPapers) },
              { label: "Multi Author", value: fmt(a.multiAuthorPapers) },
            ].map((k) => (
              <div key={k.label} style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-lg px-2 py-2 text-center">
                <div style={{ color: "var(--navy)" }} className="text-sm font-extrabold">{k.value}</div>
                <div style={{ color: "var(--ink-faint)" }} className="text-[9.5px] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{k.label}</div>
              </div>
            ))}
          </div>
          <Callout
            label="Single-Author Papers" descriptor="1 author"
            value={fmt(a.singleAuthorPapers)} sublabel={`papers · ${a.singleAuthorPapersPct}% of submissions`}
          />
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.authorsPerSubmissionHistogram} margin={{ top: 8, right: 8, left: -20, bottom: 16 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="bucket" {...AXIS_STYLE} label={{ value: "Authors", position: "insideBottom", offset: -4, fontSize: 11, fill: CHART_COLORS.axisText }} />
                <YAxis {...AXIS_STYLE} width={44} label={{ value: "Papers", angle: -90, position: "insideLeft", fontSize: 11, fill: CHART_COLORS.axisText }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="papers" name="Papers" fill={CHART_COLORS.secondary} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsCard>
      </div>

      <SectionLabel icon={Globe2}>Author Analytics by Country</SectionLabel>
      {countryTable ? (
        <AnalyticsCard>
          <FilteredTable
            rows={countryTable}
            query={query} setQuery={setQuery}
            filter={{ value: filter, onChange: setFilter }}
            matchDomestic={(r) => r.country === data.summary.domesticCountry}
            searchPlaceholder="Search countries…"
            chips={
              <>
                <StatChip label="Countries" value={fmt(countryTable.length)} />
                <StatChip label="Authors" value={fmt(authorsSubmittedTotal)} />
                <StatChip label="Accepted Authors" value={fmt(authorsAcceptedTotal)} />
              </>
            }
            columns={[
              { key: "country", label: "Country", render: (r) => <span className="inline-flex items-center gap-1.5"><CountryFlag country={r.country} /> {r.country}</span> },
              { key: "authorsSubmitted", label: "Authors — Papers Submitted", align: "right", render: (r) => fmt(r.authorsSubmitted) },
              { key: "authorsAccepted", label: "Authors — Papers Accepted", align: "right", render: (r) => fmt(r.authorsAccepted) },
            ]}
          />
        </AnalyticsCard>
      ) : (
        <AnalyticsCard>
          <AnalyticsEmptyState icon={Globe2} title="No country data" message="Author country isn't tracked for this conference yet." />
        </AnalyticsCard>
      )}
    </div>
  );
}
