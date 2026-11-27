"use client";

import { Check, ChevronDown, ChevronsUpDown, ChevronUp, Pencil, Plus, Search, ThumbsUp, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import type { ChairConference, PoolReviewer, ReviewBoard } from "@/types/chair";
import { newAssignmentDue, reviewerConflict } from "../assign-rules";
import { prRowOf, REVIEWER_STATE, type PrRow, type ReviewerState } from "../peer-review";
import { useChairConference } from "../use-chair-conference";
import { chairPaperHref } from "@/lib/routes";
import { isValidEmail } from "@/lib/email";

/* The chair's reviewer committee (the prototype's PeerReviewReviewersPane): everyone invited, with the papers each one has (and
   where each review stands), the workload, the review status, and the actions: add a reviewer (an invitation email goes out),
   edit the name, remove, and "Assign papers". Not ported yet: the on-time rate and Helpful columns (they need every conference's
   history), the matching of a reviewer's expertise to a paper's keywords. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const FCTL = "h-7 w-full rounded-md border-[1.5px] border-line bg-white text-[11px] normal-case tracking-normal outline-none focus:border-primary";
const ORDER: Record<ReviewerState, number> = { overdue: 0, waiting: 1, invite: 1, active: 2, done: 3 };
const STATUS_CFG = {
  not_started: { label: "Not started", color: "var(--warning-ink)", bg: "var(--warning-soft)" },
  in_progress: { label: "In progress", color: "var(--secondary)", bg: "var(--primary-soft)" },
  completed: { label: "Completed", color: "var(--success-ink)", bg: "var(--success-soft)" },
} as const;
type ReviewStatus = keyof typeof STATUS_CFG;
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const day = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** The prototype shows an on-time rate only from this many reviews. */
const TRACK_RECORD_MIN = 3;
interface Row { rev: PoolReviewer; papers: Array<{ row: PrRow; state: ReviewerState; due: string; submittedAt: string }>; assigned: number; done: number; status: ReviewStatus; sent: number; onTime: number; rate: number | null; helpful: number; overdueNow: number }
const isoOf = (label: string) => { const t = Date.parse(label); if (Number.isNaN(t)) return ""; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ONTIME_FILTER: Record<string, (r: Row) => boolean> = { high: (r) => r.rate != null && r.rate >= 0.9, mid: (r) => r.rate != null && r.rate >= 0.7 && r.rate < 0.9, low: (r) => r.rate != null && r.rate < 0.7, new: (r) => r.rate == null, overdue: (r) => r.overdueNow > 0 };
const ONTIME_OPTS: Array<[string, string]> = [["all", "All"], ["high", "90% and above"], ["mid", "70–89%"], ["low", "Below 70%"], ["new", "New reviewer"], ["overdue", "Overdue now"]];

function rowsOf(pool: PoolReviewer[], data: ChairConference, board: ReviewBoard): Row[] {
  const prs = data.papers.filter((p) => !p.withdrawn).map((p) => prRowOf(p, board, data.screening));
  return pool.map((rev) => {
    const papers = prs.flatMap((row) => { const x = row.reviewers.find((y) => (y.r.awaitingInvite ? y.r.reviewerId === rev.memberId : rev.userId !== null && y.r.reviewerId === rev.userId)); return x ? [{ row, state: x.state, due: x.r.due, submittedAt: x.r.review?.submittedAt ?? "" }] : []; })
      .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.row.paper.id.localeCompare(b.row.paper.id, undefined, { numeric: true }));
    const done = papers.filter((p) => p.state === "done").length;
    // Their track record in THIS conference (the prototype counts every conference, which the database does not let a chair read): reviews sent by their due date.
    const sentOnes = papers.filter((p) => p.state === "done");
    const onTime = sentOnes.filter((p) => !p.due || (isoOf(p.submittedAt) || "0000") <= p.due).length;
    const overdueNow = papers.filter((p) => p.state === "overdue" && !p.row.decided).length;
    return { rev, papers, assigned: papers.length, done, status: papers.length === 0 || done === 0 ? "not_started" : done >= papers.length ? "completed" : "in_progress", sent: sentOnes.length, onTime, rate: sentOnes.length >= TRACK_RECORD_MIN ? onTime / sentOnes.length : null, helpful: 0, overdueNow };
  });
}

/** The Tracks picker (the prototype's Fourwaves-style multi-select): a trigger that shows the chosen tracks and a checkbox list to pick more than one. */
function TrackPicker({ tracks, picked, onChange }: { tracks: string[]; picked: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-left text-sm outline-none focus:border-primary">
        <span className={`min-w-0 flex-1 truncate ${picked.length ? "text-ink" : "text-slate-400"}`}>{picked.length ? picked.join(", ") : "Select one or more tracks"}</span>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-ink-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="listbox" aria-multiselectable="true" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px rgba(11,16,32,0.12)" }} className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl bg-white p-1.5">
            {tracks.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-canvas">
                <input type="checkbox" className="cursor-pointer accent-primary" checked={picked.includes(t)} onChange={() => onChange(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t])} /> {t}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReviewerForm({ mode, initial, tracks, onClose, onSave, busy, error, canAssign }: { mode: "add" | "edit"; initial: { name: string; email: string; tracks: string[] }; tracks: string[]; onClose: () => void; onSave: (v: { name: string; email: string; tracks: string[] }, assign: boolean) => void; busy: boolean; error: string; /** A paper is ready to take a reviewer (else "Add & assign papers" would open an empty list). */ canAssign: boolean }) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [picked, setPicked] = useState(initial.tracks);
  const ok = name.trim().length > 0 && isValidEmail(email.trim());
  const v = { name: name.trim(), email: email.trim(), tracks: picked };
  const changed = v.name !== initial.name.trim() || JSON.stringify([...picked].sort()) !== JSON.stringify([...initial.tracks].sort());
  return (
    <>
      <div className="space-y-4">
        <div><label htmlFor="rv-name" className="mb-1 block text-xs font-semibold text-ink-soft">Full name <span className="text-danger-ink">*</span></label><input id="rv-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm outline-none focus:border-primary" /></div>
        <div><label htmlFor="rv-email" className="mb-1 block text-xs font-semibold text-ink-soft">Email address <span className="text-danger-ink">*</span></label><input id="rv-email" value={email} readOnly={mode === "edit"} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm outline-none focus:border-primary read-only:bg-canvas read-only:text-ink-muted" /></div>
        {(
          <div>
            <div className="mb-1 text-xs font-semibold text-ink-soft">Tracks</div>
            {tracks.length === 0 ? <p className="text-xs text-ink-faint">No tracks defined for this conference yet — add them under Settings to scope reviewers by track.</p> : (
              <TrackPicker tracks={tracks} picked={picked} onChange={setPicked} />
            )}
            <p className="mt-1 text-xs text-ink-faint">Optional — scopes this reviewer to submissions in the chosen track(s).{mode === "add" ? " They are emailed an invitation to join the committee." : ""}</p>
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button disabled={!ok || busy || (mode === "edit" && !changed)} title={mode === "edit" && !changed ? "No changes to save" : undefined} onClick={() => onSave(v, false)}>{busy ? "Saving…" : mode === "edit" ? "Save" : "Add reviewer"}</Button>
        {mode === "add" && <Button variant="outline" disabled={!ok || busy || !canAssign} title={canAssign ? "Adds the reviewer, then opens the list of papers so you can assign some to them right away" : "No paper is ready for a reviewer yet (papers need their file and, when it is on, the screening first)"} onClick={() => onSave(v, true)}>Add &amp; assign papers</Button>}
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
      </div>
    </>
  );
}

function AssignDialog({ rev, rows, data, deadline, load, maxLoad, onClose, onAssign, busy, error }: { rev: PoolReviewer; rows: PrRow[]; data: ChairConference; deadline: string; load: number; maxLoad: number | null; onClose: () => void; onAssign: (ids: string[], due: string) => void; busy: boolean; error: string }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState(deadline || plusDays(28));
  const text = q.trim().toLowerCase();
  const items = rows.filter((r) => !r.decided && !r.paper.withdrawn && r.stage !== "upload").map((r) => {
    const mine = r.reviewers.some((x) => (x.r.awaitingInvite ? x.r.reviewerId === rev.memberId : rev.userId !== null && x.r.reviewerId === rev.userId));
    const conflict = reviewerConflict(rev, r.paper);
    const block = mine ? "Already assigned" : conflict ? `Conflict · ${conflict}` : !r.canAssign ? "After the plagiarism check" : null;
    return { r, block, needs: r.reviewers.length < r.target };
  }).sort((a, b) => Number(Boolean(a.block)) - Number(Boolean(b.block)) || Number(b.needs) - Number(a.needs) || a.r.paper.id.localeCompare(b.r.paper.id, undefined, { numeric: true }))
    .filter((x) => !text || `${x.r.paper.id} ${x.r.paper.title} ${x.r.paper.track}`.toLowerCase().includes(text));
  void data;
  const room = maxLoad === null ? Infinity : Math.max(0, maxLoad - load);
  const atLimit = picked.length >= room;
  return (
    <>
      {rev.status === "invited" && <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-ink">{rev.name} hasn&apos;t accepted the committee invitation yet. These papers reach them once they do, and they can still accept or decline each one.</p>}
      <p className="mb-3 text-xs font-semibold text-ink-soft">{load}{maxLoad ? ` of ${maxLoad}` : ""} paper{load === 1 ? "" : "s"} now · {picked.length} selected</p>
      <label className="mb-3 flex h-9 w-72 max-w-full items-center gap-2 rounded-lg border border-line bg-white px-3"><Search size={14} aria-hidden="true" className="text-ink-faint" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, title or track" aria-label="Search papers" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" /></label>
      {atLimit && maxLoad !== null && <p className="mb-2 text-xs font-semibold text-warning-ink">{rev.name} would reach the maximum of {maxLoad} papers — no more can be selected.</p>}
      <ul className="max-h-[44vh] divide-y divide-muted overflow-y-auto rounded-xl border border-line">
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-faint">No paper can take a reviewer yet.</li>}
        {items.map(({ r, block, needs }) => {
          const on = picked.includes(r.paper.dbId);
          const off = Boolean(block) || (!on && atLimit);
          return (
            <li key={r.paper.dbId} className={`${block ? "opacity-55" : ""} ${on ? "bg-primary-soft" : ""}`}>
              <label className={`flex items-start gap-3 px-4 py-2.5 ${off ? "cursor-not-allowed" : "cursor-pointer hover:bg-canvas"}`} title={block ?? (off ? "Reached the maximum papers per reviewer" : undefined)}>
                <input type="checkbox" checked={on} disabled={off} aria-label={`Select ${r.paper.id}`} onChange={() => setPicked((l) => (l.includes(r.paper.dbId) ? l.filter((x) => x !== r.paper.dbId) : [...l, r.paper.dbId]))} className="mt-1" />
                <span className="w-[72px] shrink-0 pt-0.5 text-xs font-semibold text-ink-muted">{r.paper.id}</span>
                <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-navy">{r.paper.title}</span><span className="mt-1 flex flex-wrap items-center gap-2">{r.paper.track && <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-bold text-ink-soft">{r.paper.track}</span>}{block && <span className={`text-[11px] font-semibold ${block.startsWith("Conflict") ? "text-danger-ink" : "text-ink-faint"}`}>{block}</span>}</span></span>
                <span className={`shrink-0 whitespace-nowrap pt-0.5 text-[11px] font-bold tabular-nums ${block ? "text-ink-faint" : needs ? "text-warning-ink" : "text-success-ink"}`}>{r.reviewers.length} of {r.target} reviewers</span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">Review due <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 rounded-lg border-[1.5px] border-line px-2 text-[13px] outline-none focus:border-primary" /></label>
        <span className="ml-auto inline-flex gap-2"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button disabled={!picked.length || !due || busy} onClick={() => onAssign(picked, due)}><Check size={15} aria-hidden="true" /> {busy ? "Assigning…" : `Assign ${picked.length || ""} paper${picked.length === 1 ? "" : "s"}`}</Button></span>
      </div>
    </>
  );
}

type Modal = null | { kind: "add" } | { kind: "edit"; rev: PoolReviewer } | { kind: "assign"; rev: PoolReviewer; fresh?: boolean } | { kind: "remove"; rev: PoolReviewer };

export function ReviewersPage({ slug }: { slug: string }) {
  const { state, retry, reload } = useChairConference(slug, { board: true, pool: true, settings: true });
  const [f, setF] = useState({ search: "", track: "all", load: "all", status: "all", ontime: "all", helpful: "all" });
  const [sort, setSort] = useState<{ key: "name" | "assigned" | "ontime" | "helpful" | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const [open, setOpen] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const gate = workspaceGate(state, retry, { title: "Peer Review / Reviewers", loadingLabel: "Loading the reviewers", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the reviewers." });
  if (gate || state.status !== "ready" || !state.board || !state.pool) return gate;
  const { conference, roles, others, data, board, pool, settings } = state;
  const all = rowsOf(pool.reviewers, data, board);
  const prs = data.papers.filter((p) => !p.withdrawn).map((p) => prRowOf(p, board, data.screening));
  // The same papers the Assign dialog offers (a conflict depends on the reviewer, so it is not counted here).
  const canAssign = prs.some((r) => !r.decided && !r.paper.withdrawn && r.stage !== "upload" && r.canAssign);
  const q = f.search.trim().toLowerCase();
  const rows = all
    .filter((r) => !q || r.rev.name.toLowerCase().includes(q) || r.rev.email.toLowerCase().includes(q))
    .filter((r) => f.track === "all" || !r.rev.tracks.length || r.rev.tracks.includes(f.track))
    .filter((r) => f.load === "all" || (f.load === "none" ? r.assigned === 0 : f.load === "some" ? r.assigned > 0 : r.assigned > 0 && r.done >= r.assigned))
    .filter((r) => f.ontime === "all" || ONTIME_FILTER[f.ontime]?.(r))
    .filter((r) => f.helpful === "all" || (f.helpful === "yes" ? r.helpful > 0 : r.helpful === 0))
    .filter((r) => f.status === "all" || (f.status === "invited" || f.status === "declined" ? r.rev.status === f.status : r.status === f.status));
  if (sort.key) {
    const sign = sort.dir === "desc" ? -1 : 1;
    const val = (r: Row): number | string | null => (sort.key === "name" ? r.rev.name.toLowerCase() : sort.key === "assigned" ? r.assigned : sort.key === "ontime" ? r.rate : r.helpful);
    // A reviewer without a value (a new reviewer has no on-time rate) always sorts last.
    rows.sort((a, b) => { const av = val(a), bv = val(b); if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1; return sign * (typeof av === "string" ? av.localeCompare(String(bv)) : av - Number(bv)); });
  }
  const filtersOn = Boolean(q) || f.track !== "all" || f.load !== "all" || f.status !== "all" || f.ontime !== "all" || f.helpful !== "all";
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggleSort = (key: "name" | "assigned" | "ontime" | "helpful") => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));
  const nameOf = (r: PoolReviewer) => r.name;
  const paperIds = data.papers.map((p) => p.dbId);

  const th = (label: string, o: { sortKey?: "name" | "assigned" | "ontime" | "helpful"; filter?: ReactNode; className?: string; title?: string } = {}) => {
    const on = o.sortKey && sort.key === o.sortKey;
    const Icon = on ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th title={o.title} aria-sort={o.sortKey ? (on ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined} className={`sticky top-0 z-10 bg-[#F8FAFC] px-3 pb-2 pt-2.5 text-left align-top text-ink-muted shadow-[inset_0_-1px_0_var(--border)] ${o.className ?? ""}`}>
        <div className="mb-1.5 flex items-center gap-1 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wider">{o.sortKey ? <button type="button" onClick={() => toggleSort(o.sortKey!)} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider hover:text-navy ${on ? "text-navy" : ""}`}>{label} <Icon size={12} className={on ? "" : "opacity-40"} aria-hidden="true" /></button> : label}</div>
        {o.filter ?? <div className="h-7" />}
      </th>
    );
  };
  const sel = (label: string, value: string, onChange: (v: string) => void, options: Array<[string, string]>) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${FCTL} cursor-pointer px-1.5 font-semibold ${value === "all" ? "text-ink-faint" : "text-primary"}`}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  );

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong.");
  const mailNote = (m: string | null, ok: FlowToastData): FlowToastData => (m ? { title: ok.title, text: `${ok.text} ${m}` } : ok);
  const assign = async (rev: PoolReviewer, ids: string[], due: string) => {
    const svc = await getChairService();
    const given = await svc.assignPapers(rev, ids, due);
    let mail: string | null = null;
    if (rev.userId) for (const id of given) { mail = (await sendActionEmails("reviews_assigned", { submissionId: id, reviewerIds: [rev.userId] })) ?? mail; }
    setToast(mailNote(mail, { title: `${given.length} paper${given.length === 1 ? "" : "s"} assigned to ${nameOf(rev)}`, text: `Review due ${day(due)}. ${nameOf(rev)} is emailed to accept ${given.length === 1 ? "it" : "them"}.` }));
  };
  const save = async (v: { name: string; email: string; tracks: string[] }, andAssign: boolean) => {
    setBusy(true); setError("");
    try {
      const svc = await getChairService();
      if (modal?.kind === "edit") {
        const was = modal.rev;
        if (v.name !== was.name) await svc.renameReviewer(slug, was.memberId, v.name);
        const tracksChanged = v.tracks.length !== was.tracks.length || v.tracks.some((t) => !was.tracks.includes(t));
        if (tracksChanged) await svc.setReviewerTracks(slug, was.memberId, v.tracks);
        setToast({ title: "Reviewer updated", text: `${v.name}${tracksChanged ? " — tracks saved." : " was saved."}` }); setModal(null); reload(); return; }
      const res = await svc.inviteReviewer(slug, v);
      let mail: string | null = null;
      if (res.created) mail = await sendActionEmails("reviewer_invited", { memberId: res.memberId });
      const fresh: PoolReviewer = { memberId: res.memberId, userId: res.userId, name: v.name, email: v.email, tracks: v.tracks, status: "invited", invitedAt: "" };
      if (andAssign) { setModal({ kind: "assign", rev: fresh, fresh: true }); reload(); return; }
      setToast(mailNote(mail, { title: res.created ? "Reviewer invited" : "Already on the committee", text: res.created ? `${v.name} was invited to the reviewer committee.` : `${v.email} is already on the committee.` }));
      setModal(null); reload();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const doAssign = async (ids: string[], due: string) => {
    if (modal?.kind !== "assign") return;
    setBusy(true); setError("");
    try { await assign(modal.rev, ids, due); setModal(null); reload(); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const doRemove = async () => {
    if (modal?.kind !== "remove") return;
    setBusy(true); setError("");
    try { await (await getChairService()).removeReviewer(slug, modal.rev, paperIds); setToast({ title: "Reviewer removed", text: `${nameOf(modal.rev)} and their assignments were removed.` }); setModal(null); reload(); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const close = () => { if (!busy) { setModal(null); setError(""); } };
  // A dialog closes only itself: when one closes because the next one opens (Add & assign papers: the form, then the papers), its close must not
  // take the new one away too.
  const closeOnly = (...kinds: Array<NonNullable<Modal>["kind"]>) => () => { if (!busy) { setModal((m) => (m && kinds.includes(m.kind) ? null : m)); setError(""); } };

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="peer-review/reviewers" screening={data.screening}>
      <PageHeader title="Peer Review / Reviewers" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page p-8">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          {filtersOn && (<><span className="text-xs text-ink-muted"><b className="text-navy">{rows.length}</b> reviewer{rows.length === 1 ? "" : "s"} match</span><button type="button" onClick={() => setF({ search: "", track: "all", load: "all", status: "all", ontime: "all", helpful: "all" })} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink-soft hover:text-primary"><X size={13} aria-hidden="true" /> Clear filters</button></>)}
          <Button size="sm" onClick={() => { setError(""); setModal({ kind: "add" }); }}><Plus size={14} aria-hidden="true" /> Add reviewer</Button>
        </div>
        <div style={{ ...CARD, maxHeight: "calc(100vh - 230px)", minHeight: 320 }} className="mb-6 overflow-auto rounded-2xl bg-white">
          <table className="ui-table w-full border-separate border-spacing-0 text-sm [&_tbody_td]:border-b [&_tbody_td]:border-muted">
            <thead>
              <tr>
                {th("Name", { sortKey: "name", className: "min-w-[220px]", filter: <input value={f.search} onChange={(e) => set("search")(e.target.value)} placeholder="Search name or email" aria-label="Search reviewers" className={`${FCTL} px-2 font-medium`} /> })}
                {th("Tracks", { className: "min-w-[130px]", filter: sel("Track", f.track, set("track"), [["all", "All"], ...pool.tracks.map((t): [string, string] => [t, t])]) })}
                {th("Papers", { className: "min-w-[240px]" })}
                {th("Assigned reviews", { sortKey: "assigned", className: "min-w-[170px]", filter: sel("Assigned reviews", f.load, set("load"), [["all", "All"], ["none", "None"], ["some", "Has papers"], ["alldone", "All reviewed"]]) })}
                {th("On-time rate", { sortKey: "ontime", className: "min-w-[130px]", title: "Reviews sent by their deadline (shown from 3 reviews). Counts this conference only for now.", filter: sel("On-time rate", f.ontime, set("ontime"), ONTIME_OPTS) })}
                {th("Helpful", { sortKey: "helpful", className: "min-w-[100px]", title: "Reviews marked Helpful by chairs", filter: sel("Helpful", f.helpful, set("helpful"), [["all", "All"], ["yes", "Has helpful"], ["no", "None"]]) })}
                {th("Review status", { className: "min-w-[150px]", filter: sel("Review status", f.status, set("status"), [["all", "All"], ...Object.entries(STATUS_CFG).map(([k, c]): [string, string] => [k, c.label]), ["invited", "Invited · not accepted"], ["declined", "Declined invitation"]]) })}
                {th("Actions", { className: "min-w-[260px] text-right" })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cfg = STATUS_CFG[r.status];
                const isOpen = r.papers.length > 0 && open.includes(r.rev.memberId);
                const declined = r.rev.status === "declined";
                return (
                  <Fragment key={r.rev.memberId}>
                    <tr className={isOpen ? "bg-canvas" : ""}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{initials(r.rev.name)}</span>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5 font-medium text-ink">{r.rev.name}
                              {r.rev.status === "invited" && <span title={`Invited ${r.rev.invitedAt} — hasn't accepted yet`} className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-ink">Invited · not accepted</span>}
                              {declined && <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger-ink">Declined invitation</span>}
                            </div>
                            <div className="text-xs text-ink-faint">{r.rev.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">{r.rev.tracks.length ? <div className="flex flex-wrap gap-1">{r.rev.tracks.map((t) => <span key={t} className="rounded-md bg-canvas px-2 py-0.5 text-[10.5px] font-medium text-ink-soft">{t}</span>)}</div> : <span className="text-xs text-ink-faint">All tracks</span>}</td>
                      <td className="px-5 py-3">
                        {r.papers.length === 0 ? <span className="text-xs text-ink-faint">No papers yet</span> : (
                          <button type="button" aria-expanded={isOpen} onClick={() => setOpen((l) => (l.includes(r.rev.memberId) ? l.filter((x) => x !== r.rev.memberId) : [...l, r.rev.memberId]))} title={isOpen ? "Hide their papers" : "Show their papers"} className={`-ml-1.5 flex items-center gap-1.5 rounded-xl border py-1 pl-1.5 pr-2 text-left transition-colors hover:border-primary hover:bg-primary-soft ${isOpen ? "border-primary bg-primary-soft" : "border-transparent"}`}>
                            <span className="flex max-w-[290px] flex-wrap items-center gap-1">
                              {r.papers.slice(0, 3).map(({ row, state: st }) => <span key={row.paper.dbId} title={`${row.paper.title} — ${REVIEWER_STATE[st].word}`} className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[11px] font-bold tabular-nums ${st === "overdue" ? "border-danger bg-danger-soft text-danger-ink" : "border-line bg-white text-ink"}`}><span aria-hidden="true" style={{ background: REVIEWER_STATE[st].color }} className="h-1.5 w-1.5 shrink-0 rounded-full" />{row.paper.id}</span>)}
                              {r.papers.length > 3 && <span className="text-[11px] font-bold text-ink-muted">+{r.papers.length - 3} more</span>}
                            </span>
                            <ChevronDown size={13} aria-hidden="true" className={`shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3"><div className="whitespace-nowrap text-[13px]"><span className="font-semibold text-primary">{r.assigned}</span><span className="text-ink-muted"> paper{r.assigned === 1 ? "" : "s"}</span>{r.assigned > 0 && <span className={r.done >= r.assigned ? "text-success-ink" : "text-ink-muted"}> · {r.done} reviewed</span>}</div></td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {r.rate == null
                          ? <span title={`${r.sent} sent so far`} className="text-xs font-semibold text-ink-faint">New reviewer</span>
                          : <span title={`${r.onTime} of ${r.sent} on time`} style={{ color: r.rate >= 0.9 ? "var(--success-ink)" : r.rate >= 0.7 ? "#B45309" : "var(--danger-ink)" }} className="font-bold tabular-nums">{Math.round(r.rate * 100)}%</span>}
                        {r.overdueNow > 0 && <div className="text-[11px] font-semibold text-danger-ink">{r.overdueNow} overdue now</div>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">{r.helpful ? <span style={{ color: "#8A6212" }} className="inline-flex items-center gap-1 font-bold"><ThumbsUp size={12} aria-hidden="true" /> {r.helpful}</span> : <span className="text-ink-faint">—</span>}</td>
                      <td className="px-5 py-3"><span style={{ color: cfg.color, background: cfg.bg }} className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold">{cfg.label}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button type="button" disabled={declined} onClick={() => { setError(""); setModal({ kind: "assign", rev: r.rev }); }} title={declined ? "Declined the committee invitation" : `Choose papers for ${r.rev.name}`} className="group inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white pl-1.5 pr-3 text-xs font-bold text-navy transition-all enabled:hover:border-primary enabled:hover:bg-primary-soft enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"><span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-primary"><Plus size={12} strokeWidth={2.5} /></span> Assign papers</button>
                          <button type="button" onClick={() => { setError(""); setModal({ kind: "edit", rev: r.rev }); }} aria-label={`Edit ${r.rev.name}`} className="text-ink-faint transition-colors hover:text-primary"><Pencil size={14} /></button>
                          <button type="button" onClick={() => { setError(""); setModal({ kind: "remove", rev: r.rev }); }} aria-label={`Remove ${r.rev.name}`} className="text-ink-faint transition-colors hover:text-danger-ink"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-canvas"><td colSpan={8} className="pb-4 pl-[68px] pr-5">
                        <ul className="divide-y divide-muted rounded-xl border border-line bg-white">
                          {r.papers.map(({ row, state: st, due }) => (
                            <li key={row.paper.dbId} className="flex flex-wrap items-center gap-3 px-4 py-2 text-[13px]">
                              <span className="w-[72px] shrink-0 text-xs font-semibold text-ink-muted">{row.paper.id}</span>
                              <Link href={chairPaperHref(slug, row.paper.id)} className="min-w-0 flex-1 truncate font-semibold text-navy hover:text-primary">{row.paper.title}</Link>
                              <span style={{ color: REVIEWER_STATE[st].color }} className="text-[11px] font-bold">{REVIEWER_STATE[st].word}</span>
                              <span className="text-xs text-ink-muted">{st === "done" ? "" : `Due ${day(due)}`}</span>
                            </li>
                          ))}
                        </ul>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-ink-faint">{filtersOn ? "No reviewers match these filters." : "No reviewers yet — add one to build the reviewer pool."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modal?.kind === "add" || modal?.kind === "edit"} onClose={closeOnly("add", "edit")} title={modal?.kind === "edit" ? "Edit reviewer" : "Add reviewer"} size="md">
        {(modal?.kind === "add" || modal?.kind === "edit") && <ReviewerForm key={modal.kind === "edit" ? modal.rev.memberId : "new"} mode={modal.kind} initial={modal.kind === "edit" ? { name: modal.rev.name, email: modal.rev.email, tracks: modal.rev.tracks } : { name: "", email: "", tracks: [] }} tracks={pool.tracks} onClose={close} onSave={(v, a) => void save(v, a)} busy={busy} error={error} canAssign={canAssign} />}
      </Dialog>
      <Dialog open={modal?.kind === "assign"} onClose={closeOnly("assign")} title={modal?.kind === "assign" ? `Assign papers to ${modal.rev.name}` : "Assign papers"} size="xl">
        {modal?.kind === "assign" && <AssignDialog key={modal.rev.memberId} rev={modal.rev} rows={prs} data={data} deadline={newAssignmentDue(settings, board.deadline)} load={all.find((x) => x.rev.memberId === modal.rev.memberId)?.assigned ?? 0} maxLoad={settings?.limits.maxPapersPerReviewer ?? null} onClose={close} onAssign={(ids, due) => void doAssign(ids, due)} busy={busy} error={error} />}
      </Dialog>
      <Dialog open={modal?.kind === "remove"} onClose={closeOnly("remove")} title="Remove this reviewer?" size="md">
        {modal?.kind === "remove" && (
          <>
            <p className="text-sm text-ink-soft"><b className="text-navy">{modal.rev.name}</b> comes off the committee, and so do their assignments and reviews in this conference.</p>
            {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
            <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={close} disabled={busy}>Cancel</Button><Button onClick={() => void doRemove()} disabled={busy} className="bg-danger hover:bg-danger"><Trash2 size={14} aria-hidden="true" /> {busy ? "Removing…" : "Remove reviewer"}</Button></div>
          </>
        )}
      </Dialog>
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
