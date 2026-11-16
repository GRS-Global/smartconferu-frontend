"use client";

import { Eye, LayoutGrid, Lock, Rows3, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { openPrototypePage } from "@/lib/navigation";
import type { ReviewerPaper } from "@/types/reviewer";
import { reviewDest } from "../links";
import { conferenceOver } from "@/features/author/status";
import { REVIEW_STATUS_ORDER, reviewRows, reviewerNumbers } from "../status";
import { useReviewerWorkspace } from "../use-reviewer-workspace";
import { AssignmentDialogs, type Respond } from "./assignment-dialogs";
import { FILTERS, ReviewCard, ReviewerFilterStrip, ReviewsTable, type FilterKey } from "./review-parts";

/** My Reviews: every paper assigned to this reviewer in one conference, as cards or a table (the prototype's MyReviewsPage). */
export function MyReviewsPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, retry, reload } = useReviewerWorkspace(slug);
  const [view, setView] = useState<"cards" | "table">("table");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [respond, setRespond] = useState<Respond>(null);
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const gate = workspaceGate(state, retry, { title: "My Reviews", loadingLabel: "Loading your reviews", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a reviewer in it. Pick one from My Conferences.", errorTitle: "Couldn't load your reviews." });
  if (gate || state.status !== "ready") return gate;

  const { conference, roles, others, assignments } = state;
  const finished = conferenceOver(conference);
  const rows = reviewRows(assignments.papers, finished);
  const accepted = rows.filter((r) => r.paper.response === "accepted");
  const sent = accepted.filter((r) => r.paper.review).length;
  const q = query.trim().toLowerCase();
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  // Cards lead with what needs the reviewer; the table has its own sort.
  const shown = rows
    .filter((r) => active.test(r) && (!q || [r.paper.id, r.paper.title, r.paper.track, r.paper.presentationType, ...r.paper.keywords].some((v) => (v || "").toLowerCase().includes(q))))
    .sort((a, b) => REVIEW_STATUS_ORDER.indexOf(a.status.key) - REVIEW_STATUS_ORDER.indexOf(b.status.key));
  const next = rows.filter((r) => ["overdue", "draft", "todo"].includes(r.status.key)).sort((a, b) => REVIEW_STATUS_ORDER.indexOf(a.status.key) - REVIEW_STATUS_ORDER.indexOf(b.status.key))[0];
  const numbers = reviewerNumbers(assignments.papers, assignments.declined, conference.status === "archived");

  const open = (p: ReviewerPaper) => {
    const d = reviewDest(conference.id, p.id);
    if (!d) return;
    if (d.external) openPrototypePage(d.href); else router.push(d.href);
  };
  const done = (paper: ReviewerPaper, result: "accepted" | "declined") => {
    setToast(result === "accepted" ? { title: "Paper accepted", text: `${paper.id} is now in your review list below.` } : { title: "Paper declined", text: `The chair has been told so they can reassign ${paper.id}.` });
    reload();
  };

  return (
    <ConferenceShell role="reviewer" conference={conference} roles={roles} others={others} active="reviews">
      <PageHeader
        title="My Reviews"
        breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]}
        actions={!finished && next ? <button type="button" onClick={() => open(next.paper)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-bold text-white transition-shadow hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]"><Eye size={15} aria-hidden="true" /> {sent ? "Next review" : "Start reviewing"}</button> : undefined}
      />
      <div className="hd-page flex flex-col gap-4 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[17px] font-extrabold text-navy">Papers assigned to you <span className="font-semibold text-ink-faint">({rows.length})</span></h2>
            {accepted.length > 0 && (
              <span title="Reviewed, out of the papers you've accepted" className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-2.5 pr-3">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span style={{ width: `${(sent / accepted.length) * 100}%`, background: sent === accepted.length ? "var(--success)" : "var(--gradient-accent)" }} className="hd-fill block h-full rounded-full" /></span>
                <span className="text-[12px] font-bold text-ink-soft">{sent} of {accepted.length} reviewed</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-muted"><Lock size={12} aria-hidden="true" /> Double-blind</span>
          </div>
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* The table searches under its own column titles. */}
              {view === "cards" && (
                <label className="flex h-9 w-60 items-center gap-2 rounded-lg border border-line bg-white px-3">
                  <Search size={14} aria-hidden="true" className="text-ink-faint" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, title or keyword…" aria-label="Search your reviews" className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate-400" />
                </label>
              )}
              <div role="group" aria-label="View" className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-0.5">
                {([{ key: "cards", label: "Cards", icon: LayoutGrid }, { key: "table", label: "Table", icon: Rows3 }] as const).map((v) => {
                  const on = view === v.key;
                  const Icon = v.icon;
                  return <button key={v.key} type="button" aria-pressed={on} onClick={() => { setView(v.key); setQuery(""); }} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold transition-colors ${on ? "bg-navy text-white" : "text-ink-soft"}`}><Icon size={14} aria-hidden="true" /> {v.label}</button>;
                })}
              </div>
            </div>
          )}
        </div>

        {rows.length > 0 && <ReviewerFilterStrip rows={rows} filter={filter} onChange={setFilter} assigned={numbers.assigned} declined={numbers.declined} />}

        {rows.length === 0 ? (
          <div className="rounded-xl border-[1.5px] border-dashed border-primary bg-primary-soft p-8 text-center">
            <Eye size={24} aria-hidden="true" className="mx-auto mb-2 text-primary" />
            <p className="mb-1 text-sm font-semibold text-navy">No papers assigned to you yet</p>
            <p className="text-xs text-ink-muted">The chair will assign papers to you. They&apos;ll appear here.</p>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="rounded-2xl bg-white py-10 text-center">
            <p className="mb-1 text-sm font-semibold text-navy">No papers match.</p>
            <button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="text-sm font-bold text-primary hover:underline">Show all papers</button>
          </div>
        ) : view === "table" ? (
          <ReviewsTable rows={shown} onOpen={open} onAccept={(p) => setRespond({ paper: p, kind: "accept" })} onDecline={(p) => setRespond({ paper: p, kind: "decline" })} />
        ) : (
          shown.map((row, i) => <ReviewCard key={row.paper.assignmentId} row={row} index={i} onOpen={open} />)
        )}
      </div>
      <AssignmentDialogs respond={respond} onClose={() => setRespond(null)} onDone={done} onSessionEnded={retry} />
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
