import { Fragment } from "react";
import type { AnalyticsData } from "../data";
import type { Conference } from "@/types/conference";
import { FileText, CheckCircle2, Users, Globe2, Sparkles, MapPin, Calendar, ChevronRight } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AnalyticsCard, AnalyticsStatCard, AnalyticsEmptyState } from "../components";
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE, STATUS_TONE, type Tone } from "../chart-theme";

export default function OverviewTab({ conference, data, onTabChange = () => {} }: { conference: Conference; data: AnalyticsData; onTabChange?: (tab: string) => void }) {
  const s = data.summary;
  const hasDomInt = s.domesticPapers != null;

  type GlanceRow = { label: string; count: number; share: string; total?: boolean; tone?: Tone; action?: { label: string; tab: string } };
  const glanceGroups = ([
    {
      group: "Decision Status",
      rows: [
        { label: "Papers Submitted", count: s.totalPapers, share: "100%", total: true, action: { label: "Details", tab: "submissions" } },
        { label: "Accepted", count: s.accepted, share: `${s.acceptanceRate}%`, tone: "success", action: { label: "Decisions", tab: "submissions" } },
        { label: "Conditionally Accepted", count: s.conditionallyAccepted, share: pct(s.conditionallyAccepted, s.totalPapers), tone: "warning" },
        { label: "Rejected", count: s.rejected, share: pct(s.rejected, s.totalPapers), tone: "danger" },
        { label: "Under Review", count: s.underReview, share: pct(s.underReview, s.totalPapers), tone: "neutral" },
      ],
    },
    hasDomInt && {
      group: "Geography",
      rows: [
        { label: `Domestic Papers (${s.domesticCountry})`, count: s.domesticPapers ?? 0, share: `${s.domesticPct}%`, action: { label: "By Country", tab: "countries" } },
        { label: "International Papers", count: s.internationalPapers ?? 0, share: `${s.internationalPct}%` },
      ],
    },
    {
      group: "Participation",
      rows: [
        { label: "Unique Authors", count: s.uniqueAuthors, share: "—", action: { label: "Authors", tab: "authors" } },
        s.organizations != null && { label: "Organizations", count: s.organizations, share: "—", action: { label: "Institutions", tab: "institutions" } },
        s.countries != null && { label: "Countries Represented", count: s.countries, share: "—", action: { label: "By Country", tab: "countries" } },
      ].filter(Boolean) as GlanceRow[],
    },
  ] as Array<false | { group: string; rows: GlanceRow[] }>).filter((g): g is { group: string; rows: GlanceRow[] } => g !== false);

  const location = [conference?.city, conference?.country].filter(Boolean).join(", ");
  const dateRange = formatDateRange(conference?.startDate, conference?.endDate);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AnalyticsStatCard icon={FileText} tone="primary" value={fmt(s.totalPapers)} label="Total Papers"
          sublabel={hasDomInt ? `${s.domesticPct}% domestic · ${s.internationalPct}% intl.` : null} />
        <AnalyticsStatCard icon={CheckCircle2} tone="success" value={fmt(s.accepted)} label="Accepted"
          sublabel={`${s.acceptanceRate}% acceptance rate`} />
        <AnalyticsStatCard icon={Users} tone="secondary" value={fmt(s.uniqueAuthors)} label="Unique Authors" />
        {s.countries != null ? (
          <AnalyticsStatCard icon={Globe2} tone="accent" value={fmt(s.countries)} label="Countries" sublabel={`${fmt(s.totalPapers)} papers in total`} />
        ) : (
          <AnalyticsStatCard icon={Globe2} tone="warning" value="—" label="Countries" sublabel="Not tracked for this conference" />
        )}
      </div>

      <AnalyticsCard>
        <div style={{ color: "var(--primary)" }} className="text-[11px] font-bold uppercase tracking-wide">Summary</div>
        <h3 style={{ color: "var(--navy)" }} className="text-xl font-extrabold tracking-tight mt-1">
          {conference?.acronym || conference?.name || "This conference"}
        </h3>
        {(location || dateRange) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {location && (
              <span style={{ color: "var(--ink-muted)" }} className="inline-flex items-center gap-1.5 text-xs font-medium">
                <MapPin size={13} /> {location}
              </span>
            )}
            {dateRange && (
              <span style={{ color: "var(--ink-muted)" }} className="inline-flex items-center gap-1.5 text-xs font-medium">
                <Calendar size={13} /> {dateRange}
              </span>
            )}
          </div>
        )}
        <p style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed mt-3">
          {conference?.acronym || "This conference"} received <b style={{ color: "var(--ink)" }}>{fmt(s.totalPapers)}</b> papers from <b style={{ color: "var(--ink)" }}>{fmt(s.uniqueAuthors)}</b> authors
          {s.countries != null && <> across <b style={{ color: "var(--ink)" }}>{s.countries}</b> countries{s.organizations != null && <> and <b style={{ color: "var(--ink)" }}>{fmt(s.organizations)}</b> organizations</>}</>}.{" "}
          <b style={{ color: "var(--ink)" }}>{fmt(s.accepted)}</b> were accepted at a <b style={{ color: "var(--ink)" }}>{s.acceptanceRate}%</b> acceptance rate, with <b style={{ color: "var(--ink)" }}>{fmt(s.rejected)}</b> rejected.
          {hasDomInt && <> Submissions were <b style={{ color: "var(--ink)" }}>{s.domesticPct}%</b> domestic ({s.domesticCountry}) and <b style={{ color: "var(--ink)" }}>{s.internationalPct}%</b> international.</>}
        </p>
      </AnalyticsCard>

      <div className="grid sm:grid-cols-2 gap-5">
        <AnalyticsCard title="Submissions Over Time">
          {data.submissionsOverTime ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.submissionsOverTime} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ovTimeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} width={40} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="cumulative" name="Submissions" stroke={CHART_COLORS.primary} strokeWidth={2.5} fill="url(#ovTimeFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState icon={Sparkles} title="Not enough data yet" message="Submission timing trends will appear here once this conference has more activity." />
          )}
        </AnalyticsCard>

        <AnalyticsCard title="Domestic vs International">
          {hasDomInt ? (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "Accepted", Domestic: s.domesticAccepted, International: s.internationalAccepted },
                  { name: "Rejected", Domestic: s.domesticRejected, International: s.internationalRejected },
                ]} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="name" {...AXIS_STYLE} />
                  <YAxis {...AXIS_STYLE} width={40} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Domestic" fill={CHART_COLORS.warning} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="International" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <AnalyticsEmptyState icon={Globe2} title="No country data" message="Domestic/international split needs author country data, which this conference doesn't have yet." />
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Conference at a Glance">
        <div className="overflow-x-auto -mx-1">
          <table className="ui-table ui-table-grouped w-full text-xs min-w-[460px] border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ color: "var(--ink-muted)" }} className="text-left px-3 py-2 font-semibold">Metric</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-right px-3 py-2 font-semibold">Count</th>
                <th style={{ color: "var(--ink-muted)" }} className="text-right px-3 py-2 font-semibold">Share</th>
                <th className="px-3 py-2 w-px" />
              </tr>
            </thead>
            <tbody>
              {glanceGroups.map((g, gi) => (
                <Fragment key={g.group}>
                  <tr>
                    <td
                      colSpan={4}
                      style={{ color: "var(--ink-faint)", borderTop: gi > 0 ? "1px solid var(--border)" : "none" }}
                      className={`px-3 text-[10px] font-bold uppercase tracking-wide ${gi > 0 ? "pt-3 pb-1.5" : "pt-1 pb-1.5"}`}
                    >
                      {g.group}
                    </td>
                  </tr>
                  {g.rows.map((r, ri) => {
                    const t = r.tone ? STATUS_TONE[r.tone] : null;
                    return (
                      <tr key={r.label} style={{ background: r.total ? "var(--muted)" : undefined }} className={`transition-colors ${ri % 2 ? "ui-row-alt" : ""}`}>
                        <td style={{ color: "var(--ink)", borderBottom: "1px solid var(--muted)" }} className={`px-3 py-2.5 ${r.total ? "font-bold" : "font-medium"}`}>
                          <span className="inline-flex items-center gap-2">
                            {t && <span style={{ background: t.dot }} className="w-1.5 h-1.5 rounded-full inline-block shrink-0" />}
                            {r.label}
                          </span>
                        </td>
                        <td style={{ color: "var(--navy)", borderBottom: "1px solid var(--muted)" }} className="px-3 py-2.5 text-right font-bold tabular-nums">{fmt(r.count)}</td>
                        <td style={{ borderBottom: "1px solid var(--muted)" }} className="px-3 py-2.5 text-right">
                          {t ? (
                            <span style={{ background: t.bg, color: t.fg }} className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold tabular-nums">
                              {r.share}
                            </span>
                          ) : (
                            <span style={{ color: "var(--ink-faint)" }} className="tabular-nums">{r.share}</span>
                          )}
                        </td>
                        <td style={{ borderBottom: "1px solid var(--muted)" }} className="px-3 py-2.5 text-right whitespace-nowrap">
                          {r.action && (
                            <button
                              onClick={() => onTabChange(r.action?.tab ?? "")}
                              style={{ background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid var(--primary-soft-border)" }}
                              className="inline-flex items-center justify-center gap-1 w-32 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap hover:bg-[var(--primary-soft-hover)] transition-colors cursor-pointer"
                            >
                              {r.action.label} <ChevronRight size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </AnalyticsCard>
    </div>
  );
}

function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 1000) / 10}%`;
}

function fmt(n: number | string | null | undefined) {
  return typeof n === "number" ? n.toLocaleString() : n;
}

function formatDateRange(startDate: string | undefined, endDate: string | undefined) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  const monthShort = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
  if (start.getTime() === end.getTime()) return `${start.getDate()} ${monthShort(start)} ${start.getFullYear()}`;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${start.getDate()}–${end.getDate()} ${monthShort(end)} ${end.getFullYear()}`;
  return `${start.getDate()} ${monthShort(start)} – ${end.getDate()} ${monthShort(end)} ${end.getFullYear()}`;
}
