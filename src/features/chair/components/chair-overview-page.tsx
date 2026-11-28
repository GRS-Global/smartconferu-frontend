"use client";

import { AlertTriangle, Bell, Calendar, Check, ChevronRight, Clock, CreditCard, FileCheck, FileText, Link2, Mail, Send, Settings, Star, Ticket, Users, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/ui/copy-button";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { DetailsDrawer } from "@/features/author/components/details-drawer";
import { daysToISO, toDate } from "@/features/author/format";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { ConferenceHero, DeadlineChip, HeroLink } from "@/features/workspace/components/hero";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { SetupGuide, type SetupStage } from "./setup-guide";
import { comingSoonHref } from "@/lib/navigation";
import { getNotificationService } from "@/services/notifications";
import type { AppNotification } from "@/types/notification";
import type { ChairPaper } from "@/types/chair";
import { CHAIR_STAGES, chairStageOf } from "../stage";
import { prRowOf } from "../peer-review";
import { useChairConference } from "../use-chair-conference";
import { cfpManagerHref, chairPaperHref } from "@/lib/routes";

/* The chair's Dashboard for one conference (the prototype's ChairConferenceOverview), markup for markup: the conference card, the
   "Submission link" card, the setup card, "Needs your attention", the metric strip, the submission pipeline, the papers waiting on the
   chair, submissions over time, review analytics, top topics, recent submissions and, beside them, readiness, key dates, reviewer
   workload, registrations, quick actions, recent activity and "Coming soon". Left out because the database holds nothing for them:
   registrations (the card says so), the Call for Papers' "People", the conference profile card once setup is finished. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const DEFAULT_TRACKS = ["General Track"];
const plural = (n: number) => (n === 1 ? "" : "s");
/** "in 27 days" · "today" · "17 days ago" (the prototype's relDayLabel). */
const rel = (days: number | null) => (days == null ? "—" : days < 0 ? `${Math.abs(days)} day${days === -1 ? "" : "s"} ago` : days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`);
/** "Oct 15, 2026" (the prototype's formatDisplayDate). */
const dayText = (iso: string) => toDate(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
/** "Aug 29, 2026 · 9:14 AM" (the prototype's formatAlertDateTime). */
const stamp = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`; };

function Panel({ title, sub, children, aside, headClass = "mb-3", subClass = "mb-4" }: { title: ReactNode; sub?: string; children: ReactNode; aside?: ReactNode; headClass?: string; subClass?: string }) {
  return (
    <section style={CARD} className="rounded-2xl bg-white p-5">
      {sub ? (
        <>
          <h2 className="mb-1 text-sm font-bold text-navy">{title}</h2>
          <p className={`${subClass} text-xs text-ink-faint`}>{sub}</p>
        </>
      ) : (
        <div className={`${headClass} flex items-center justify-between`}><h2 className="text-sm font-bold text-navy">{title}</h2>{aside}</div>
      )}
      {children}
    </section>
  );
}

function MiniBar({ segments }: { segments: Array<{ value: number; color: string; label: string }> }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      {segments.map((s) => (s.value > 0 ? <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} /> : null))}
    </div>
  );
}

/* A cell in the metrics strip (the strip draws the dividers). Numbers stay navy — colour is for the segments / legend underneath. */
function Stat({ icon: Icon, label, value, sub, href, external, segments, legend }: { icon: LucideIcon; label: string; value: number | string; sub?: string; href?: string; external?: boolean; segments?: Array<{ value: number; color: string; label: string }>; legend?: Array<{ label: string; value: number; color: string }> }) {
  const body = (
    <>
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted"><Icon size={13} aria-hidden="true" className="shrink-0 text-ink-faint" /> {label}</div>
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span style={{ letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }} className="text-[28px] font-extrabold leading-none text-navy"><AnimatedNumber value={value} /></span>
        {sub && <span className="text-xs font-semibold text-ink-faint">{sub}</span>}
      </div>
      {segments && <div className="mt-2.5"><MiniBar segments={segments} /></div>}
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {legend.map((l) => <span key={l.label} className="flex items-center gap-1 text-[10px] font-semibold text-ink-muted"><span style={{ background: l.color }} className="inline-block h-2 w-2 rounded-full" aria-hidden="true" /> {l.label} {l.value}</span>)}
        </div>
      )}
    </>
  );
  const cls = "block min-w-0 bg-white p-5 text-left";
  if (!href) return <div className={cls}>{body}</div>;
  return external ? <a href={href} className={`${cls} transition-colors hover:bg-canvas`}>{body}</a> : <Link href={href} className={`${cls} transition-colors hover:bg-canvas`}>{body}</Link>;
}

/** Cumulative submissions over time (the prototype's OverviewSparkline). */
function Sparkline({ dates, deadline }: { dates: number[]; deadline: number | null }) {
  const height = 56;
  if (dates.length < 2) return <p className="text-xs text-ink-faint">Not enough dated submissions to chart a trend yet.</p>;
  const sorted = [...dates].sort((a, b) => a - b);
  const t0 = sorted[0];
  const t1 = Math.max(sorted[sorted.length - 1], deadline ?? 0);
  const span = Math.max(1, t1 - t0);
  const W = 100;
  const pts = sorted.map((d, i): [number, number] => [((d - t0) / span) * W, i + 1]);
  const maxY = pts.length;
  const coords = pts.map(([x, y]) => `${x.toFixed(2)},${(height - (y / maxY) * (height - 6) - 3).toFixed(2)}`);
  const area = `0,${height} ${coords.join(" ")} ${pts[pts.length - 1][0].toFixed(2)},${height}`;
  const deadlineX = deadline != null ? ((deadline - t0) / span) * W : null;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Submissions over time">
      <polygon points={area} fill="var(--primary-soft)" />
      <polyline points={coords.join(" ")} fill="none" stroke="var(--primary)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {deadlineX != null && deadlineX >= 0 && deadlineX <= W && <line x1={deadlineX} y1="0" x2={deadlineX} y2={height} stroke="var(--danger)" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/** Read-only stars (the prototype's StarRating), half stars included. */
function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const fillPct = value >= n ? 100 : value >= n - 0.5 ? 50 : 0;
          return (
            <span key={n} className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
              <Star size={size} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--border-strong)" }} className="absolute inset-0" />
              {fillPct > 0 && <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}><Star size={size} strokeWidth={1.75} aria-hidden="true" fill="var(--warning)" style={{ color: "var(--warning-ink)" }} /></span>}
            </span>
          );
        })}
      </div>
      <span className="ml-1.5 text-xs text-ink-faint">{value ? `${value} / 5` : "/ 5"}</span>
    </div>
  );
}

/* Average-score distribution — one row per score band (5 → 1). `buckets[n-1]` = papers whose average score rounds to n. */
const SCORE_BANDS = [
  { score: 5, tone: "var(--success)", note: "Strong accept" },
  { score: 4, tone: "var(--success)", note: "Accept" },
  { score: 3, tone: "var(--warning)", note: "Borderline" },
  { score: 2, tone: "var(--danger)", note: "Weak" },
  { score: 1, tone: "var(--danger)", note: "Reject" },
];
function ScoreDistribution({ buckets }: { buckets: number[] }) {
  const total = buckets.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...buckets);
  return (
    <div className="space-y-1.5">
      {SCORE_BANDS.map(({ score, tone, note }) => {
        const count = buckets[score - 1];
        return (
          <div key={score} className="flex items-center gap-2.5">
            <span className="w-3 shrink-0 text-right text-[11px] font-bold text-ink-muted">{score}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-muted"><div className="h-full rounded-md" style={{ width: `${(count / max) * 100}%`, background: tone, opacity: count ? 1 : 0 }} /></div>
            <span className="w-16 shrink-0 text-[10px] font-semibold text-ink-faint">{note}</span>
            <span style={{ color: count ? "var(--ink)" : "var(--ink-faint)" }} className="w-4 shrink-0 text-right text-[11px] font-bold">{count}</span>
          </div>
        );
      })}
      <div className="pt-0.5 text-[10px] text-ink-faint">{total} paper{total === 1 ? "" : "s"} scored</div>
    </div>
  );
}

const ATTENTION_TONE = {
  critical: { color: "var(--danger-ink)", bg: "var(--danger-soft)", label: "Action needed" },
  warning: { color: "var(--warning-ink)", bg: "var(--warning-soft)", label: "Follow up" },
  suggestion: { color: "var(--primary)", bg: "var(--primary-soft)", label: "Suggestion" },
} as const;

/* One "needs attention" item (the prototype's AttentionRow): a labelled severity pill, the sentence, and the action. */
const Row = ({ tone, text, cta, href }: { tone: "critical" | "warning" | "suggestion"; text: string; cta: string | null; href?: string }) => {
  const t = ATTENTION_TONE[tone];
  return (
    <div className="grid grid-cols-[116px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3">
      <span style={{ background: t.bg, color: t.color }} className="inline-flex items-center gap-1.5 justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold">
        <span aria-hidden="true" style={{ background: t.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" />
        {t.label}
      </span>
      <p className="text-sm leading-snug text-ink">{text}</p>
      {cta && href ? <Link href={href} style={{ color: "var(--primary)" }} className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-primary-soft">{cta} <ChevronRight size={13} aria-hidden="true" /></Link> : <span />}
    </div>
  );
};

/** The status pill of a paper in lists (the prototype's StatusBadge). */
const STATUS_PILL: Record<string, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  submitted: { label: "Submitted", color: "var(--primary)", bg: "var(--primary-soft)", Icon: FileCheck },
  under_review: { label: "Under Review", color: "var(--warning-ink)", bg: "var(--warning-soft)", Icon: Clock },
  accepted: { label: "Accepted", color: "var(--success-ink)", bg: "var(--success-soft)", Icon: Check },
  rejected: { label: "Rejected", color: "var(--danger-ink)", bg: "var(--danger-soft)", Icon: XCircle },
  withdrawn: { label: "Withdrawn", color: "var(--ink-muted)", bg: "var(--muted)", Icon: XCircle },
};
/** The key a paper's pill shows (the prototype's statusKeyOf over the loader's status). */
const statusKeyOf = (p: ChairPaper) => (p.withdrawn ? "withdrawn" : p.outcome === "accept" || p.outcome === "registered" ? "accepted" : p.outcome === "reject" ? "rejected" : p.outcome === "plagiarism_clear" || (p.outcome !== "upload_pending" && p.outcome !== "no_decision") ? "under_review" : "submitted");
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_PILL[status] ?? STATUS_PILL.submitted;
  return <span style={{ color: c.color, background: c.bg }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><c.Icon size={12} strokeWidth={2.5} aria-hidden="true" />{c.label}</span>;
}

function ProgressRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--success)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

function ChecklistRow({ done, label, href, external }: { done: boolean; label: string; href: string; external?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ background: done ? "var(--success)" : "transparent", border: done ? "none" : "1.5px solid var(--border-strong)" }} className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" aria-hidden="true">{done && <Check size={10} className="text-white" />}</span>
      <span className={`flex-1 text-xs font-semibold ${done ? "text-ink-muted line-through" : "text-ink"}`}>{label}</span>
      {!done && (external ? <a href={href} className="shrink-0 text-[11px] font-bold text-primary hover:underline">Fix</a> : <Link href={href} className="shrink-0 text-[11px] font-bold text-primary hover:underline">Fix</Link>)}
    </div>
  );
}


export function ChairOverviewPage({ slug }: { slug: string }) {
  const { state, retry } = useChairConference(slug, { board: true, pool: true, details: true, info: true, settings: true });
  const [drawer, setDrawer] = useState(false);
  // Recent activity: this conference's notifications for the signed-in user (not the copies of emails).
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  useEffect(() => {
    let off = false;
    getNotificationService().then((s) => s.list()).then((list) => { if (!off) setAlerts(list.filter((n) => n.kind !== "email" && n.conference?.slug === slug)); }).catch(() => undefined);
    return () => { off = true; };
  }, [slug]);

  const gate = workspaceGate(state, retry, { title: "Dashboard", loadingLabel: "Loading the dashboard", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the dashboard." });
  if (gate || state.status !== "ready" || !state.board || !state.pool) return gate;
  const { conference, roles, others, data, board, pool, details, info, settings } = state;
  const e = encodeURIComponent(conference.id);
  const review = (filter: string) => `/chair/${e}/peer-review?filter=${filter}`;
  const reviewers = `/chair/${e}/peer-review/reviewers`;
  const registrations = comingSoonHref("registration");

  const subs = data.papers;
  const active = subs.filter((p) => !p.withdrawn);
  const rows = active.map((p) => prRowOf(p, board, data.screening));
  const stageCounts = Object.fromEntries(CHAIR_STAGES.map((st) => [st.key, subs.filter((p) => chairStageOf(p, data.screening).key === st.key).length]));
  const accepted = active.filter((p) => p.outcome === "accept" || p.outcome === "registered").length;
  const rejected = active.filter((p) => p.outcome === "reject").length;
  const decided = accepted + rejected;
  const rate = decided > 0 ? Math.round((accepted / decided) * 100) : null;
  const expected = rows.reduce((a, r) => a + r.reviewers.length, 0);
  const received = rows.reduce((a, r) => a + r.reviewsIn, 0);
  const pending = Math.max(0, expected - received);
  const pct = expected > 0 ? Math.round((received / expected) * 100) : 0;
  const needs = rows.filter((r) => !r.decided && r.canAssign && r.reviewers.length === 0);
  const ready = rows.filter((r) => r.stage === "ready");
  const workload = pool.reviewers.map((rev) => {
    const mine = rows.flatMap((r) => r.reviewers.filter((x) => (x.r.awaitingInvite ? x.r.reviewerId === rev.memberId : rev.userId !== null && x.r.reviewerId === rev.userId)));
    return { rev, assigned: mine.length, done: mine.filter((x) => x.state === "done").length };
  }).sort((a, b) => b.assigned - a.assigned || b.done - a.done);
  const loads = workload.filter((w) => w.assigned > 0).map((w) => w.assigned);
  const heaviest = loads.length ? Math.max(...loads) : 0;
  const lightest = loads.length ? Math.min(...loads) : 0;
  const maxLoad = Math.max(1, ...workload.map((w) => w.assigned));

  // The dates the chair set in Conference Details (abstract, submission and review deadlines) and the conference dates. Nothing is
  // guessed: a date that is not set is left out (BUG-004 in docs/qa/BUG_REPORT.md).
  const abstractDeadline = info?.abstractDeadline ?? "";
  const submissionDeadline = info?.submissionDeadline ?? "";
  const reviewDeadline = info?.reviewDeadline ?? "";
  const milestones = [
    { key: "abstract", label: "Abstract deadline", iso: abstractDeadline, end: undefined as string | undefined },
    { key: "submission", label: "Full-paper deadline", iso: submissionDeadline, end: undefined },
    { key: "review", label: "Reviews due", iso: reviewDeadline, end: undefined },
    { key: "event", label: "Conference dates", iso: conference.startDate, end: conference.endDate },
  ].filter((m) => m.iso).map((m) => ({ ...m, days: daysToISO(m.end || m.iso) })).sort((a, b) => toDate(a.iso).getTime() - toDate(b.iso).getTime());
  const missingDates = [!submissionDeadline && "submission", !reviewDeadline && "review"].filter(Boolean) as string[];
  const next = milestones.find((m) => m.days != null && m.days >= 0) ?? milestones[milestones.length - 1];

  const critical: Array<{ text: string; cta: string; href: string }> = [];
  const warnings: Array<{ text: string; cta: string; href: string }> = [];
  const suggestions: Array<{ text: string; cta: string | null; href?: string }> = [];
  if (needs.length) critical.push({ text: `${needs.length} submission${plural(needs.length)} ${needs.length === 1 ? "has" : "have"} no reviewer assigned.`, cta: "Assign reviewers", href: review("needs") });
  if (pending > 0) warnings.push({ text: `${pending} assigned review${plural(pending)} ${pending === 1 ? "is" : "are"} still outstanding.`, cta: "Open peer review", href: review("waiting") });
  if (ready.length) warnings.push({ text: `${ready.length} paper${plural(ready.length)} ${ready.length === 1 ? "has" : "have"} every review in and no decision recorded yet.`, cta: "Record decisions", href: review("ready") });
  if (loads.length > 1 && heaviest - lightest >= 3) suggestions.push({ text: `Reviewer load is uneven — the busiest reviewer has ${heaviest} papers, the lightest ${lightest}.`, cta: "Rebalance", href: reviewers });
  if (rows.length > 0 && pool.reviewers.length === 0) suggestions.push({ text: "No reviewers have been invited to this conference.", cta: "Invite reviewers", href: reviewers });
  if (rows.length > 0 && decided === rows.length) suggestions.push({ text: "Every submission has a decision — you're ready to move to camera-ready.", cta: null });
  const attention = critical.length + warnings.length + suggestions.length;

  const queue = rows.filter((r) => !r.decided && r.canAssign && (r.reviewers.length === 0 || r.stage === "ready")).map((r) => ({ r, decide: r.reviewers.length > 0 }));
  const scored = rows.filter((r) => r.avg != null);
  const buckets = [1, 2, 3, 4, 5].map((n) => scored.filter((r) => Math.round(r.avg as number) === n).length);
  const overall = scored.length ? Math.round((scored.reduce((a, r) => a + (r.avg as number), 0) / scored.length) * 10) / 10 : null;
  const allReviews = rows.flatMap((r) => r.reviewers.flatMap((x) => (x.r.review ? [x.r.review] : [])));
  const tally: Record<string, number> = { Accept: 0, "Re-review": 0, Reject: 0 };
  allReviews.forEach((v) => { const d = String(v.answers["f-decision"] ?? ""); if (d in tally) tally[d] += 1; });
  const tallyTotal = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
  const recColor: Record<string, string> = { Accept: "var(--success)", Reject: "var(--danger)", "Re-review": "var(--warning)" };
  const borderline = rows.filter((r) => !r.decided && (r.split || (r.avg != null && r.avg >= 2.5 && r.avg <= 3.5)));
  const dates = subs.map((p) => Date.parse(p.submittedAt ?? "")).filter((t) => !Number.isNaN(t));
  const recent = [...subs].sort((a, b) => (Date.parse(b.lastUpdate) || 0) - (Date.parse(a.lastUpdate) || 0)).slice(0, 5);
  const topicTally: Record<string, number> = {};
  subs.forEach((p) => p.keywords.forEach((k) => { topicTally[k] = (topicTally[k] || 0) + 1; }));
  const topTopics = Object.entries(topicTally).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const maxAssigned = rows.length > 0 && rows.every((r) => r.decided || r.reviewers.length > 0);
  // The first things a new conference needs, read from what is saved (the prototype's setup guide, without the guided tour).
  const filled = (v: string | undefined) => Boolean(v && v.trim());
  const hasTracks = pool.tracks.length > 0 && !(pool.tracks.length === 1 && pool.tracks[0] === "General Track");
  // Tracks switched off (Settings › Submissions): nothing to set up about them.
  const tracksOn = settings?.submission.tracksOn !== false;
  const tracksDone = !tracksOn || hasTracks;
  const detailsDone = Boolean(info && filled(info.startDate) && filled(info.endDate) && filled(info.city) && filled(info.country) && filled(info.webPage) && filled(info.contactEmail));
  const reviewDue = Boolean(info && filled(info.reviewDeadline)) || Boolean(settings && filled(settings.timeline.closesAt));
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const submitUrl = `${origin}/submit/${e}`;
  const allAssigned = rows.length > 0 && rows.every((r) => r.decided || r.reviewers.length > 0);
  const allIn = expected > 0 && received >= expected;
  const allDecided = rows.length > 0 && decided === rows.length;
  const allTold = rows.length > 0 && rows.every((r) => !r.decided || !r.unsent);
  const stages: SetupStage[] = [
    {
      key: "setup", name: "Set up", sub: "get the basics in place", tasks: [
        { label: "Fill in the conference details", desc: "Dates, venue, website and a contact email.", done: detailsDone, href: `/chair/${e}/settings` },
        { label: "Set the submission deadline", desc: "The last day authors can send a paper.", done: Boolean(info && filled(info.submissionDeadline)), href: `/chair/${e}/settings` },
        ...(tracksOn ? [{ label: "Add your tracks", desc: "Authors pick one of these when they submit.", done: hasTracks, href: `/chair/${e}/settings/submissions` }] : []),
        { label: "Review the decision types", desc: "The outcomes you can give a paper.", done: data.decisionTypes.length > 0, href: `/chair/${e}/settings/decision` },
      ]
    },
    {
      key: "open", name: "Open submissions", sub: "your conference is ready for papers", tasks: [
        { label: "Share the submission link", desc: "Send it to authors — they sign in (or register) and submit their paper here.", done: data.papers.length > 0, copy: submitUrl },
        { label: "Invite at least 3 reviewers", desc: `${pool.reviewers.length} invited so far.`, done: pool.reviewers.length >= 3, href: reviewers },
        { label: "Check presentation types and guidelines", desc: "What authors can submit, and the rules they read first.", done: tracksDone && data.decisionTypes.length > 0, href: `/chair/${e}/settings/submissions` },
        { label: "Set the review deadline", desc: "The day reviewers' reviews are due.", done: reviewDue, href: `/chair/${e}/settings/review` },
      ]
    },
    {
      key: "review", name: "Review", sub: "papers are with reviewers", tasks: [
        { label: "Assign reviewers to every paper", desc: `${needs.length} paper${plural(needs.length)} without a reviewer.`, done: allAssigned, href: review("needs") },
        { label: "Collect every review", desc: expected ? `${received} of ${expected} reviews are in.` : "Reviews appear once papers are assigned.", done: allIn, href: review("waiting") },
      ]
    },
    {
      key: "decisions", name: "Decisions", sub: "tell the authors", tasks: [
        { label: "Record a decision on every paper", desc: `${rows.length - decided} paper${plural(rows.length - decided)} still undecided.`, done: allDecided, href: review("ready") },
        { label: "Notify the authors", desc: "Send each decision, with the comments you chose to share.", done: allDecided && allTold, href: review("decided") },
      ]
    },
  ];
  const setupLeft = stages[0].tasks.filter((t) => !t.done).length;
  const profileFields = info ? [info.name, info.about, info.webPage, info.contactEmail, info.primaryArea, info.startDate, info.city, info.country, info.submissionDeadline] : [];
  const profilePct = profileFields.length ? Math.round((profileFields.filter((v) => filled(v)).length / profileFields.length) * 100) : 0;
  const cfpOn = data.cfpStatus === "published" || data.cfpStatus === "closed";
  const checklist = [
    { done: cfpOn, label: "Call for Papers published", href: cfpManagerHref(slug, "publish"), external: false },
    ...(tracksOn ? [{ done: pool.tracks.length > 1 || (pool.tracks.length === 1 && pool.tracks[0] !== "General Track"), label: "Tracks defined", href: `/chair/${e}/settings/submissions`, external: false }] : []),
    { done: pool.reviewers.length >= 3, label: "At least 3 reviewers invited", href: reviewers },
    { done: maxAssigned, label: "Every submission has reviewers", href: review("needs") },
    { done: expected > 0 && received >= expected, label: "All assigned reviews submitted", href: review("waiting") },
    { done: rows.length > 0 && decided === rows.length, label: "All decisions recorded", href: review("ready") },
  ];
  const checklistPct = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  const quick: Array<{ label: string; icon: LucideIcon; href: string; external?: boolean }> = [
    { label: "Assign reviewers", icon: Users, href: review("needs") },
    { label: "Record decisions", icon: FileCheck, href: review("ready") },
    { label: "Edit Call for Papers", icon: Send, href: cfpManagerHref(slug), external: false },
    { label: "Registrations", icon: Ticket, href: registrations },
    { label: "Conference details", icon: Settings, href: `/chair/${e}/settings` },
  ];
  const comingSoon: Array<{ label: string; icon: LucideIcon }> = [{ label: "Program & schedule", icon: Calendar }, { label: "Payments & invoicing", icon: CreditCard }, { label: "Communications", icon: Mail }];

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="overview" screening={data.screening}>
      <PageHeader title="Dashboard" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page space-y-6 p-8">
        <ConferenceHero conference={conference} details={details} onDetails={() => setDrawer(true)} extraChip={next && <DeadlineChip deadline={{ open: next.days != null && next.days >= 0, text: `${next.label} · ${rel(next.days)}` }} />}>
          <HeroLink href={`/chair/${e}/settings`} icon={Settings} primary>Settings</HeroLink>
        </ConferenceHero>

        {/* The link authors use to submit; it exists once the Call for Papers is published. */}
        {data.cfpStatus === "closed" && (
          <div style={{ border: "1px solid #FECACA", background: "var(--danger-soft)" }} className="flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4">
            <span style={{ background: "#FFFFFF", color: "var(--danger-ink)" }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Link2 size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-danger-ink">Call for Papers closed</div>
              <p className="text-xs text-ink-soft">The submission link no longer takes papers. Papers already sent are not affected.</p>
            </div>
          </div>
        )}
        {data.cfpStatus === "review" && (
          <div style={{ border: "1px dashed var(--warning-border)" }} className="flex flex-wrap items-center gap-4 rounded-2xl bg-warning-soft px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-warning-ink"><Link2 size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-navy">Waiting for approval</div>
              <p className="text-xs text-ink-soft">Your Call for Papers was sent to the Super Admin. The submission link opens as soon as it is approved.</p>
            </div>
          </div>
        )}
        {data.cfpStatus !== "published" && data.cfpStatus !== "closed" && data.cfpStatus !== "review" && (
          <div style={{ border: "1px dashed var(--border-strong)" }} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-5 py-4">
            <span style={{ background: "var(--muted)" }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-faint"><Link2 size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-navy">Submission link</div>
              <p className="text-xs text-ink-muted">Publish your Call for Papers to get the link authors use to submit.</p>
            </div>
            {setupLeft > 0
              ? <button type="button" disabled title={`${setupLeft} thing${plural(setupLeft)} left to fill in in "Set up your conference"`} className="h-9 cursor-not-allowed rounded-xl bg-primary px-4 text-xs font-bold text-white opacity-50">Publish CFP</button>
              : <Link href={cfpManagerHref(slug, "publish")} className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs font-bold text-white transition-shadow hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]">Publish CFP</Link>}
          </div>
        )}
        {data.cfpStatus === "published" && (
          <div style={CARD} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-5 py-4">
            <span style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Link2 size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-navy">Submission link</div>
              <p className="text-xs text-ink-muted">Send this to authors — they sign in (or register) and submit their paper here.</p>
              <code className="break-all font-sans text-xs text-primary">{submitUrl}</code>
            </div>
            <CopyButton text={submitUrl} label="Copy link" />
          </div>
        )}

        <SetupGuide stages={stages} profilePct={profilePct} profileHref={`/chair/${e}/settings`} />

        <section style={CARD} className="overflow-hidden rounded-2xl bg-white">
          <div style={{ borderBottom: attention ? "1px solid var(--border)" : "none" }} className="flex items-center justify-between px-5 py-4"><h2 className="text-base font-bold tracking-tight text-navy">Needs your attention</h2>{attention > 0 && <span className="text-[12.5px] font-semibold text-ink-muted">{attention} item{plural(attention)}</span>}</div>
          {attention === 0 ? <div className="flex items-center gap-3 px-5 py-6"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success-soft"><Check size={16} aria-hidden="true" className="text-success-ink" /></span><p className="text-sm text-ink-soft">All clear — nothing needs action right now.</p></div> : (
            <div className="divide-y divide-muted">
              {critical.map((c) => <Row key={c.text} tone="critical" {...c} />)}
              {warnings.map((c) => <Row key={c.text} tone="warning" {...c} />)}
              {suggestions.map((c) => <Row key={c.text} tone="suggestion" {...c} />)}
            </div>
          )}
        </section>

        <div style={{ background: "var(--border)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl lg:grid-cols-3 xl:grid-cols-6">
          <Stat icon={FileText} label="Submitted" value={subs.length} href={`/chair/${e}`} segments={CHAIR_STAGES.map((st) => ({ value: stageCounts[st.key] ?? 0, color: st.color, label: st.label }))} />
          <Stat icon={FileCheck} label="Review progress" value={`${pct}%`} sub={expected ? `${received}/${expected} reviewed` : "no reviews yet"} href={review("waiting")} segments={[{ value: received, color: "var(--primary)", label: "Received" }, { value: pending, color: "var(--muted)", label: "Pending" }]} />
          <Stat icon={Check} label="Decisions" value={decided} sub={`of ${rows.length}`} href={review("decided")} legend={[{ label: "Acc", value: accepted, color: "var(--success-ink)" }, { label: "Rej", value: rejected, color: "var(--danger-ink)" }, { label: "Pending", value: Math.max(0, rows.length - decided), color: "var(--warning-ink)" }]} />
          <Stat icon={Star} label="Acceptance rate" value={rate == null ? "—" : `${rate}%`} sub={rate == null ? "no decisions" : `${accepted}/${decided}`} />
          <Stat icon={Users} label="Reviewers" value={pool.reviewers.length} sub={loads.length ? `${(loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(1)} avg load` : "none active"} href={reviewers} />
          <Stat icon={Ticket} label="Registrations" value="—" sub="coming soon" href={registrations} />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Panel title="Submission pipeline" sub="Where each submitted paper is now: Initial check → Plagiarism check → Review → Decision → Registration.">
              {subs.length === 0 ? <p className="text-sm text-ink-faint">No submissions yet.</p> : (
                <div className="space-y-3">
                  {[{ label: "Submitted", value: subs.length, color: "var(--navy)" }, ...CHAIR_STAGES.map((st) => ({ label: st.label, value: stageCounts[st.key] ?? 0, color: st.color }))].map((r) => (
                    <div key={r.label} className="flex items-center gap-3"><div className="w-28 shrink-0 text-xs font-semibold text-ink-muted">{r.label}</div><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(r.value / subs.length) * 100}%`, background: r.color }} /></div><div className="w-6 shrink-0 text-right text-xs font-bold text-ink">{r.value}</div></div>
                  ))}
                </div>
              )}
            </Panel>

            {queue.length > 0 && (
              <Panel title={<span className="flex items-center gap-2"><AlertTriangle size={14} aria-hidden="true" className="text-warning-ink" /> Papers waiting on you</span>} aside={<span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-bold text-warning-ink">{queue.length}</span>}>
                <div className="space-y-2">
                  {queue.slice(0, 6).map(({ r, decide }) => (
                    <div key={r.paper.dbId} className="flex items-center gap-3 py-1.5">
                      <span className="w-16 shrink-0 text-[11px] font-bold text-ink-faint">{r.paper.id}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-ink">{r.paper.title}</div><div className="text-[11px] text-ink-muted">{decide ? "All reviews in — needs a decision" : "No reviewers assigned"}</div></div>
                      <Link href={decide ? chairPaperHref(slug, r.paper.id, "review") : review("needs")} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-90 ${decide ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>{decide ? "Decide" : "Assign"}</Link>
                    </div>
                  ))}
                </div>
                {queue.length > 6 && <Link href={review("all")} className="mt-3 inline-block text-xs font-bold text-primary hover:underline">+{queue.length - 6} more</Link>}
              </Panel>
            )}

            <Panel title="Submissions over time" aside={dates.length > 1 ? <span className="flex items-center gap-2 text-[11px] font-semibold text-ink-faint"><span className="flex items-center gap-1"><span className="inline-block h-0.5 w-2.5 bg-primary" /> cumulative</span><span className="flex items-center gap-1"><span className="inline-block h-0 w-2.5 border-t border-dashed border-danger" /> deadline</span></span> : undefined}>
              <Sparkline dates={dates} deadline={submissionDeadline ? toDate(submissionDeadline).getTime() : null} />
              {dates.length > 1 && <div className="mt-1.5 flex justify-between"><span className="text-[10px] font-semibold text-ink-faint">{new Date(Math.min(...dates)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><span className="text-[10px] font-semibold text-ink-faint">{subs.filter((p) => p.submittedAt).length} submitted</span></div>}
            </Panel>

            <Panel title="Review analytics" sub="How the review round is shaping up — score spread, how reviewers are voting, and the calls that still need judgement.">
              {scored.length === 0 && allReviews.length === 0 ? <div className="rounded-lg bg-canvas px-4 py-6 text-center text-xs font-medium text-ink-faint">No reviews have been submitted yet — analytics appear once reviewers start scoring papers.</div> : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <div className="mb-2.5 flex items-center justify-between"><span className="text-xs font-bold text-ink-muted">Score distribution</span>{overall != null && <span className="inline-flex items-center gap-1.5"><Stars value={overall} /><span className="text-xs font-bold text-navy">{overall.toFixed(1)}</span></span>}</div>
                    {scored.length > 0 ? <ScoreDistribution buckets={buckets} /> : <p className="text-xs text-ink-faint">No papers have a full set of scores yet.</p>}
                  </div>
                  <div>
                    <div className="mb-2.5 flex items-center justify-between"><span className="text-xs font-bold text-ink-muted">Reviewer recommendations</span><span className="text-[11px] font-semibold text-ink-faint">{allReviews.length} review{plural(allReviews.length)}</span></div>
                    <div className="space-y-2.5">{Object.entries(tally).map(([rec, n]) => <div key={rec} className="flex items-center gap-2.5"><span className="w-20 shrink-0 text-xs font-semibold text-ink">{rec}</span><div className="h-4 flex-1 overflow-hidden rounded-md bg-muted"><div style={{ width: `${(n / tallyTotal) * 100}%`, background: recColor[rec], opacity: n ? 1 : 0 }} className="h-full rounded-md" /></div><span style={{ color: n ? "var(--ink)" : "var(--ink-faint)" }} className="w-4 shrink-0 text-right text-[11px] font-bold">{n}</span></div>)}</div>
                  </div>
                </div>
              )}
              {borderline.length > 0 && (
                <div className="mt-5 border-t border-muted pt-4">
                  <div className="mb-1 flex items-center gap-2"><AlertTriangle size={13} aria-hidden="true" className="text-warning-ink" /><span className="text-xs font-bold text-navy">Calls that need judgement</span><span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-ink">{borderline.length}</span></div>
                  <p className="mb-2.5 text-[11px] text-ink-faint">Undecided papers where reviewers disagree, or the average sits right on the accept line.</p>
                  <div className="space-y-1.5">{borderline.slice(0, 5).map((r) => <Link key={r.paper.dbId} href={chairPaperHref(slug, r.paper.id, "review")} className="flex w-full items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-primary hover:bg-canvas"><span className="w-16 shrink-0 text-[11px] font-bold text-ink-faint">{r.paper.id}</span><span className="flex-1 truncate text-xs font-semibold text-ink">{r.paper.title}</span>{r.split && <span className="shrink-0 rounded bg-warning-soft px-1.5 py-0.5 text-[9px] font-bold text-warning-ink">SPLIT VOTE</span>}{r.avg != null && <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-ink-muted"><Star size={10} aria-hidden="true" /> {r.avg}</span>}<ChevronRight size={13} aria-hidden="true" className="shrink-0 text-ink-faint" /></Link>)}</div>
                </div>
              )}
            </Panel>

            {topTopics.length > 0 && (
              <Panel title="Top topics" sub="Most common keywords across all submissions" subClass="mb-3">
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {topTopics.map(([topic, n]) => (
                    <div key={topic} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-xs font-semibold capitalize text-ink">{topic}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(n / topTopics[0][1]) * 100}%`, background: "var(--secondary)" }} /></div>
                      <span className="w-4 text-right text-[11px] font-bold text-ink-faint">{n}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel headClass="mb-4" title={<>Recent submissions {subs.length > 0 && <span className="font-medium text-ink-faint">({subs.length})</span>}</>} aside={subs.length > 0 ? <Link href={`/chair/${e}`} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">View all <ChevronRight size={13} aria-hidden="true" /></Link> : undefined}>
              {subs.length === 0 ? <p className="text-sm text-ink-faint">Submissions will appear here once authors start submitting.</p> : (
                <div className="space-y-2.5">
                  {recent.map((p) => {
                    const r = rows.find((x) => x.paper.dbId === p.dbId);
                    const total = r?.reviewers.length ?? 0; const done = r?.reviewsIn ?? 0;
                    return (
                      <Link key={p.dbId} href={chairPaperHref(slug, p.id, "review")} className="block rounded-xl border border-line p-4 transition-all hover:border-primary hover:shadow-sm">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="mb-0.5 text-[11px] font-semibold text-ink-faint">{p.id}</div><div className="mb-1 text-sm font-semibold leading-snug text-ink">{p.title}</div><div className="truncate text-xs text-ink-muted">{p.authors.map((a) => a.name).join(", ")}</div></div><StatusBadge status={statusKeyOf(p)} /></div>
                        {total > 0 && <div className="mt-2.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div style={{ width: `${(done / total) * 100}%`, background: done >= total ? "var(--success)" : "var(--primary)" }} className="h-full" /></div><span className="shrink-0 text-[10px] font-bold text-ink-faint">{done}/{total} reviews</span></div>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <section style={CARD} className="rounded-2xl bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <ProgressRing pct={checklistPct} />
                <div><h2 className="text-sm font-bold text-navy">Conference readiness</h2><div className="text-xs font-semibold text-ink-muted">{checklistPct}% complete</div></div>
              </div>
              <div className="space-y-2.5">{checklist.map((c) => <ChecklistRow key={c.label} {...c} />)}</div>
            </section>

            <Panel title={<span className="flex items-center gap-2"><Calendar size={14} aria-hidden="true" /> Key dates</span>}>
              <div className="space-y-2.5">{milestones.map((m) => {
                const past = m.days != null && m.days < 0; const soon = m.days != null && m.days >= 0 && m.days <= 14; return (
                  <div key={m.key} className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span aria-hidden="true" style={{ background: past ? "var(--border-strong)" : soon ? "var(--warning)" : "var(--primary)" }} className="h-1.5 w-1.5 shrink-0 rounded-full" /><span className={`truncate text-xs font-semibold ${past ? "text-ink-faint" : "text-ink"}`}>{m.label}</span></div><div className="shrink-0 text-right"><div className={`text-[11px] font-semibold ${past ? "text-ink-faint" : "text-ink-soft"}`}>{m.end ? `${dayText(m.iso)} – ${dayText(m.end)}` : dayText(m.iso)}</div><div className={`text-xs font-bold ${past ? "text-ink-faint" : soon ? "text-warning-ink" : "text-ink-muted"}`}>{rel(m.days)}</div></div></div>
                );
              })}</div>
              {missingDates.length > 0 && <p className="mt-3 text-[10px] leading-snug text-ink-faint">Not set yet: {missingDates.join(", ")} deadline{missingDates.length > 1 ? "s" : ""}. <Link href={`/chair/${e}/settings`} className="font-semibold text-primary hover:underline">Set {missingDates.length > 1 ? "them" : "it"} in Conference Details</Link>.</p>}
            </Panel>

            <Panel title={<span className="flex items-center gap-2"><Users size={14} aria-hidden="true" /> Reviewer workload</span>} aside={<Link href={reviewers} className="text-xs font-bold text-primary hover:underline">Manage</Link>}>
              {workload.length === 0 ? <p className="text-xs text-ink-faint">No reviewers invited yet.</p> : (
                <div className="space-y-2.5">{workload.slice(0, 6).map((w) => <div key={w.rev.memberId} className="flex items-center gap-2.5"><span className="w-28 shrink-0 truncate text-xs font-semibold text-ink">{w.rev.name}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div style={{ width: `${(w.assigned / maxLoad) * 100}%` }} className="h-full rounded-full bg-primary" /></div><span className="w-12 shrink-0 text-right text-[10px] font-bold text-ink-faint">{w.done}/{w.assigned}</span></div>)}</div>
              )}
            </Panel>

            <Panel title={<span className="flex items-center gap-2"><Ticket size={14} aria-hidden="true" /> Registrations</span>} aside={<a href={registrations} className="text-xs font-bold text-primary hover:underline">Open</a>}>
              <p className="text-xs text-ink-faint">No registrations yet.</p>
            </Panel>

            <Panel title="Quick actions">
              <div className="space-y-1">
                {quick.map((a) => {
                  const cls = "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink transition-colors hover:bg-canvas";
                  const inner = <><a.icon size={15} aria-hidden="true" className="shrink-0 text-primary" /><span className="flex-1">{a.label}</span><ChevronRight size={14} aria-hidden="true" className="text-ink-faint" /></>;
                  return a.external ? <a key={a.label} href={a.href} className={cls}>{inner}</a> : <Link key={a.label} href={a.href} className={cls}>{inner}</Link>;
                })}
              </div>
            </Panel>

            {alerts.length > 0 && (
              <Panel title={<span className="flex items-center gap-2"><Bell size={14} aria-hidden="true" /> Recent activity</span>}>
                <div className="space-y-3">
                  {alerts.slice(0, 4).map((a) => (
                    <div key={a.id} className="flex items-start gap-2.5">
                      <span aria-hidden="true" style={{ background: a.read ? "var(--border-strong)" : "var(--primary)" }} className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                      <div className="min-w-0"><p className="text-xs leading-snug text-ink">{a.title}</p><p className="mt-0.5 text-[10px] text-ink-faint">{stamp(a.createdAt)}</p></div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <div style={{ border: "1px dashed var(--border-strong)", background: "var(--canvas)" }} className="rounded-xl p-5">
              <h2 className="mb-3 text-xs font-semibold text-ink-muted">Coming soon</h2>
              <div className="space-y-2">
                {comingSoon.map((c) => (
                  <div key={c.label} className="flex items-center gap-2.5 text-sm font-semibold text-ink-faint"><c.icon size={15} aria-hidden="true" className="shrink-0" /><span className="flex-1">{c.label}</span><span className="text-[11.5px] font-semibold">Soon</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DetailsDrawer open={drawer} conference={conference} details={details} tracks={pool.tracks.length ? pool.tracks : DEFAULT_TRACKS} onClose={() => setDrawer(false)} />
    </ConferenceShell>
  );
}
