"use client";

import { AlarmClock, ArrowRight, Award, Calendar, CalendarPlus, CheckCircle2, Eye, EyeOff, FileCheck, History, Inbox, LayoutGrid, Lock, PenLine, Rows3, Search, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { DetailsDrawer } from "@/features/author/components/details-drawer";
import { downloadIcs, fmtDay, toDate } from "@/features/author/format";
import { conferenceOver } from "@/features/author/status";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { ConferenceHero, HeroButton, HeroChip } from "@/features/workspace/components/hero";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { openPrototypePage } from "@/lib/navigation";
import type { ReviewerPaper } from "@/types/reviewer";
import { reviewDest, reviewerActivityDest, reviewerCertificatesDest } from "../links";
import { REVIEW_STATUS_ORDER, reviewRows, reviewerNumbers, type ReviewRow, type ReviewerNumbers } from "../status";
import { useReviewerWorkspace } from "../use-reviewer-workspace";
import { AssignmentDialogs, type Respond } from "./assignment-dialogs";
import { ReviewCard, ReviewsTable } from "./review-parts";

/* Reviewer · conference Dashboard (the prototype's ReviewerHome) — built around the reviewer's questions: what do I do next and by
   when, how much is left, which paper. So: the conference in one line (details and "Add to calendar" beside it); "Your next step" —
   one action: respond to a new paper, the overdue or soonest-due review, or "all sent"; the numbers (as on My Conferences); then the
   papers, most urgent first, each with its own deadline. After the conference: the wrap-up. Cards carry the reviewer's own facts only. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const rise = (i: number) => ({ animationDelay: `${Math.min(i, 10) * 60}ms` });
const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "todo", label: "Pending", test: (r: ReviewRow) => !r.paper.review },
  { key: "sent", label: "Reviewed", test: (r: ReviewRow) => !!r.paper.review },
] as const;
const DEFAULT_TRACKS = ["General Track"];
const ACCEPT_WITHIN_DAYS = 3;

const fmtDue = (iso: string) => (iso ? toDate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const daysTo = (iso: string) => (iso ? Math.round((toDate(iso).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null);

/** "Your next step": the one thing to do now. A paper waiting to be accepted comes first (the chair is waiting on that); then the
 *  overdue review, or the one due soonest (say if a draft is saved); once everything's sent, a thank-you. */
function NextStep({ nextRow, awaitingCount, total, sent, onOpen }: { nextRow: ReviewRow | null; awaitingCount: number; total: number; sent: number; onOpen: (p: ReviewerPaper) => void }) {
  type Tone = "primary" | "warning" | "danger" | "success";
  let tone: Tone; let Icon: LucideIcon; let title: string; let sub = ""; let action: { label: string; onClick: () => void } | null = null;
  if (awaitingCount > 0) {
    tone = "primary"; Icon = Inbox;
    title = `${awaitingCount} new paper${awaitingCount === 1 ? " is" : "s are"} waiting for you`;
    sub = "Accept or decline below so the chair can plan.";
  } else if (nextRow) {
    const d = daysTo(nextRow.paper.due);
    const late = nextRow.status.key === "overdue";
    tone = late ? "danger" : d != null && d <= 7 ? "warning" : "primary";
    Icon = late ? AlarmClock : nextRow.paper.draft ? PenLine : Eye;
    title = `${nextRow.paper.id} · ${late ? `was due ${fmtDue(nextRow.paper.due)}` : `due ${fmtDue(nextRow.paper.due)}`}`;
    sub = [late && d != null ? `${-d} day${d === -1 ? "" : "s"} late` : d === 0 ? "due today" : d != null ? `in ${d} day${d === 1 ? "" : "s"}` : "", nextRow.paper.draft ? "draft saved" : "not started"].filter(Boolean).join(" · ");
    action = { label: nextRow.paper.draft ? "Continue review" : late ? "Review now" : "Start review", onClick: () => onOpen(nextRow.paper) };
  } else if (total > 0) {
    tone = "success"; Icon = CheckCircle2;
    title = `All ${sent} review${sent === 1 ? "" : "s"} sent — thank you`;
    sub = "You can still update a review until the chair decides. Results go to the authors after that.";
  } else {
    return null;
  }
  const t = { primary: ["var(--primary)", "var(--primary-soft)", "var(--primary-soft-border)"], warning: ["#B45309", "var(--warning-soft)", "#FCD9A8"], danger: ["var(--danger)", "var(--danger-soft)", "#FECACA"], success: ["#15803D", "var(--success-soft)", "#BBF7D0"] }[tone];
  return (
    <section aria-label="Your next step" style={{ background: t[1], border: `1px solid ${t[2]}`, ...rise(1) }} className="hd-rise flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4">
      <span aria-hidden="true" style={{ color: t[0] }} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white"><Icon size={20} /></span>
      <div className="min-w-0 flex-1">
        <div style={{ color: t[0] }} className="text-[11px] font-bold uppercase tracking-[0.08em]">Your next step</div>
        <div className="mt-0.5 text-[16px] font-extrabold leading-snug text-navy">{title}</div>
        {sub && <div className="mt-0.5 text-[13px] text-ink-soft">{sub}</div>}
      </div>
      {action && <button type="button" onClick={action.onClick} className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-5 text-[14px] font-bold text-white ${tone === "danger" ? "bg-danger" : "bg-primary"}`}>{action.label} <ArrowRight size={15} aria-hidden="true" /></button>}
    </section>
  );
}

/** This conference's numbers for the reviewer — the same as its row on My Conferences, in the author's strip design. */
function NumbersStrip({ n }: { n: ReviewerNumbers }) {
  const items = [
    { label: "Papers Assigned", value: n.assigned, color: "var(--navy)", warn: false },
    { label: "Reviewed", value: n.done, color: "var(--success)", warn: false },
    { label: "Pending", value: n.pending, color: n.overdue ? "var(--danger)" : "var(--warning)", warn: n.pending > 0 },
    { label: "Invitation Rejected", value: n.declined, color: "var(--ink-soft)", warn: false },
  ];
  return (
    <section aria-label="Your numbers for this conference" style={{ ...CARD, ...rise(1) }} className="hd-rise sub-strip sub-strip-2 flex overflow-hidden rounded-2xl bg-white">
      {items.map((it, i) => (
        <div key={it.label} style={{ borderLeft: i ? "1px solid var(--muted)" : "none", background: it.warn ? (n.overdue ? "var(--danger-soft)" : "var(--warning-soft)") : "#FFFFFF" }} className="flex min-w-0 flex-1 basis-0 flex-col items-start justify-center gap-0.5 px-3.5 py-3">
          <b style={{ color: it.value ? it.color : "var(--border-strong)" }} className="text-xl leading-tight"><AnimatedNumber value={it.value} /></b>
          <span className="text-xs font-semibold leading-tight text-ink-muted">{it.label}{it.warn && n.overdue ? " · overdue" : ""}</span>
        </div>
      ))}
    </section>
  );
}

/** A paper the chair assigned that the reviewer has not answered yet: its abstract and the two buttons. */
function PendingCard({ paper, onOpen, onAccept, onDecline }: { paper: ReviewerPaper; onOpen: () => void; onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-xl border-[1.5px] border-primary-soft-border bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-faint">{paper.id}</span>
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-bold text-warning">Waiting for your response</span>
          {paper.track && <span className="text-[11px] text-ink-faint">{paper.track}</span>}
        </div>
        <button type="button" onClick={onOpen} className="text-left text-sm font-semibold leading-snug text-ink hover:underline">{paper.title}</button>
        <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{paper.abstract}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
          {paper.assignedOn && <span>Assigned {paper.assignedOn}</span>}
          {paper.due && <span className="inline-flex items-center gap-1"><Calendar size={11} aria-hidden="true" /> Review due {fmtDay(paper.due, { day: "numeric", month: "short", year: "numeric" })}</span>}
          <span className="inline-flex items-center gap-1"><EyeOff size={11} aria-hidden="true" /> Authors hidden (double-blind)</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onDecline} className="h-9 rounded-lg border border-line bg-white px-3.5 text-xs font-bold text-ink-soft transition-colors hover:bg-canvas">Decline</button>
        <button type="button" onClick={onAccept} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-white hover:brightness-95">Accept</button>
      </div>
    </div>
  );
}

export function ReviewerOverviewPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, retry, reload } = useReviewerWorkspace(slug, { overview: true });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("table");
  const [drawer, setDrawer] = useState(false);
  const [respond, setRespond] = useState<Respond>(null);
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const gate = workspaceGate(state, retry, { title: "Dashboard", loadingLabel: "Loading your dashboard", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a reviewer in it. Pick one from My Conferences.", errorTitle: "Couldn't load your dashboard." });
  if (gate || state.status !== "ready") return gate;

  const { conference, roles, others, assignments, details } = state;
  const finished = conferenceOver(conference);
  const all = reviewRows(assignments.papers, finished);
  const accepted = all.filter((r) => r.paper.response === "accepted");
  const awaiting = all.filter((r) => r.paper.response === "pending");
  // Most urgent first: by status (overdue, draft, to do, sent), then the soonest deadline.
  const rows = [...accepted].sort((a, b) => REVIEW_STATUS_ORDER.indexOf(a.status.key) - REVIEW_STATUS_ORDER.indexOf(b.status.key) || a.paper.due.localeCompare(b.paper.due));
  const sent = rows.filter((r) => r.paper.review).length;
  const scores = rows.map((r) => r.paper.review?.score).filter((n): n is number => typeof n === "number");
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  const nextRow = rows.find((r) => !r.paper.review) ?? null;
  const numbers = reviewerNumbers(assignments.papers, assignments.declined, conference.status === "archived");
  const q = query.trim().toLowerCase();
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const tableMode = view === "table";
  const shown = rows.filter((r) => active.test(r) && (!q || [r.paper.id, r.paper.title, r.paper.track, ...r.paper.keywords].some((v) => (v || "").toLowerCase().includes(q))));

  const open = (p: ReviewerPaper) => {
    const d = reviewDest(conference.id, p.id);
    if (!d) return;
    if (d.external) openPrototypePage(d.href); else router.push(d.href);
  };
  const certDest = reviewerCertificatesDest(conference.id);
  const logDest = reviewerActivityDest(conference.id);
  const place = [details?.city, details?.state, details?.country].filter(Boolean).join(", ");
  // The reviewer's calendar: each paper still to review on its own deadline (with a reminder two days before), and the conference days.
  const addAll = () => downloadIcs(
    [
      ...rows.filter((r) => !r.paper.review).map((r) => ({ title: `Review ${r.paper.id} due (${conference.acronym})`, date: r.paper.due, location: "", description: r.paper.title, remindDays: 2 })),
      ...(conference.startDate ? [{ title: conference.acronym, date: conference.startDate, endDate: conference.endDate, location: place, description: conference.name }] : []),
    ].filter((e) => e.date),
    `${conference.acronym.replace(/\s+/g, "-")}-my-review-dates.ics`,
  );
  const done = (paper: ReviewerPaper, result: "accepted" | "declined") => {
    setToast(result === "accepted" ? { title: "Paper accepted", text: `${paper.id} is now in your review list below.` } : { title: "Paper declined", text: `The chair has been told so they can reassign ${paper.id}.` });
    reload();
  };

  const WRAP = [
    { key: "cert", icon: Award, tone: "var(--ink-faint)", bg: "var(--muted)", title: sent ? `${sent} review${sent === 1 ? "" : "s"} on record` : "No certificate yet", sub: sent ? "Certificates of Appreciation are not issued by this app yet." : "Reviewers get a certificate for each paper they review. You didn't send a review here.", cta: "Open certificates", dest: certDest },
    { key: "reviews", icon: FileCheck, tone: "var(--success)", bg: "var(--success-soft)", title: `You reviewed ${sent} of ${rows.length} paper${rows.length === 1 ? "" : "s"}`, sub: avg != null ? `Your average score was ${avg}/5.` : "Your reviews are listed below.", cta: "", dest: null },
    { key: "log", icon: History, tone: "var(--cat-virtual)", bg: "var(--cat-virtual-soft)", title: "Your activity", sub: "Every review you sent or changed, with dates.", cta: "Open activity log", dest: logDest },
  ];

  return (
    <ConferenceShell role="reviewer" conference={conference} roles={roles} others={others} active="overview">
      <PageHeader title="Reviewer Dashboard" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page flex flex-col gap-5 p-8">
        {/* 1 · The conference card — the same one the author sees */}
        <ConferenceHero conference={conference} details={details} onDetails={() => setDrawer(true)} extraChip={<HeroChip icon={Lock}>Double-blind</HeroChip>}>
          {!finished && <HeroButton icon={CalendarPlus} onClick={addAll} title="Each paper's review deadline and the conference days, as a calendar file">Add to calendar</HeroButton>}
        </ConferenceHero>

        {/* 2 · Your next step — one thing */}
        {!finished && <NextStep nextRow={nextRow} awaitingCount={awaiting.length} total={rows.length} sent={sent} onOpen={open} />}

        {/* 3 · The numbers (same as My Conferences) */}
        {numbers.assigned > 0 && <NumbersStrip n={numbers} />}

        {/* After the conference: the wrap-up */}
        {finished && (
          <section aria-label="Wrap-up" className="hd-rise flex flex-col gap-3">
            <div className="flex items-center gap-2"><h2 className="text-[15px] font-extrabold text-navy">{conference.acronym} has finished</h2><span className="text-[13px] font-semibold text-ink-muted">· thank you for reviewing</span></div>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              {WRAP.map((it, i) => {
                const Icon = it.icon;
                return (
                  <div key={it.key} style={{ ...CARD, ...rise(i + 1) }} className="hd-rise hd-lift flex flex-col gap-3 rounded-2xl bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true" style={{ background: it.bg, color: it.tone }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Icon size={18} /></span>
                      <div className="min-w-0"><div className="text-[14px] font-extrabold leading-tight text-navy">{it.title}</div><div className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{it.sub}</div></div>
                    </div>
                    {it.cta && it.dest && <a href={it.dest.href} className="mt-auto inline-flex items-center gap-1 self-start rounded-lg border border-line bg-white px-3.5 py-2 text-[13px] font-bold text-navy hover:brightness-95">{it.cta}</a>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!tableMode && awaiting.length > 0 && (
          <section aria-label="Waiting for your response" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[17px] font-extrabold text-navy">Waiting for your response <span className="font-semibold text-ink-faint">({awaiting.length})</span></h2>
              <span className="text-xs text-ink-muted">Accept or decline within {ACCEPT_WITHIN_DAYS} days so the chair can plan.</span>
            </div>
            {awaiting.map((r) => <PendingCard key={r.paper.assignmentId} paper={r.paper} onOpen={() => open(r.paper)} onAccept={() => setRespond({ paper: r.paper, kind: "accept" })} onDecline={() => setRespond({ paper: r.paper, kind: "decline" })} />)}
          </section>
        )}

        {/* 4 · Papers, most urgent first */}
        <section aria-label="Papers to review" style={rise(3)} className="hd-rise flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-extrabold text-navy">Papers to review <span className="font-semibold text-ink-faint">({tableMode ? rows.length + awaiting.length : rows.length})</span></h2>
              {rows.length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-2.5 pr-3">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span style={{ width: `${(sent / rows.length) * 100}%`, background: sent === rows.length ? "var(--success)" : "var(--gradient-accent)" }} className="hd-fill block h-full rounded-full" /></span>
                  <span className="text-[12px] font-bold text-ink-soft">{sent} of {rows.length} reviewed</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-muted"><Lock size={12} aria-hidden="true" /> Double-blind · author names are hidden</span>
            </div>
            {rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {/* The table has its own search and filters under its column titles, so these are for the cards. */}
                {view === "cards" && (
                  <>
                    <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1.5">
                      {FILTERS.map((f) => {
                        const n = rows.filter(f.test).length;
                        const on = filter === f.key;
                        return <button key={f.key} type="button" role="radio" aria-checked={on} onClick={() => setFilter(f.key)} className={`rounded-full border px-3 py-1 text-[12.5px] font-bold transition-colors ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink-soft"}`}>{f.label} <span className="opacity-65">{n}</span></button>;
                      })}
                    </div>
                    <label className="flex h-9 w-60 items-center gap-2 rounded-lg border border-line bg-white px-3">
                      <Search size={14} aria-hidden="true" className="text-ink-faint" />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, title or keyword…" aria-label="Search papers to review" className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate-400" />
                    </label>
                  </>
                )}
                <div role="group" aria-label="View" className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-0.5">
                  {([{ key: "cards", label: "Cards", icon: LayoutGrid }, { key: "table", label: "Table", icon: Rows3 }] as const).map((v) => {
                    const on = view === v.key;
                    const Icon = v.icon;
                    return <button key={v.key} type="button" aria-pressed={on} onClick={() => { setView(v.key); setFilter("all"); setQuery(""); }} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold transition-colors ${on ? "bg-navy text-white" : "text-ink-soft"}`}><Icon size={14} aria-hidden="true" /> {v.label}</button>;
                  })}
                </div>
              </div>
            )}
          </div>

          {rows.length === 0 && !(tableMode && awaiting.length) ? (
            <div className="rounded-xl border-[1.5px] border-dashed border-primary bg-primary-soft p-8 text-center">
              <Eye size={24} aria-hidden="true" className="mx-auto mb-2 text-primary" />
              <p className="mb-1 text-sm font-semibold text-navy">{awaiting.length > 0 ? "Accept a paper above to start reviewing" : "No papers assigned to you yet"}</p>
              <p className="text-xs text-ink-muted">{awaiting.length > 0 ? "Papers you accept appear here with their due dates." : "The chair will assign papers to you. They'll appear here."}</p>
            </div>
          ) : tableMode ? (
            <ReviewsTable rows={[...awaiting, ...shown]} onOpen={open} onAccept={(p) => setRespond({ paper: p, kind: "accept" })} onDecline={(p) => setRespond({ paper: p, kind: "decline" })} />
          ) : shown.map((row, i) => <ReviewCard key={row.paper.assignmentId} row={row} index={i} onOpen={open} />)}
          {rows.length > 0 && shown.length === 0 && (
            <div style={CARD} className="rounded-2xl bg-white py-10 text-center">
              <p className="mb-1 text-sm font-semibold text-navy">No papers match.</p>
              <button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="text-sm font-bold text-primary hover:underline">Show all papers</button>
            </div>
          )}
        </section>
      </div>
      <AssignmentDialogs respond={respond} onClose={() => setRespond(null)} onDone={done} onSessionEnded={retry} />
      <FlowToast toast={toast} onClose={closeToast} />
      <DetailsDrawer open={drawer} conference={conference} details={details} tracks={DEFAULT_TRACKS} onClose={() => setDrawer(false)} />
    </ConferenceShell>
  );
}
