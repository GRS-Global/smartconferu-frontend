import { useState, Fragment, type ReactNode } from "react";
import type { AnalyticsData } from "../data";
import {
  FileText, CheckCircle2, XCircle, Clock3, PauseCircle, RotateCcw, Flag, HelpCircle,
  Users, User, Globe2, Building2, Calendar, Tag, PieChart as PieChartIcon, LayoutList, Check,
  type LucideIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { AnalyticsCard, AnalyticsStatCard, AnalyticsTable, AnalyticsEmptyState, CountryFlag, SectionLabel, StatChip, SearchInput, FilteredTable } from "../components";
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from "../chart-theme";

const SHOW_OPTIONS = [
  { id: "general", label: "General" },
  { id: "rounds", label: "Rounds" },
  { id: "bycountry", label: "By Country" },
  { id: "byinstitution", label: "By Institution" },
  { id: "bydate", label: "By Date" },
  { id: "keywords", label: "Keywords" },
  { id: "decisions", label: "Decisions" },
];

const SECTION_KEY: Record<string, string> = {
  general: "general", decisions: "decisions",
  rounds: "rounds", bycountry: "bycountry", byinstitution: "byinstitution", bydate: "bydate", keywords: "keywords",
};

const DECISION_ICON: Record<string, LucideIcon> = {
  "Accepted": CheckCircle2, "Conditional Accept": Clock3, "Rejected": XCircle,
  "Hold": PauseCircle, "Revision": RotateCcw, "Flag Clear": Flag, "No Decision Yet": HelpCircle,
};

function fmt(n: number | string | null | undefined) {
  return typeof n === "number" ? n.toLocaleString() : n;
}
function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 1000) / 10}%`;
}

export default function SubmissionsTab({ data }: { data: AnalyticsData }) {
  const s = data.summary;
  const [show, setShow] = useState<string[]>(["general"]);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<"all" | "domestic" | "international">("all");
  const [instQuery, setInstQuery] = useState("");
  const [instFilter, setInstFilter] = useState<"all" | "domestic" | "international">("all");
  const [keywordQuery, setKeywordQuery] = useState("");

  // Newest selection goes to the front — that's what drives "most recently clicked shows on top".
  // "General" can't be switched off when it's the only thing selected — it's the floor, so the
  // view never lands on "nothing selected".
  const toggleShow = (id: string) => {
    setShow((prev) => {
      if (prev.includes(id)) {
        if (id === "general" && prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [id, ...prev];
    });
  };

  // Dedupe show[] down to distinct section keys, keeping only the first (= most recent) occurrence
  // of each — this is what turns click order into render order.
  const orderedKeys: string[] = [];
  const seenKeys = new Set<string>();
  show.forEach((id) => {
    const key = SECTION_KEY[id];
    if (key && !seenKeys.has(key)) { seenKeys.add(key); orderedKeys.push(key); }
  });

  const singlePct = data.authors?.singleAuthorPapersPct ?? 0;
  const multiPct = Math.round((100 - singlePct) * 10) / 10;

  const sections: Record<string, ReactNode> = {
    // How many authors papers tend to have — general submission shape, not decision-outcome data
    // (Decision Breakdown + Paper Composition both live under "decisions" below).
    general: (
      <div className="space-y-5">
        {data.authors ? (
          <>
            <SectionLabel icon={LayoutList}>Charts</SectionLabel>
            <AnalyticsCard title="Authors per Paper" className="max-w-lg">
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Average", value: data.authors.avgAuthorsPerPaper },
                  { label: "Maximum", value: data.authors.maxAuthorsOnPaper },
                  { label: "Single Author", value: fmt(data.authors.singleAuthorPapers) },
                  { label: "Multi Author", value: fmt(data.authors.multiAuthorPapers) },
                ].map((k) => (
                  <div key={k.label} style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-lg px-2 py-2 text-center">
                    <div style={{ color: "var(--navy)" }} className="text-sm font-extrabold">{k.value}</div>
                    <div style={{ color: "var(--ink-faint)" }} className="text-[9.5px] font-semibold uppercase tracking-wide mt-0.5 leading-tight">{k.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.authors.authorsPerSubmissionHistogram} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="bucket" {...AXIS_STYLE} />
                    <YAxis {...AXIS_STYLE} width={36} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="papers" name="Papers" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsCard>
          </>
        ) : (
          <AnalyticsEmptyState icon={Users} title="Not enough data" message="Author-count breakdowns need more submission volume." />
        )}

        {s.domesticPapers != null && (
          <AnalyticsCard>
            <div style={{ color: "var(--navy)" }} className="text-sm font-bold text-center mb-3">Key Metrics</div>
            <AnalyticsTable
              rowKey={(r) => r.metric}
              columns={[
                { key: "metric", label: "" },
                { key: "all", label: "All", align: "right" },
                { key: "domestic", label: "Domestic", align: "right" },
                { key: "international", label: "International", align: "right" },
              ]}
              rows={[
                { metric: "Submissions", all: fmt(s.totalPapers), domestic: fmt(s.domesticPapers), international: fmt(s.internationalPapers) },
                { metric: "Accepted", all: fmt(s.accepted), domestic: fmt(s.domesticAccepted), international: fmt(s.internationalAccepted) },
                { metric: "Acceptance Rate", all: `${s.acceptanceRate}%`, domestic: `${s.domesticAcceptRate}%`, international: `${s.internationalAcceptRate}%` },
              ]}
              initialCount={3}
            />
          </AnalyticsCard>
        )}
      </div>
    ),

    // Decision-outcome data + paper composition — both live under "Decisions"; General no longer
    // duplicates either.
    decisions: (
      <div className="space-y-5">
        <SectionLabel icon={PieChartIcon}>Decision Breakdown</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AnalyticsStatCard icon={FileText} tone="primary" value={fmt(s.totalPapers)} label="Total Papers" sublabel="100% of total" />
          {data.decisionBreakdown.map((d) => {
            const Icon = DECISION_ICON[d.label] || HelpCircle;
            return (
              <AnalyticsStatCard
                key={d.label} icon={Icon} tone={d.tone} value={fmt(d.count)}
                label={d.label.toUpperCase()} sublabel={`${pct(d.count, s.totalPapers)} of total`}
                progress={s.totalPapers ? d.count / s.totalPapers : 0}
              />
            );
          })}
        </div>

        {data.authors && (
          <>
            <SectionLabel icon={Users}>Paper Composition</SectionLabel>
            <AnalyticsCard>
              <div className="flex items-center justify-between mb-2.5">
                <span style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold">Single vs. Multi-Author Papers</span>
                <span style={{ color: "var(--ink-faint)" }} className="text-xs">{fmt(data.authors.singleAuthorPapers + data.authors.multiAuthorPapers)} papers</span>
              </div>
              <div className="w-full h-9 rounded-full overflow-hidden flex shadow-inner" style={{ background: "var(--muted)" }}>
                <div
                  className="h-full flex items-center justify-center text-xs font-extrabold transition-all duration-500"
                  style={{ width: `${singlePct}%`, background: "var(--warning)", color: "#FFFFFF" }}
                >
                  {singlePct >= 12 ? `${singlePct}%` : ""}
                </div>
                <div
                  className="h-full flex items-center justify-center text-xs font-extrabold transition-all duration-500"
                  style={{ width: `${multiPct}%`, background: "var(--secondary)", color: "#FFFFFF" }}
                >
                  {multiPct >= 12 ? `${multiPct}%` : ""}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-3">
                  <div style={{ background: "var(--warning-soft)", color: "var(--warning-ink)" }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <div style={{ color: "var(--navy)" }} className="text-lg font-extrabold leading-none">{fmt(data.authors.singleAuthorPapers)}</div>
                    <div style={{ color: "var(--ink-muted)" }} className="text-[11px] font-semibold mt-0.5 truncate">Single Author Papers</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div style={{ background: "var(--secondary-soft)", color: "var(--secondary)" }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={18} />
                  </div>
                  <div className="min-w-0">
                    <div style={{ color: "var(--navy)" }} className="text-lg font-extrabold leading-none">{fmt(data.authors.multiAuthorPapers)}</div>
                    <div style={{ color: "var(--ink-muted)" }} className="text-[11px] font-semibold mt-0.5 truncate">Multi Author Papers</div>
                  </div>
                </div>
              </div>
            </AnalyticsCard>
          </>
        )}

        <SectionLabel icon={LayoutList}>Charts</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-5">
          <AnalyticsCard title="Decision Breakdown">
            <div className="relative mx-auto" style={{ height: 190, width: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: "Accepted", value: s.accepted }, { name: "Rejected", value: s.rejected }]} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                    <Cell fill={CHART_COLORS.success} />
                    <Cell fill={CHART_COLORS.danger} />
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div style={{ color: "var(--navy)" }} className="text-2xl font-extrabold">{fmt(s.accepted + s.rejected)}</div>
                <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-bold uppercase tracking-wide">Decisions</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-5 mt-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--ink)" }}>
                <span style={{ background: CHART_COLORS.success }} className="w-2 h-2 rounded-full inline-block" />
                Accepted {fmt(s.accepted)} ({pct(s.accepted, s.accepted + s.rejected)})
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--ink)" }}>
                <span style={{ background: CHART_COLORS.danger }} className="w-2 h-2 rounded-full inline-block" />
                Rejected {fmt(s.rejected)} ({pct(s.rejected, s.accepted + s.rejected)})
              </span>
            </div>
          </AnalyticsCard>

          {data.authors && (
            <AnalyticsCard title="Paper Composition">
              <div className="relative mx-auto" style={{ height: 190, width: 190 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ name: "Single Author", value: data.authors.singleAuthorPapers }, { name: "Multi Author", value: data.authors.multiAuthorPapers }]} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                      <Cell fill={CHART_COLORS.warning} />
                      <Cell fill={CHART_COLORS.secondary} />
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div style={{ color: "var(--navy)" }} className="text-2xl font-extrabold">{fmt(data.authors.singleAuthorPapers + data.authors.multiAuthorPapers)}</div>
                  <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-bold uppercase tracking-wide">Papers</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-5 mt-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  <span style={{ background: CHART_COLORS.warning }} className="w-2 h-2 rounded-full inline-block" />
                  Single {fmt(data.authors.singleAuthorPapers)} ({singlePct}%)
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  <span style={{ background: CHART_COLORS.secondary }} className="w-2 h-2 rounded-full inline-block" />
                  Multi {fmt(data.authors.multiAuthorPapers)} ({multiPct}%)
                </span>
              </div>
            </AnalyticsCard>
          )}
        </div>
      </div>
    ),

    // A conference here has no CFP rounds (the database keeps none), so this is always the prototype's empty state.
    rounds: (
      <AnalyticsCard title="Rounds Analysis">
        <AnalyticsEmptyState title="No round data" message="This conference doesn't define multiple CFP rounds." />
      </AnalyticsCard>
    ),

    bycountry: (
      <AnalyticsCard title="Submission Analytics by Country">
        {data.countries ? (
          <FilteredTable
            rows={data.countries.table}
            query={countryQuery} setQuery={setCountryQuery}
            filter={{ value: countryFilter, onChange: setCountryFilter }}
            matchDomestic={(r) => r.country === s.domesticCountry}
            chips={<StatChip label="Countries" value={fmt(data.countries.unique)} />}
            columns={[
              { key: "country", label: "Country", render: (r) => <span className="inline-flex items-center gap-1.5"><CountryFlag country={r.country} /> {r.country}</span> },
              { key: "papersSubmitted", label: "Papers Submitted", align: "right", render: (r) => fmt(r.papersSubmitted) },
              { key: "papersAccepted", label: "Papers Accepted", align: "right", render: (r) => fmt(r.papersAccepted) },
              { key: "affiliations", label: "Unique Affiliations", align: "right", render: (r) => fmt(r.affiliations) },
            ]}
          />
        ) : (
          <AnalyticsEmptyState icon={Globe2} title="No country data" message="Author country isn't tracked for this conference yet." />
        )}
      </AnalyticsCard>
    ),

    byinstitution: (
      <AnalyticsCard title="Submission Analytics by Institution">
        {data.institutions ? (
          <FilteredTable
            rows={data.institutions.table}
            query={instQuery} setQuery={setInstQuery}
            filter={{ value: instFilter, onChange: setInstFilter }}
            matchDomestic={(r) => r.country === s.domesticCountry}
            chips={<StatChip label="Affiliations" value={fmt(data.institutions.unique)} />}
            columns={[
              { key: "name", label: "Affiliation" },
              { key: "country", label: "Country", render: (r) => <span className="inline-flex items-center gap-1.5"><CountryFlag country={r.country} /> {r.country}</span> },
              { key: "submitted", label: "Papers Submitted", align: "right", render: (r) => fmt(r.submitted) },
              { key: "accepted", label: "Papers Accepted", align: "right", render: (r) => fmt(r.accepted) },
            ]}
          />
        ) : (
          <AnalyticsEmptyState icon={Building2} title="No institution data" message="Author affiliations aren't normalized into institutions yet." />
        )}
      </AnalyticsCard>
    ),

    bydate: <DailyView data={data} s={s} />,

    keywords: (
      <AnalyticsCard title="Keywords">
        {data.keywordStats ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <StatChip label="Keywords" value={fmt(data.keywordStats.unique)} />
                <StatChip label="Listed" value={fmt(data.keywordStats.listed)} />
                <StatChip label="Mentions" value={fmt(data.keywordStats.mentions)} />
              </div>
              <SearchInput value={keywordQuery} onChange={setKeywordQuery} placeholder="Search keywords…" />
            </div>
            <div style={{ color: "var(--navy)" }} className="text-xs font-bold">
              Most Mentioned Keywords <span style={{ color: "var(--ink-faint)" }} className="font-normal">({data.topKeywords.length} listed of {fmt(data.keywordStats.unique)})</span>
            </div>
            <AnalyticsTable
              rowKey={(r) => r.keyword}
              columns={[
                { key: "sr", label: "Sr. No.", align: "right", render: (_r, i) => i + 1 },
                { key: "keyword", label: "Keyword" },
                { key: "count", label: "Mentions", align: "right", render: (r) => fmt(r.count) },
              ]}
              rows={data.topKeywords.filter((k) => k.keyword.toLowerCase().includes(keywordQuery.toLowerCase()))}
              initialCount={10}
            />
          </div>
        ) : (
          <AnalyticsEmptyState icon={Tag} title="No keywords yet" message="Keyword trends will appear once submissions start coming in." />
        )}
      </AnalyticsCard>
    ),
  };

  return (
    <div className="space-y-5">
      <AnalyticsCard>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: "var(--ink-faint)" }} className="text-[11px] font-bold uppercase tracking-wide mr-1 shrink-0">Show</span>
          {SHOW_OPTIONS.map((opt) => {
            const active = show.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleShow(opt.id)}
                aria-pressed={active}
                style={{
                  background: active ? "var(--primary-soft)" : "transparent",
                  color: active ? "var(--primary)" : "var(--ink-muted)",
                  border: `1px solid ${active ? "var(--primary-soft-border)" : "var(--border)"}`,
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors hover:bg-[var(--canvas)] shrink-0 cursor-pointer"
              >
                {active && <Check size={12} strokeWidth={3} />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </AnalyticsCard>

      {orderedKeys.length === 0 && (
        <AnalyticsCard>
          <AnalyticsEmptyState icon={LayoutList} title="Nothing selected" message="Pick one or more views above (General, Rounds, By Country, …) to show their data here." />
        </AnalyticsCard>
      )}

      {orderedKeys.map((key) => <Fragment key={key}>{sections[key]}</Fragment>)}
    </div>
  );
}

// Compact KPI tiles + a daily bar chart with the peak day highlighted in a different color, so
// the "Peak"/"Peak Date" tiles visually tie back to the one bar they describe.
function DailyView({ data, s }: { data: AnalyticsData; s: AnalyticsData["summary"] }) {
  if (!data.submissionsPerDay || !data.peakDay) {
    return (
      <AnalyticsCard title="Papers Submitted per Day">
        <AnalyticsEmptyState icon={Calendar} title="No daily data" message="Day-by-day submission timing isn't available for this conference yet." />
      </AnalyticsCard>
    );
  }

  const maxCount = Math.max(...data.submissionsPerDay.map((d) => d.count));

  return (
    <AnalyticsCard title="Papers Submitted per Day" subtitle={`Peak of ${data.peakDay.count} on ${data.peakDay.date}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: "Total", value: fmt(s.totalPapers) },
          { label: "Days", value: data.submissionWindowDays },
          { label: "Peak", value: data.peakDay.count },
          { label: "Peak Date", value: data.peakDay.date },
        ].map((k) => (
          <div key={k.label} style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-lg px-2 py-2.5 text-center">
            <div style={{ color: "var(--navy)" }} className="text-base font-extrabold">{k.value}</div>
            <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.submissionsPerDay} margin={{ top: 4, right: 4, left: -20, bottom: 20 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
            <XAxis dataKey="date" {...AXIS_STYLE} interval={5} angle={-40} textAnchor="end" height={50} />
            <YAxis {...AXIS_STYLE} width={32} label={{ value: "Papers", angle: -90, position: "insideLeft", fontSize: 11, fill: CHART_COLORS.axisText }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Papers" radius={[2, 2, 0, 0]}>
              {data.submissionsPerDay.map((d, i) => (
                <Cell key={i} fill={d.count === maxCount ? CHART_COLORS.warning : CHART_COLORS.primary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsCard>
  );
}
