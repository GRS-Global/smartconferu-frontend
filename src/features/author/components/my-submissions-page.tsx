"use client";

import { ArrowUpDown, LayoutGrid, Rows3, Search, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { AuthorShell } from "@/features/workspace/components/author-shell";
import { newSubmissionHref } from "../links";
import { STATUS_FILTERS, submissionRows, type FilterKey } from "../status";
import { useAuthorSubmissions } from "../use-author-submissions";
import { BackLinks } from "@/features/workspace/components/workspace-gate";
import { CARD_SORTS, EmptySubmissions, FilterStrip, NewSubmissionButton, SubmissionCard, SubmissionsTable, cardStyle, sortCards, type CardSortKey } from "./submission-parts";

/** My Submissions: an author's papers in one conference, as cards or a table (the prototype's MySubmissionsPage). The page
 *  is the Author workspace's frame plus the list: the filter strip, search, the card sort and the Cards / Table switch. */
export function MySubmissionsPage({ slug }: { slug: string }) {
  const { state, retry } = useAuthorSubmissions(slug);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [cardSort, setCardSort] = useState<CardSortKey>("default");

  if (state.status === "loading") {
    return (
      <>
        <PageHeader title="My Submissions" />
        <div role="status" aria-label="Loading your submissions" className="space-y-3 p-4 sm:p-8">
          <div className="h-9 w-72 max-w-full animate-pulse rounded-xl bg-muted" />
          <div className="h-60 animate-pulse rounded-2xl border border-line bg-white" />
        </div>
      </>
    );
  }
  if (state.status === "auth") {
    return (
      <>
        <PageHeader title="My Submissions" />
        <div role="status" aria-label="Loading your submissions" className="p-4 sm:p-8"><div className="h-60 animate-pulse rounded-2xl border border-line bg-white" /></div>
        <SessionEnded onRecovered={retry} />
      </>
    );
  }
  if (state.status === "error" || state.status === "missing") {
    const missing = state.status === "missing";
    return (
      <>
        <PageHeader title="My Submissions" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: "My Submissions" }]} />
        <div className="p-4 sm:p-8">
          <div className="max-w-4xl rounded-2xl border border-line bg-white">
            <EmptyState
              icon={TriangleAlert}
              title={missing ? "We couldn't find that conference." : state.config ? "The database connection isn't set up." : "Couldn't load your submissions."}
              description={missing ? "It doesn't exist, or you have no submissions in it. Pick one from My Conferences." : state.message}
              action={<BackLinks retry={missing || state.config ? undefined : retry} />}
            />
          </div>
        </div>
      </>
    );
  }

  const { conference, roles, others, submissions } = state;
  const closed = conference.status === "archived"; // no new papers
  const rows = submissionRows(conference, submissions);
  const q = query.trim().toLowerCase();
  const active = STATUS_FILTERS.find((f) => f.key === filter)!;
  const matching = rows.filter((r) => active.test(r, closed) && (!q || [r.sub.id, r.sub.title, r.sub.presentationType, ...r.sub.authors.map((a) => a.name)].some((v) => (v || "").toLowerCase().includes(q))));
  const shown = view === "cards" ? sortCards(matching, cardSort) : matching;
  const newHref = newSubmissionHref(conference.id);

  return (
    <AuthorShell conference={conference} roles={roles} others={others} active="submissions">
      <PageHeader
        title="My Submissions"
        breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]}
        actions={!closed && newHref ? <NewSubmissionButton href={newHref} /> : undefined}
      />
      <div className="hd-page flex flex-col gap-4 p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-extrabold text-navy">Your submissions <span className="font-semibold text-ink-faint">({rows.length})</span></h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 w-60 items-center gap-2 rounded-lg border border-line bg-white px-3">
              <Search size={14} aria-hidden="true" className="text-ink-faint" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, title or author…" aria-label="Search your submissions" className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate-400" />
            </label>
            {view === "cards" && (
              <label className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white pl-3 pr-1">
                <ArrowUpDown size={13} aria-hidden="true" className="text-ink-faint" />
                <span className="text-[12px] font-semibold text-ink-faint">Sort</span>
                <select value={cardSort} onChange={(e) => setCardSort(e.target.value as CardSortKey)} aria-label="Sort submissions" className="h-8 cursor-pointer bg-transparent pr-1 text-[12.5px] font-bold text-navy outline-none">
                  {CARD_SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </label>
            )}
            <div role="group" aria-label="View" className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-0.5">
              {([{ key: "cards", label: "Cards", icon: LayoutGrid }, { key: "table", label: "Table", icon: Rows3 }] as const).map((v) => {
                const on = view === v.key;
                const Icon = v.icon;
                return (
                  <button key={v.key} type="button" aria-pressed={on} onClick={() => setView(v.key)} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold transition-colors ${on ? "bg-navy text-white" : "text-ink-soft"}`}>
                    <Icon size={14} aria-hidden="true" /> {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {rows.length > 0 && <FilterStrip rows={rows} closed={closed} filter={filter} onChange={setFilter} />}

        {rows.length === 0 ? (
          <EmptySubmissions acronym={conference.acronym} finished={closed} newHref={newHref} />
        ) : shown.length === 0 ? (
          <div style={cardStyle} className="rounded-2xl bg-white py-10 text-center">
            <p className="mb-1 text-sm font-semibold text-navy">No submissions match.</p>
            <button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="text-sm font-bold text-primary hover:underline">Show all submissions</button>
          </div>
        ) : view === "table" ? (
          <SubmissionsTable rows={shown} />
        ) : (
          shown.map((row, i) => <SubmissionCard key={row.sub.dbId} row={row} index={i} />)
        )}
      </div>
    </AuthorShell>
  );
}
