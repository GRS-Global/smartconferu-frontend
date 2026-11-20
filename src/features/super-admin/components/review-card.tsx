"use client";
/* Submissions & review, read-only (the prototype's ReviewPages.jsx):
   ConferenceReviewCard (a conference's page): counts, reviewer coverage, late reviews, warnings and
     the paper list; no reviewer is named here.
   ReviewHealthCard (the dashboard): conferences whose review needs a look, worst first. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Clock, FileText, Info, Library, Users } from "lucide-react";
import type { AdminConference, AdminPaper } from "../services";
import { REVIEW_STAGES, RISK, reviewHealth, STAGE_BY_KEY, STAGE_COLORS } from "../review-health";
import { Badge, Card, CardTitle, fmtDate, SortTh, TONES, useSort, type Icon, type Tone } from "./ui";

export function Metric({ icon: IconC, label, value, sub, tone }: { icon: Icon; label: string; value: string | number; sub?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
      <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        <IconC size={14} style={{ color: tone ? TONES[tone].fg : "var(--primary)" }} />
        {label}
      </p>
      <p className="text-[22px] font-bold mt-1 tabular-nums" style={{ color: tone === "danger" ? "var(--danger)" : "var(--text)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function StageBadge({ stage }: { stage: string | null }) {
  const s = stage ? STAGE_BY_KEY[stage] : null;
  return <Badge tone={s?.tone ?? "neutral"}>{s?.label ?? stage ?? "—"}</Badge>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ConferenceReviewCard({ conferenceId, papers: all }: { conferenceId: string; papers: AdminPaper[] }) {
  const router = useRouter();
  const [stage, setStage] = useState<string | null>(null);
  const h = useMemo(() => reviewHealth(all), [all]);
  const order = REVIEW_STAGES.map((s) => s.key);
  const rows = useMemo(() => all.filter((p) => p.stage && (!stage || p.stage === stage)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)), [all, stage]);
  const { sorted, sort, toggle } = useSort(rows, {
    paper: { get: (p) => p.paperId },
    stage: { get: (p) => order.indexOf(p.stage ?? "") },
    reviewers: { get: (p) => (p.reviewers ?? []).filter((r) => r.status !== "declined" && r.status !== "removed").length - p.reviewersWanted },
    reviews: { get: (p) => p.reviewsIn, first: "desc" },
    avg: { get: (p) => p.averageScore, first: "desc" },
    decision: { get: (p) => p.decision ?? "" },
  });
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;

  if (h.papers === 0) {
    return (
      <Card className="mb-6">
        <CardTitle title="Submissions & review" />
        <p className="text-[13.5px] flex items-start gap-2" style={{ color: "var(--text-muted)" }}>
          <Info size={16} className="shrink-0 mt-px" />
          No papers submitted yet{h.drafts ? ` · ${plural(h.drafts, "draft")}` : ""}.
        </p>
      </Card>
    );
  }
  const [riskLabel, riskTone] = RISK[h.risk];
  return (
    <Card className="mb-6 !px-0 !pb-2">
      <div className="px-6">
        <CardTitle
          title="Submissions & review"
          subtitle="Counts only, no reviewer names"
          right={
            <Badge tone={riskTone}>
              {h.risk === "ok" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {riskLabel}
            </Badge>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric icon={FileText} label="Papers" value={h.papers} sub={[h.drafts && plural(h.drafts, "draft"), h.withdrawn && `${h.withdrawn} withdrawn`].filter(Boolean).join(" · ") || "submitted"} />
          <Metric icon={Users} label="Reviewer coverage" value={h.coverage == null ? "—" : `${h.coverage}%`} sub={`${h.fullyAssigned} of ${h.reviewable} papers have ${h.target} reviewers`} tone={h.coverage != null && h.coverage < 80 ? "warning" : "success"} />
          <Metric icon={ClipboardCheck} label="Reviews in" value={`${h.reviewsIn} / ${h.reviewsExpected}`} sub={`${plural(h.decided, "paper")} decided`} />
          <Metric icon={Clock} label="Overdue reviews" value={h.overdueReviews} sub="past their due date" tone={h.overdueReviews ? "danger" : "success"} />
          <Metric
            icon={CalendarClock}
            label="Reviews due"
            value={h.reviewDue ? fmtDate(h.reviewDue) : "—"}
            sub={h.daysToDue == null ? "" : h.daysToDue < 0 ? `${-h.daysToDue} days ago` : `in ${h.daysToDue} days`}
            tone={h.daysToDue != null && h.daysToDue < 0 ? "danger" : "primary"}
          />
        </div>

        {/* Pipeline: one bar, a segment per stage; a stage filters the list below. */}
        <div className="mt-5">
          <div className="flex h-3 rounded-full overflow-hidden" style={{ background: "var(--muted)" }} role="img" aria-label="Papers by review stage">
            {REVIEW_STAGES.filter((s) => h.byStage[s.key]).map((s) => (
              <span key={s.key} title={`${s.label}: ${h.byStage[s.key]}`} style={{ width: `${(h.byStage[s.key] / Math.max(1, h.papers)) * 100}%`, background: STAGE_COLORS[s.tone], opacity: stage && stage !== s.key ? 0.3 : 1 }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {REVIEW_STAGES.map((s) => {
              const n = h.byStage[s.key];
              const on = stage === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!n}
                  onClick={() => setStage(on ? null : s.key)}
                  aria-pressed={on}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
                  style={on ? { background: "var(--navy)", color: "#FFFFFF" } : { background: "#FFFFFF", border: "1px solid var(--border)", color: "var(--text-soft)" }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS[s.tone] }} />
                  {s.label} <span className="tabular-nums opacity-75">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {h.flags.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {h.flags.map((f) => (
              <li key={f.text} className="flex items-center gap-2 text-[13px] rounded-lg px-3 py-2" style={{ background: TONES[f.tone].bg, color: TONES[f.tone].fg }}>
                {f.tone === "primary" ? <Info size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                {f.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-x-auto mt-5">
        <table className="sa-table">
          <thead>
            <tr>
              {th("Paper", "paper", "!pl-6")}
              {th("Stage", "stage")}
              {th("Reviewers", "reviewers")}
              {th("Reviews in", "reviews")}
              {th("Avg score", "avg")}
              {th("Decision", "decision")}
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const assigned = (p.reviewers ?? []).filter((r) => r.status !== "declined" && r.status !== "removed").length;
              return (
                <tr key={p.id} className="sa-clickable cursor-pointer" onClick={() => router.push(`/super-admin/conferences/${conferenceId}/papers/${p.id}`)}>
                  <td className="!pl-6">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {p.paperId}
                    </p>
                    <p className="text-[12.5px] truncate max-w-[320px]" style={{ color: "var(--text-muted)" }}>
                      {p.title}
                    </p>
                  </td>
                  <td>
                    <StageBadge stage={p.stage} />
                  </td>
                  <td className="tabular-nums" style={{ color: assigned < p.reviewersWanted && p.stage !== "decided" ? "var(--warning)" : "var(--text-soft)" }}>
                    {assigned} of {p.reviewersWanted}
                  </td>
                  <td className="tabular-nums">
                    {p.reviewsIn} of {Math.max(assigned, p.reviewersWanted)}
                  </td>
                  <td className="tabular-nums">
                    {p.averageScore != null ? `${p.averageScore}/5` : "—"}
                    {p.split && (
                      <span title="Reviewers disagree" className="ml-1.5">
                        <Badge tone="warning">Split</Badge>
                      </span>
                    )}
                  </td>
                  <td>{p.decision ? <Badge tone="neutral">{p.decision}</Badge> : <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
                  <td className="pr-6 text-right">
                    <ChevronRight size={17} style={{ color: "var(--text-faint)" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="px-6 py-6 text-[13px]" style={{ color: "var(--text-muted)" }}>
            No papers here.
          </p>
        )}
      </div>
    </Card>
  );
}

/* Dashboard: conferences whose review needs a look, worst first. */
export function ReviewHealthCard({ conferences }: { conferences: { conference: AdminConference; papers: AdminPaper[] }[] }) {
  const rows = conferences
    .map(({ conference, papers }) => ({ c: conference, h: reviewHealth(papers) }))
    .filter(({ h }) => h.papers > 0)
    .sort((a, b) => ["high", "medium", "ok"].indexOf(a.h.risk) - ["high", "medium", "ok"].indexOf(b.h.risk) || b.h.overdueReviews - a.h.overdueReviews);
  return (
    <Card className="!px-0 !pb-2">
      <div className="px-6">
        <CardTitle title="Review health" subtitle="Submissions & review in the live conferences" />
      </div>
      {rows.length === 0 ? (
        <p className="px-6 pb-4 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
          No papers in review yet.
        </p>
      ) : (
        <ul className="-mt-2">
          {rows.map(({ c, h }) => {
            const [label, tone] = RISK[h.risk];
            return (
              <li key={c.id} style={{ borderTop: "1px solid var(--muted)" }}>
                <Link href={`/super-admin/conferences/${c.id}`} className="sa-row-link">
                  <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                    <Library size={17} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold truncate" style={{ color: "var(--text)" }}>
                      {c.acronym}
                    </span>
                    <span className="block text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>
                      {h.papers} papers · {h.coverage == null ? "—" : `${h.coverage}%`} covered · {h.reviewsIn}/{h.reviewsExpected} reviews in{h.overdueReviews ? ` · ${h.overdueReviews} overdue` : ""}
                    </span>
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                  <ChevronRight size={17} style={{ color: "var(--text-faint)" }} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
