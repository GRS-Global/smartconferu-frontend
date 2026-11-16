"use client";

import { Check, ChevronRight, Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { ConferenceHero } from "@/features/workspace/components/hero";
import { AuthorShell } from "@/features/workspace/components/author-shell";
import { daysToISO, downloadIcs, shiftIsoDate, toDate, type IcsEvent } from "../format";
import { conferenceDest, newSubmissionHref } from "../links";
import { conferenceNumbers, conferenceOver, submissionRows, type SubmissionRow } from "../status";
import { authorTodos } from "../todos";
import { useAuthorSubmissions } from "../use-author-submissions";
import { useConferenceCertificates } from "@/features/certificates/use-conference-certificates";
import { DetailsDrawer } from "./details-drawer";
import { KeyDatesCompact, type Milestone } from "./key-dates";
import { NumbersStrip, TodoPanel, WrapUp } from "./overview-parts";
import { EmptySubmissions, NewSubmissionButton, SubmissionCard } from "./submission-parts";

/* Author · conference Overview, "Dashboard" in the menu (the prototype's AuthorHomeD, Option D — the main author page):
     1. the conference card (details drawer one click away)
     2. this conference's numbers, in the same words as My Conferences' "As Author" strip
     3. your to-do list (60%) beside the key dates (40%) — or, once it's over, a wrap-up
     4. your first 4 papers that need you, "View all" opens My Submissions
   Statuses are the agreed author labels; authors never see where a paper is inside review. */

const OVERVIEW_CARDS = 4;
const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const rise = (i: number) => ({ animationDelay: `${Math.min(i, 10) * 60}ms` });
// The tracks the prototype lists for a conference whose chair has not set any.
const DEFAULT_TRACKS = ["General Track"];

/* The dashboard shows the papers that still need the author, most urgent first; finished ones (registered, not accepted,
   withdrawn, never registered) live in My Submissions only. Under-review papers stay — nothing to do yet, but they're in progress. */
const ATTENTION_ORDER: Partial<Record<SubmissionRow["status"]["key"], number>> = { revise: 0, draft: 1, pending: 2, waitlisted: 3, waiting: 4 };
// Within "Revision Required", the one due soonest (screening correction / revision deadline) first.
const dueTime = (row: SubmissionRow) => { const t = new Date(row.sub.screeningRequest?.deadline || "").getTime(); return Number.isNaN(t) ? Infinity : t; };

export function AuthorOverviewPage({ slug }: { slug: string }) {
  const { state, retry } = useAuthorSubmissions(slug, { overview: true });
  const certificates = useConferenceCertificates(slug);
  const [drawer, setDrawer] = useState(false);

  const title = <PageHeader title="Dashboard" />;
  if (state.status === "loading") {
    return (
      <>
        {title}
        <div role="status" aria-label="Loading your dashboard" className="space-y-4 p-4 sm:p-8">
          <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
          <div className="h-60 animate-pulse rounded-2xl border border-line bg-white" />
        </div>
      </>
    );
  }
  if (state.status === "auth") {
    return (
      <>
        {title}
        <div role="status" aria-label="Loading your dashboard" className="p-4 sm:p-8"><div className="h-60 animate-pulse rounded-2xl border border-line bg-white" /></div>
        <SessionEnded onRecovered={retry} />
      </>
    );
  }
  if (state.status === "error" || state.status === "missing") {
    const missing = state.status === "missing";
    return (
      <>
        <PageHeader title="Dashboard" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: "Dashboard" }]} />
        <div className="p-4 sm:p-8">
          <div className="max-w-4xl rounded-2xl border border-line bg-white">
            <EmptyState
              icon={TriangleAlert}
              title={missing ? "We couldn't find that conference." : state.config ? "The database connection isn't set up." : "Couldn't load your dashboard."}
              description={missing ? "It doesn't exist, or you have no papers in it. Pick one from My Conferences." : state.message}
              action={missing || state.config ? undefined : <Button size="sm" onClick={retry}>Try again</Button>}
            />
          </div>
        </div>
      </>
    );
  }

  const { conference, roles, others, submissions, details, hasPhoto } = state;
  // closed: takes no new papers (archived, by date or by the chair). finished: the dates have passed.
  const closed = conference.status === "archived";
  const finished = conferenceOver(conference);
  const rows = submissionRows(conference, submissions);
  const attention = rows
    .filter((r) => r.status.key in ATTENTION_ORDER && !(finished && r.status.key === "draft"))
    .sort((a, b) => (ATTENTION_ORDER[a.status.key] ?? 9) - (ATTENTION_ORDER[b.status.key] ?? 9) || dueTime(a) - dueTime(b));
  const doneCount = rows.length - attention.length;

  /* Key dates. The organisers' call for papers is not in the database, so, as in the prototype for a conference without
     one, the dates are worked out from the conference's start date. */
  const subDeadline = shiftIsoDate(conference.startDate, -75);
  const milestones: Milestone[] = [
    { key: "abstract", label: "Abstract due", iso: shiftIsoDate(subDeadline, -30) },
    { key: "submission", label: "Full paper due", iso: subDeadline },
    { key: "notification", label: "Results announced", iso: shiftIsoDate(subDeadline, 42) },
    { key: "cameraReady", label: "Register & final version", iso: shiftIsoDate(conference.startDate, -14) },
    { key: "event", label: "Conference days", iso: conference.startDate, end: conference.endDate },
  ]
    .filter((m) => m.iso)
    .map((m) => ({ ...m, days: daysToISO(m.end || m.iso) }))
    .sort((a, b) => toDate(a.iso).getTime() - toDate(b.iso).getTime());
  const nextMilestone = milestones.find((m) => m.days != null && m.days >= 0) ?? milestones[milestones.length - 1] ?? null;
  const upcoming = nextMilestone && (nextMilestone.days ?? -1) >= 0 ? nextMilestone : null;

  // Feedback (the prototype's feedbackState): "soon" before the first conference day, otherwise open — archived conferences count as open so past ones can still be rated. Nothing is stored yet, so it is never "sent".
  const opens = toDate(conference.startDate);
  const feedbackSoon = new Date() < opens && conference.status !== "archived";
  const feedbackOpen = !feedbackSoon && (finished || new Date() >= opens);
  const todos = authorTodos({ conference, papers: submissions, hasPhoto, feedbackOpen });
  const registered = submissions.filter((p) => p.result === "registered").length;
  const newHref = newSubmissionHref(conference.id);
  const allDest = conferenceDest.submissions(conference.id);

  const place = [details?.city, details?.state, details?.country].filter(Boolean).join(", ");
  const toIcs = (m: Milestone): IcsEvent => ({ title: `${conference.acronym}: ${m.label}`, date: m.iso, endDate: m.end, location: place, description: conference.name });
  const fileBase = conference.acronym.replace(/\s+/g, "-");

  return (
    <AuthorShell conference={conference} roles={roles} others={others} active="overview">
      <PageHeader title="Author Dashboard" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page flex flex-col gap-5 p-8">
        {/* 1 · Conference card */}
        <ConferenceHero conference={conference} details={details} onDetails={() => setDrawer(true)}>
          {!closed && newHref && <NewSubmissionButton href={newHref} />}
        </ConferenceHero>

        {/* 2 · This conference's numbers */}
        {submissions.length > 0 && <NumbersStrip n={conferenceNumbers(submissions, closed)} />}

        {/* 3 · To-do (60%) + key dates (40%), or the wrap-up once it's over */}
        {closed && !finished ? (
          <section style={{ ...CARD, ...rise(2) }} className="hd-rise flex items-center gap-4 rounded-2xl bg-white p-5">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-ink-soft"><Lock size={18} /></span>
            <div>
              <div className="text-[15px] font-extrabold text-navy">{conference.acronym} has been archived by the chairs</div>
              <p className="mt-0.5 text-[13px] text-ink-muted">New submissions are closed. Your papers stay here, and the chairs can reopen the conference.</p>
            </div>
          </section>
        ) : finished ? (
          <WrapUp
            acronym={conference.acronym}
            flyerCount={registered}
            presented={registered}
            certificates={certificates}
            feedbackDest={conferenceDest.feedback(conference.id)}
            certificatesDest={conferenceDest.certificates(conference.id)}
            flyerDest={conferenceDest.flyer(conference.id)}
          />
        ) : (
          <div style={rise(2)} className="hd-rise grid grid-cols-1 items-stretch gap-5 lg:grid-cols-5">
            <div className="relative lg:col-span-3"><TodoPanel todos={todos} /></div>
            <div className="lg:col-span-2">
              <KeyDatesCompact
                milestones={milestones}
                next={upcoming}
                onAddAll={() => downloadIcs(milestones.map(toIcs), `${fileBase}-key-dates.ics`)}
                onAddOne={(m) => downloadIcs(toIcs(m), `${fileBase}-${m.key}.ics`)}
              />
            </div>
          </div>
        )}

        {/* 4 · The first few papers that need you; the rest live in My Submissions */}
        <section aria-label="Your submissions" style={rise(3)} className="hd-rise flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-extrabold text-navy">Your submissions <span className="font-semibold text-ink-faint">({attention.length})</span></h2>
              {rows.length > 0 && (
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  Papers that need you come first{doneCount > 0 ? ` · ${doneCount} finished paper${doneCount === 1 ? "" : "s"} (registered or not accepted) ${doneCount === 1 ? "is" : "are"} in My Submissions` : ""}.
                </p>
              )}
            </div>
            {rows.length > 0 && allDest && (
              <Link href={allDest.href} className="inline-flex items-center gap-0.5 text-[13px] font-bold text-primary hover:underline">
                {rows.length > OVERVIEW_CARDS ? `View all ${rows.length}` : "View all"} <ChevronRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
          {rows.length === 0 ? (
            <EmptySubmissions acronym={conference.acronym} finished={closed} newHref={newHref} />
          ) : attention.length === 0 ? (
            <div style={CARD} className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-8 text-center">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft"><Check size={18} className="text-success" /></span>
              <p className="text-sm font-bold text-navy">Nothing needs you here</p>
              <p className="text-[13px] text-ink-muted">All {rows.length} of your papers are finished. You&apos;ll find them in My Submissions.</p>
            </div>
          ) : (
            attention.slice(0, OVERVIEW_CARDS).map((row, i) => <SubmissionCard key={row.sub.dbId} row={row} index={i} />)
          )}
        </section>
      </div>
      <DetailsDrawer open={drawer} conference={conference} details={details} tracks={DEFAULT_TRACKS} onClose={() => setDrawer(false)} />
    </AuthorShell>
  );
}

