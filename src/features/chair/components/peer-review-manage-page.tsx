"use client";

import { Check, Download, Layers, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { useIdSort } from "@/lib/use-id-sort";
import { useRangeSelect } from "@/lib/use-range-select";
import { prRowOf, type ReviewerState } from "../peer-review";
import { useChairConference } from "../use-chair-conference";
import { IdSortLabel } from "./screening-ui";
import { ReviewFormPreview } from "./review-form-preview";
import { ReviewFormBuilder } from "./review-form-builder";
import { ReviewSettingsPanel } from "./review-settings-page";
import { getChairService } from "@/services/chair";

/* Peer Review › Manage (the prototype's PeerReviewPage): the Form tab and the Reviews tab. Reviews lists every reviewer of every paper
   as a row — the review status, when it was last sent and one column per scored / chosen field of the review form — with search, a
   status and a reviewer filter, the column chooser, row selection and "Export CSV". The Form tab shows the form every reviewer fills in
   (read-only): changing the form and the review settings are Conference Settings pages, and the database keeps neither, so the
   prototype’s editor stays there until those pages are ported. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
/** The prototype's review-status wording and colours for this table (PR_REVIEW_STATUS). */
const REVIEW_STATUS: Record<ReviewerState, { label: string; color: string; bg: string }> = {
  done: { label: "Submitted", color: "var(--success)", bg: "var(--success-soft)" },
  active: { label: "Reviewing", color: "var(--primary)", bg: "var(--primary-soft)" },
  overdue: { label: "Overdue", color: "var(--danger)", bg: "var(--danger-soft)" },
  waiting: { label: "Not accepted yet", color: "#B45309", bg: "var(--warning-soft)" },
  invite: { label: "Invitation pending", color: "#B45309", bg: "var(--warning-soft)" },
};
const csvCell = (c: unknown) => `"${String(c).replace(/"/g, '""')}"`;

export function PeerReviewManagePage({ slug }: { slug: string }) {
  const { state, retry, reload } = useChairConference(slug, { board: true, setup: true, settings: true });
  const router = useRouter();
  const asked = useSearchParams().get("tab");
  const tab = asked === "reviews" ? "reviews" : "form";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reviewer, setReviewer] = useState("all");
  const [hidden, setHidden] = useState<string[]>([]);
  const [colsOpen, setColsOpen] = useState(false);
  // Form tab: its two sub-tabs (Form / Settings) and whether the form is being edited in place.
  const [sub, setSub] = useState<"form" | "settings">("form");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const idSort = useIdSort();
  const range = useRangeSelect();

  const gate = workspaceGate(state, retry, { title: "Peer Review", loadingLabel: "Loading peer review", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load peer review." });
  if (gate || state.status !== "ready" || !state.board || !state.setup) return gate;
  const { conference, roles, others, data, board, setup } = state;
  const COLUMN_FIELDS = setup.form.flatMap((s) => s.fields).filter((f) => f.type !== "long_text");
  const e = encodeURIComponent(conference.id);
  const visible = COLUMN_FIELDS.filter((f) => !hidden.includes(f.id));

  const rows = data.papers.filter((p) => !p.withdrawn).flatMap((p) => prRowOf(p, board, data.screening).reviewers.map((x) => ({ key: `${p.id}-${x.r.assignmentId}`, paper: p, reviewer: x.r.name, state: x.state as ReviewerState, review: x.r.review })));
  const names = [...new Set(rows.map((r) => r.reviewer))];
  const q = search.trim().toLowerCase();
  const filtered = idSort.sort(rows.filter((r) => (status === "all" || r.state === status) && (reviewer === "all" || r.reviewer === reviewer) && (!q || r.paper.title.toLowerCase().includes(q) || r.paper.id.toLowerCase().includes(q) || r.reviewer.toLowerCase().includes(q)))
  , (r) => r.paper.id);
  const pick = range({ ids: filtered.map((r) => r.key), isSelected: (k) => selected.includes(k), setMany: (ids, on) => setSelected((l) => (on ? [...new Set([...l, ...ids])] : l.filter((x) => !ids.includes(x)))) });
  const cell = (r: (typeof rows)[number], id: string): string | number | null => {
    const v = r.review;
    if (!v) return null;
    const a = v.answers[id];
    if (Array.isArray(a)) return a.join(", ");
    if (a !== undefined && a !== null && a !== "") return a as string | number;
    if (id === "f-score" && typeof v.score === "number") return v.score;
    if (id === "f-confidence" && v.confidence) return v.confidence;
    return null;
  };
  const allSel = filtered.length > 0 && filtered.every((r) => selected.includes(r.key));
  const exportCsv = () => {
    const pick = selected.length ? filtered.filter((r) => selected.includes(r.key)) : filtered;
    const header = ["Title", "Submission number", "Reviewer", "Review status", "Last modified", ...visible.map((f) => f.label)];
    const body = pick.map((r) => [r.paper.title, r.paper.id, r.reviewer, REVIEW_STATUS[r.state].label, r.review?.submittedAt || "—", ...visible.map((f) => { const v = cell(r, f.id); return v == null ? "" : `${v}${f.type === "score" ? `/${f.max ?? 5}` : ""}`; })]);
    const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${conference.acronym || "peer-review"}-reviews.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const tabs: Array<[string, string]> = [["form", "Form"], ["reviews", "Reviews"]];

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="peer-review/manage" screening={data.screening}>
      <PageHeader title={tab === "form" ? "Peer Review" : "Peer Review / Reviews"} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page p-8 [&.hd-page]:!p-8">
        <div role="tablist" aria-label="Peer review" className="mb-6 flex items-center gap-2">
          {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => router.replace(`/chair/${e}/peer-review/manage${k === "reviews" ? "?tab=reviews" : ""}`)} className={`rounded-full border border-line px-4 py-2 text-xs font-bold transition-colors ${tab === k ? "bg-navy text-white" : "bg-white text-ink-muted"}`}>{l}</button>)}
        </div>

        {tab === "form" && (
          <>
            <div role="tablist" aria-label="Form or settings" className="mb-5 flex border-b border-line">
              {([["form", "Form"], ["settings", "Settings"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={sub === k} onClick={() => setSub(k)} className={`-mb-px cursor-pointer border-b-[2.5px] px-3 py-2.5 text-sm font-semibold transition-colors hover:text-navy ${sub === k ? "border-transparent border-b-primary text-navy" : "border-transparent text-ink-muted"}`}>{l}</button>)}
            </div>
            {sub === "settings" && state.settings && <ReviewSettingsPanel slug={slug} conferenceId={conference.id} conferenceName={conference.name} acronym={conference.acronym} settings={state.settings} setup={setup} reload={reload} withForm={false} links={[{ label: "Reviewers & PC", desc: "Invite reviewers, see current load", href: `/chair/${e}/peer-review/reviewers` }, { label: "Conference Settings › Review", desc: "The same settings, from Conference Settings", href: `/chair/${e}/settings/review` }]} />}
            {sub === "form" && editing && <ReviewFormBuilder initial={setup.form} acronym={conference.acronym} instructions={setup.instructions} hiddenFields={state.settings?.review.hiddenFields ?? []} custom={setup.custom} onSave={(sections) => getChairService().then((x) => x.saveReviewForm(slug, sections))} onReset={() => getChairService().then((x) => x.saveReviewForm(slug, null))} onDone={() => { setEditing(false); reload(); }} />}
            {sub === "form" && !editing && <ReviewFormPreview acronym={conference.acronym} instructions={setup.instructions} form={setup.form} hiddenFields={state.settings?.review.hiddenFields ?? []} onEdit={state.settings ? () => setEditing(true) : undefined} editHref={`/chair/${e}/settings/review`} tryHref={data.papers[0] ? `/submissions/${encodeURIComponent(data.papers[0].id)}/chair` : undefined} tryLabel={data.papers[0]?.id} />}
          </>
        )}

        {tab === "reviews" && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2"><Search size={14} aria-hidden="true" className="text-ink-faint" /><input value={search} onChange={(ev) => { setSearch(ev.target.value); setSelected([]); }} placeholder="Search title or reviewer…" aria-label="Search title or reviewer" className="w-56 bg-transparent text-sm outline-none" /></label>
                <select value={status} onChange={(ev) => { setStatus(ev.target.value); setSelected([]); }} aria-label="Review status" className="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted outline-none"><option value="all">All statuses</option>{(Object.keys(REVIEW_STATUS) as ReviewerState[]).map((k) => <option key={k} value={k}>{REVIEW_STATUS[k].label}</option>)}</select>
                <select value={reviewer} onChange={(ev) => { setReviewer(ev.target.value); setSelected([]); }} aria-label="Reviewer" className="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted outline-none"><option value="all">All reviewers</option>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setColsOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-ink-muted hover:bg-canvas"><Layers size={13} aria-hidden="true" /> Columns</button>
                <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-ink-muted hover:bg-canvas disabled:opacity-50"><Download size={13} aria-hidden="true" /> Export{selected.length ? ` (${selected.length})` : " CSV"}</button>
              </div>
            </div>
            <div style={CARD} className="overflow-x-auto rounded-2xl bg-white">
              <table className="w-full border-separate border-spacing-0 text-sm [&_tbody_td]:border-b [&_tbody_td]:border-muted">
                <thead>
                  <tr className="bg-canvas text-xs font-semibold text-ink-muted">
                    <th className="sticky left-0 z-[2] w-11 min-w-[44px] bg-canvas py-3 pl-4"><input type="checkbox" checked={allSel} aria-label="Select all" onChange={() => setSelected(allSel ? selected.filter((k) => !filtered.some((r) => r.key === k)) : [...new Set([...selected, ...filtered.map((r) => r.key)])])} /></th>
                    <th className="sticky left-11 z-[2] min-w-[260px] max-w-[260px] bg-canvas px-4 py-3 text-left shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]">Title</th>
                    <th className="whitespace-nowrap px-5 py-3 text-left"><IdSortLabel label="Submission number" dir={idSort.dir} onToggle={idSort.toggle} /></th>
                    <th className="whitespace-nowrap px-5 py-3 text-left">Reviewer</th>
                    <th className="whitespace-nowrap px-5 py-3 text-left">Review status</th>
                    <th className="whitespace-nowrap px-5 py-3 text-left">Last modified</th>
                    {visible.map((f) => <th key={f.id} className="whitespace-nowrap px-5 py-3 text-left">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const on = selected.includes(r.key);
                    const m = REVIEW_STATUS[r.state];
                    return (
                      <tr key={r.key} {...pick.row(r.key)} onClick={() => router.push(`/submissions/${encodeURIComponent(r.paper.id)}/chair/review`)} className={`cursor-pointer transition-colors hover:bg-canvas ${on ? "bg-primary-soft" : ""}`}>
                        <td className="sticky left-0 z-[1] w-11 min-w-[44px] bg-inherit py-3 pl-4" onClick={(ev) => ev.stopPropagation()}><input type="checkbox" checked={on} aria-label={`Select ${r.paper.title}`} {...pick.box(r.key)} /></td>
                        <td title={r.paper.title} className="sticky left-11 z-[1] min-w-[260px] max-w-[260px] truncate bg-inherit px-4 py-3 font-semibold text-primary shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]">{r.paper.title}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-ink-faint">{r.paper.id}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-ink">{r.reviewer}</td>
                        <td className="whitespace-nowrap px-5 py-3"><span style={{ color: m.color, background: m.bg }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">{r.state === "done" && <Check size={11} strokeWidth={2.5} aria-hidden="true" />} {m.label}</span></td>
                        <td className="whitespace-nowrap px-5 py-3 text-ink-muted">{r.review?.submittedAt || "—"}</td>
                        {visible.map((f) => { const v = cell(r, f.id); return <td key={f.id} className={`whitespace-nowrap px-5 py-3 ${v == null ? "text-ink-faint" : "text-ink"}`}>{v == null ? "—" : f.type === "score" ? <span className="font-semibold">{v}<span className="font-normal text-ink-faint">/{f.max ?? 5}</span></span> : v}</td>; })}
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={visible.length + 6} className="py-10 text-center text-ink-faint">{rows.length === 0 ? "No reviews yet — assign reviewers from the Peer Review list." : "No reviews match your filters."}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs font-medium text-ink-faint">Total: {filtered.length}{selected.length ? ` · ${selected.length} selected` : ""}</div>
          </>
        )}
      </div>
      <Dialog open={colsOpen} onClose={() => setColsOpen(false)} title="Visible columns" size="sm">
        <p className="mb-4 text-sm text-ink-muted">Choose which Review Form fields appear as columns. Title, Submission number, Reviewer, status and last-modified always show.</p>
        <div className="mb-5 space-y-1">{COLUMN_FIELDS.map((f) => <label key={f.id} className="flex cursor-pointer items-center gap-2.5 py-2 text-sm text-ink"><input type="checkbox" checked={!hidden.includes(f.id)} onChange={(ev) => setHidden((ids) => (ev.target.checked ? ids.filter((id) => id !== f.id) : [...ids, f.id]))} /> {f.label}</label>)}</div>
        <Button className="w-full" onClick={() => setColsOpen(false)}>Done</Button>
      </Dialog>
    </ConferenceShell>
  );
}
