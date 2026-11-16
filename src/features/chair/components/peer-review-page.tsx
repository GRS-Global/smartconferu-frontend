"use client";

import { Bell, Check, ChevronDown, Download, ChevronsUpDown, ChevronUp, Clock, FileCheck, FileText, Info, Mail, Send, Sparkles, UserPlus, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import type { ChairPaper, DecisionType, PoolReviewer } from "@/types/chair";
import { AssignReviewerPopover, type AssignCandidate } from "./assign-reviewer-popover";
import { AddReviewersModal } from "./add-reviewers-modal";
import { addReviewersToPaper, type AddPick } from "../add-reviewers";
import { ReviewTimelineStrip } from "./review-timeline-strip";
import { AssignSameModal } from "./assign-same-modal";
import { AutoAssignModal } from "./auto-assign-modal";
import { EditDecisionsModal } from "./edit-decisions-modal";
import { isOnPaper, newAssignmentDue, rankReviewersFor, reviewerConflict, type PlanItem } from "../assign-rules";
import { useRangeSelect } from "@/lib/use-range-select";
import { CHECK_DECISIONS, PLAG_DECISIONS, screeningMeta, screeningStatusOf } from "../screening";
import { ScreeningReportModal } from "./screening-report-modal";
import { daysUntil, declinedShown, isShort, PR_FILTERS, PR_STAGES, prRowOf, REVIEWER_STATE, type PrRow } from "../peer-review";
import { useChairConference } from "../use-chair-conference";
import { readPeerReviewView, savePeerReviewView } from "../peer-review-view";

/* The chair's Peer Review list (the prototype's PeerReviewListPage): one bucket per job (needs reviewers, waiting on reviewers, needs my
   decision, reviewed) with the urgent parts as chips, and the table of papers with each reviewer's line, due date and score, and the
   decision as a dropdown that records it at once (the authors are told with "Notify authors"). Also here: assigning reviewers (one paper from the popover, the same reviewers
   to many, auto-assign), reminders (one reviewer, the selection, every overdue review), the review-window strip, the score cut-offs of "Needs my decision", row
   selection with the bulk bar (Edit decisions), the "Columns" menu, and "All reviews & export" (Peer Review › Manage › Reviews). The Initial check / Plagiarism columns
   (with their linked filters and the "View report" popup) are ported. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const TONES = {
  danger: { color: "var(--danger)", bg: "var(--danger-soft)", border: "#FECACA" },
  warning: { color: "#B45309", bg: "var(--warning-soft)", border: "#FCD9A8" },
  info: { color: "#0369A1", bg: "#E0F2FE", border: "#BAE6FD" },
} as const;
const ICONS: Record<string, LucideIcon> = { all: FileText, needs: UserPlus, waiting: Clock, ready: FileCheck, decided: Check };
const FCTL = "h-7 w-full rounded-md border-[1.5px] border-line bg-white text-[11px] normal-case tracking-normal outline-none focus:border-primary";
const REVIEWER_OPTS: Array<[string, string]> = [["all", "All"], ["none", "Not assigned"], ["short", "Short of target"], ["overdue", "Has overdue"], ["allin", "All reviews in"]];
const DUE_OPTS: Array<[string, string]> = [["all", "All"], ["overdue", "Overdue"], ["week", "Next 7 days"], ["none", "Nothing due"]];
const SCORE_OPTS: Array<[string, string]> = [["all", "All"], ["scored", "Has scores"], ["none", "No scores yet"], ["split", "Reviewers split"]];
const NOT_CHOICES = new Set(["upload_pending", "no_decision", "plagiarism_clear", "registered"]);
type SortKey = "id" | "avg" | "due";
const SORT_FIRST: Record<SortKey, "asc" | "desc"> = { id: "asc", avg: "desc", due: "asc" };
const SORT_VAL: Record<SortKey, (r: PrRow) => string | number | null> = { id: (r) => r.paper.id, avg: (r) => r.avg, due: (r) => r.nextDue || null };

const OPTIONAL_COLUMNS = [{ key: "plagiarism", label: "Plagiarism %" }, { key: "confidence", label: "Avg confidence" }] as const;
const CONFIDENCE: Record<string, number> = { high: 3, medium: 2, low: 1 };
const BAND_EDGE = { accept: "var(--success)", borderline: "#F59E0B", reject: "var(--danger)" } as const;
const STICKY_DECISION: CSSProperties = { position: "sticky", right: 0, zIndex: 2, background: "#FFFFFF", boxShadow: "-8px 0 12px -10px rgba(11,16,32,0.25)", borderLeft: "1px solid var(--border)" };
const OUTCOME_LABEL: Record<string, string> = { accept: "Accept", registered: "Registered", reject: "Reject", revise: "Revision", waitlist: "Waitlist" };
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const day = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");
const LINE = "flex h-[30px] items-center gap-2 whitespace-nowrap";

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string] | [string, string, boolean]> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${FCTL} cursor-pointer px-1.5 font-semibold ${value === "all" ? "text-ink-faint" : "text-primary"}`}>
      {options.map(([k, l, off]) => <option key={k} value={k} disabled={off}>{l}</option>)}
    </select>
  );
}

/** One reviewer line per column: the same lines, in the same order, in Reviewer / Review / Due / Score. */
function Lines({ r, cell }: { r: PrRow; cell: (x: PrRow["reviewers"][number]) => ReactNode }) {
  const dec = declinedShown(r);
  if (r.reviewers.length === 0 && dec.length === 0) return <span className="text-line-strong">—</span>;
  return (
    <>
      {r.reviewers.map((x, i) => <div key={x.r.assignmentId} className={`${LINE} ${i ? "border-t border-dashed border-line" : ""}`}>{cell(x)}</div>)}
      {dec.map((d, i) => <div key={`d-${d.name}-${i}`} className={`${LINE} ${r.reviewers.length || i ? "border-t border-dashed border-line" : ""}`}><span className="text-[11px] text-ink-faint line-through">{d.name}</span></div>)}
    </>
  );
}

export function PeerReviewPage({ slug }: { slug: string }) {
  const { state, retry, reload } = useChairConference(slug, { board: true, settings: true, pool: true });
  // The Overview links here with ?filter=<bucket> (needs, waiting, ready, decided, all).
  const asked = useSearchParams().get("filter");
  // The view is kept for this tab: coming back from a paper lands on the same filter, search and sort (the prototype's saved view).
  const [saved] = useState(() => readPeerReviewView(slug));
  const [filter, setFilter] = useState(PR_FILTERS.some((x) => x.key === asked) ? (asked as string) : PR_FILTERS.some((x) => x.key === saved?.filter) ? (saved?.filter as string) : "all");
  const [track, setTrack] = useState(saved?.track || "all");
  const [f, setF] = useState({ id: saved?.idq || "", title: saved?.query || "", reviewers: saved?.rv || "all", due: saved?.du || "all", score: saved?.sc || "all", decision: saved?.dc || "all" });
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>(saved?.sort && (saved.sort.key === null || saved.sort.key in SORT_FIRST) ? { key: saved.sort.key as SortKey | null, dir: saved.sort.dir } : { key: null, dir: "asc" });
  // More columns (Columns menu) and the score cut-offs of "Needs my decision".
  const [extraCols, setExtraCols] = useState<string[]>([]);
  const [colsOpen, setColsOpen] = useState(false);
  const [cut, setCut] = useState({ accept: 4, reject: 2.5 });
  const [busy, setBusy] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  // Linked Initial check / Plagiarism filters, and the paper whose screening report is open.
  const [icF, setIcF] = useState(saved?.ic || "all");
  const [plF, setPlF] = useState(saved?.pl || "all");
  const [reportFor, setReportFor] = useState<ChairPaper | null>(null);
  // The paper whose "Assign" popover is open (with the button it hangs from).
  const [assignFor, setAssignFor] = useState<{ id: string; rect: DOMRect } | null>(null);
  // The paper whose "Add reviewers" dialog is open (opened from the popover's "Invite someone new").
  const [addFor, setAddFor] = useState<string | null>(null);
  const [addError, setAddError] = useState("");
  // Reviewer reminders sent from this page in this tab (assignment ids) — shown as "Reminded"; the database keeps no "last reminded" yet.
  const [reminded, setReminded] = useState<string[]>([]);
  // Row selection (kept while filters change, as in the prototype), the bulk dialog that is open, and the papers worked on in this view (marked "Done").
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<null | "auto" | "same" | "decide">(null);
  const [bulkError, setBulkError] = useState("");
  const [kept, setKept] = useState<{ view: string; ids: string[] }>({ view: "", ids: [] });
  const range = useRangeSelect();
  const router = useRouter();
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    savePeerReviewView({ ...readPeerReviewView(slug), conferenceId: slug, filter, query: f.title, track, sort, ic: icF, pl: plF, idq: f.id, rv: f.reviewers, du: f.due, sc: f.score, dc: f.decision });
  }, [slug, filter, track, sort, icF, plF, f]);

  const gate = workspaceGate(state, retry, { title: "Peer Review", loadingLabel: "Loading peer review", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load peer review." });
  if (gate || state.status !== "ready" || !state.board) return gate;
  const { conference, roles, others, data, board, settings, pool } = state;
  const all = data.papers.filter((p) => !p.withdrawn).map((p) => prRowOf(p, board, data.screening));
  const tracks = [...new Set(all.map((r) => r.paper.track).filter(Boolean))].sort();
  const inTrack = track === "all" || !tracks.includes(track) ? all : all.filter((r) => r.paper.track === track);
  const active = PR_FILTERS.find((x) => x.key === filter) ?? PR_FILTERS[0];
  const decTypes = data.decisionTypes.filter((t) => !NOT_CHOICES.has(t.outcome));
  const typeOf = (r: PrRow) => (r.decided ? (data.decisionTypes.find((t) => t.id === r.paper.decisionTypeId) ?? data.decisionTypes.find((t) => t.outcome === r.paper.outcome) ?? null) : null);
  const idq = f.id.trim().toLowerCase();
  const tq = f.title.trim().toLowerCase();
  const REV: Record<string, (r: PrRow) => boolean> = { none: (r) => r.reviewers.length === 0, short: isShort, overdue: (r) => !r.decided && r.overdue > 0, allin: (r) => r.reviewers.length > 0 && r.reviewsIn >= r.reviewers.length };
  const DUE: Record<string, (r: PrRow) => boolean> = { overdue: (r) => !!r.nextDue && daysUntil(r.nextDue) < 0, week: (r) => !!r.nextDue && daysUntil(r.nextDue) >= 0 && daysUntil(r.nextDue) <= 7, none: (r) => r.nextDue === "" };
  const SCORE: Record<string, (r: PrRow) => boolean> = { scored: (r) => r.avg != null, none: (r) => r.avg == null, split: (r) => r.split };
  const icOn = data.screening.initialCheck, plOn = data.screening.plagiarism;
  const icNow = icOn ? icF : "all", plNow = plOn ? plF : "all";
  const scOf = (r: PrRow) => screeningStatusOf(r.paper, data.screening);
  const viewKey = `${filter}|${track}|${tq}|${icNow}|${plNow}|${idq}|${f.reviewers}|${f.due}|${f.score}|${f.decision}`;
  const keptIds = kept.view === viewKey ? kept.ids : [];
  const keep = (ids: string[]) => setKept((k) => ({ view: viewKey, ids: [...new Set([...(k.view === viewKey ? k.ids : []), ...ids])] }));
  const rows = inTrack.filter((r) => active.match(r) || keptIds.includes(r.paper.dbId))
    .filter((r) => icNow === "all" || scOf(r).initial === icNow)
    .filter((r) => plNow === "all" || scOf(r).plag === plNow)
    .filter((r) => !tq || `${r.paper.title} ${r.paper.track}`.toLowerCase().includes(tq))
    .filter((r) => !idq || r.paper.id.toLowerCase().includes(idq))
    .filter((r) => f.reviewers === "all" || REV[f.reviewers]?.(r))
    .filter((r) => f.due === "all" || DUE[f.due]?.(r))
    .filter((r) => f.score === "all" || SCORE[f.score]?.(r))
    .filter((r) => f.decision === "all" || (f.decision === "undecided" ? !r.decided : typeOf(r)?.id === f.decision));
  if (sort.key) {
    const val = SORT_VAL[sort.key];
    const sign = sort.dir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1;
      return sign * (typeof av === "string" ? av.localeCompare(String(bv), undefined, { numeric: true }) : av - Number(bv));
    });
  }
  const filtersOn = Boolean(icNow !== "all" || plNow !== "all" || tq || idq || f.reviewers !== "all" || f.due !== "all" || f.score !== "all" || f.decision !== "all");
  const selectedRows = all.filter((r) => selected.includes(r.paper.dbId));
  const allShownSelected = rows.length > 0 && rows.every((r) => selected.includes(r.paper.dbId));
  const pick = range({ ids: rows.map((r) => r.paper.dbId), isSelected: (id) => selected.includes(id), setMany: (ids, on) => setSelected((l) => (on ? [...new Set([...l, ...ids])] : l.filter((x) => !ids.includes(x)))) });
  const clear = () => { setF({ id: "", title: "", reviewers: "all", due: "all", score: "all", decision: "all" }); setIcF("all"); setPlF("all"); };
  // The Initial check and Plagiarism filters are linked: each one counts the papers left by the other, and an option with none is greyed out.
  const screenFilter = (isInitial: boolean) => {
    const x = isInitial
      ? { value: icNow, set: setIcF, options: CHECK_DECISIONS, get: (r: PrRow) => scOf(r).initial, other: (r: PrRow) => plNow === "all" || scOf(r).plag === plNow }
      : { value: plNow, set: setPlF, options: PLAG_DECISIONS, get: (r: PrRow) => scOf(r).plag, other: (r: PrRow) => icNow === "all" || scOf(r).initial === icNow };
    const pool = inTrack.filter(x.other);
    const count = (key: string) => pool.filter((r) => x.get(r) === key).length;
    const opts = [...x.options.map((d) => ({ key: d.key, label: d.key === "pending" ? "Not decided" : d.label })), { key: "waiting", label: "Not started" }].filter((o) => o.key !== "waiting" || count("waiting") > 0 || x.value === "waiting");
    const options: Array<[string, string] | [string, string, boolean]> = [["all", `All (${pool.length})`], ...opts.map((o): [string, string, boolean] => [o.key, `${o.label} (${count(o.key)})`, count(o.key) === 0 && x.value !== o.key])];
    return { value: x.value, onChange: x.set, options };
  };
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: SORT_FIRST[key] }));
  const unsent = inTrack.filter((r) => r.unsent);
  // Needs my decision: what the two cut-offs would mean, by the average score.
  const readyRows = inTrack.filter((r) => r.stage === "ready" && !r.decided);
  const bandOf = (r: PrRow): "accept" | "borderline" | "reject" => (r.avg == null ? "borderline" : r.avg >= cut.accept ? "accept" : r.avg < cut.reject ? "reject" : "borderline");
  const bands: Record<"accept" | "borderline" | "reject", PrRow[]> = { accept: [], borderline: [], reject: [] };
  readyRows.forEach((r) => bands[bandOf(r)].push(r));
  const acceptedNow = inTrack.filter((r) => r.decided && (typeOf(r)?.outcome ?? r.paper.outcome) === "accept").length;
  const decidedNow = inTrack.filter((r) => r.decided).length;
  // A range while borderline papers are open: all of them rejected … all of them accepted.
  const rateOf = (k: number) => (decidedNow + readyRows.length ? Math.round((k / (decidedNow + readyRows.length)) * 100) : null);
  const rateLow = rateOf(acceptedNow + bands.accept.length);
  const rateHigh = rateOf(acceptedNow + bands.accept.length + bands.borderline.length);
  const setCutAt = (key: "accept" | "reject", v: string) => setCut((c) => {
    const x = Math.round(Math.min(5, Math.max(1, Number(v) || 1)) * 10) / 10;
    // Keep reject ≤ accept: moving one past the other drags it along.
    return key === "accept" ? { accept: x, reject: Math.min(c.reject, x) } : { reject: x, accept: Math.max(c.accept, x) };
  });
  const show = (k: string) => extraCols.includes(k);
  // Cleared = past the plagiarism step (in peer review, or marked clear) — the prototype's `cleared`.
  const plCleared = (r: PrRow) => r.stage !== "plagiarism" && r.stage !== "upload";
  const similarityLimit = data.criteria.similarityLimit;
  // The newest version that has a report (the prototype's latestReport).
  const similarityOf = (r: PrRow): number | null => { for (let v = r.paper.versions; v >= 1; v -= 1) { const rep = r.paper.screening[String(v)]?.report; if (rep) return rep.similarity ?? null; } return null; };
  const confidenceOf = (r: PrRow): number | null => { const v = r.reviewers.flatMap((x) => (x.r.review ? [CONFIDENCE[x.r.review.confidence.toLowerCase()]] : [])).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  // The papers shown, in order, kept so the paper page can step through them (Prev / Next).
  // A click on the row opens the paper; the checkbox, the reviewer and decision cells and any control inside the row keep their own click (the prototype's openPaper).
  const openPaper = (e: React.MouseEvent, r: PrRow) => {
    if ((e.target as HTMLElement).closest("a, button, input, select, label, textarea, [data-nav-stop]")) return;
    if (window.getSelection()?.toString()) return;
    rememberQueue();
    router.push(`/submissions/${encodeURIComponent(r.paper.id)}/chair/review`);
  };
  const rememberQueue = () => savePeerReviewView({
    ...readPeerReviewView(slug), conferenceId: slug, filter, query: f.title, track, sort, ic: icF, pl: plF, idq: f.id, rv: f.reviewers, du: f.due, sc: f.score, dc: f.decision,
    queue: rows.map((r) => r.paper.id),
    queueLabel: [active.key === "all" ? "All papers" : active.label, icNow !== "all" ? `Initial check: ${screeningMeta(CHECK_DECISIONS, icNow).label}` : null, plNow !== "all" ? `Plagiarism: ${screeningMeta(PLAG_DECISIONS, plNow).label}` : null, track !== "all" ? track : null, tq ? `“${f.title.trim()}”` : null].filter(Boolean).join(" · "),
  });
  const statusOpts: Array<[string, string]> = PR_FILTERS.filter((x) => !x.hidden || x.key === filter).map((x) => [x.key, `${x.label} (${inTrack.filter(x.match).length})`]);

  const decide = async (r: PrRow, typeId: string) => {
    const none = data.decisionTypes.find((t) => t.outcome === "no_decision");
    const type: DecisionType | undefined = typeId === "pending" ? none : decTypes.find((t) => t.id === typeId);
    if (!type) return;
    setBusy(true);
    try {
      await (await getChairService()).recordDecision(r.paper.dbId, type.id, "");
      keep([r.paper.dbId]);
      setToast({ title: `${r.paper.id} · ${type.label}`, text: type.outcome === "no_decision" ? "The decision was taken back." : "Decision recorded. The authors aren't emailed yet — use Notify authors." });
      reload();
    } catch (e) { setToast({ title: "Couldn't record the decision", text: e instanceof Error ? e.message : "Something went wrong." }); } finally { setBusy(false); }
  };
  const notifyAll = async () => {
    setBusy(true);
    const svc = await getChairService();
    let sent = 0; let problem = "";
    for (const r of unsent) {
      try { await svc.notifyDecision(r.paper.dbId, ""); sent += 1; const mail = await sendActionEmails("decision_notified", { submissionId: r.paper.dbId }); if (mail) problem = mail; } catch (e) { problem = `${r.paper.id}: ${e instanceof Error ? e.message : "failed"}`; }
    }
    setBusy(false); setNotifyOpen(false);
    setToast({ title: `${sent} author group${sent === 1 ? "" : "s"} notified`, text: problem || "Decisions and shared reviewer comments sent." });
    if (filter === "unsent") setFilter("decided");
    reload();
  };

  // Who can take a paper: the committee (not those who declined), minus the reviewers it already has; an author of the paper or someone at the
  // per-reviewer limit is shown but cannot be picked.
  const maxLoad = settings?.limits.maxPapersPerReviewer ?? null;
  const poolList = (pool?.reviewers ?? []).filter((rev) => rev.status !== "declined");
  const candidatesFor = (r: PrRow): AssignCandidate[] => rankReviewersFor(r, poolList, all, maxLoad).map((c) => ({ rev: c.rev, load: c.load, conflict: c.conflict || null, full: c.full }));
  const dueDefault = newAssignmentDue(settings, board.deadline);
  const assignOne = async (r: PrRow, rev: PoolReviewer, due: string) => {
    setBusy(true);
    try {
      const svc = await getChairService();
      const given = await svc.assignPapers(rev, [r.paper.dbId], due);
      let mail: string | null = null;
      if (rev.userId) for (const id of given) { mail = (await sendActionEmails("reviews_assigned", { submissionId: id, reviewerIds: [rev.userId] })) ?? mail; }
      setAssignFor(null);
      keep([r.paper.dbId]);
      setToast({ title: "Reviewer assigned", text: `${rev.name} · ${r.paper.id} · review due ${day(due)}. They're emailed to accept the paper.${mail ? ` ${mail}` : ""}` });
      reload();
    } catch (e) { setToast({ title: "Couldn't assign the reviewer", text: e instanceof Error ? e.message : "Something went wrong." }); } finally { setBusy(false); }
  };
  const addReviewers = async (r: PrRow, picks: AddPick[], due: string) => {
    setBusy(true); setAddError("");
    try {
      const { names, count, mail } = await addReviewersToPaper(slug, r.paper.dbId, picks, due);
      setAddFor(null);
      keep([r.paper.dbId]);
      setToast({ title: names.length > 1 ? `${names.length} reviewers assigned` : "Reviewer assigned", text: `${names.join(", ")} · ${r.paper.id} · review due ${day(due)}.${count === 0 ? " Already on the paper." : ""}${mail ? ` ${mail}` : ""}` });
      reload();
    } catch (e) { setAddError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const mailAssigned = async (rev: PoolReviewer, given: string[]) => { let mail: string | null = null; if (rev.userId) for (const id of given) { mail = (await sendActionEmails("reviews_assigned", { submissionId: id, reviewerIds: [rev.userId] })) ?? mail; } return mail; };
  const bulkSame = async (ids: string[], due: string) => {
    setBusy(true); setBulkError("");
    try {
      const svc = await getChairService();
      let made = 0; let skipped = 0; let problem: string | null = null;
      for (const rev of poolList.filter((x) => ids.includes(x.memberId))) {
        // As in the prototype, every selected paper gets the reviewers; one is skipped only where the reviewer is in conflict or is already on the paper.
        const eligible = selectedRows.filter((r) => !isOnPaper(rev, r) && !reviewerConflict(rev, r.paper));
        skipped += selectedRows.length - eligible.length;
        if (!eligible.length) continue;
        const given = await svc.assignPapers(rev, eligible.map((r) => r.paper.dbId), due);
        made += given.length;
        problem = (await mailAssigned(rev, given)) ?? problem;
      }
      keep(selectedRows.map((r) => r.paper.dbId));
      setBulk(null); setSelected([]);
      setToast({ title: `${made} assignment${made === 1 ? "" : "s"} made`, text: `Conflicts of interest were skipped automatically.${skipped && made === 0 ? " Nothing could be assigned to the selected papers." : ""}${problem ? ` ${problem}` : ""}` });
      reload();
    } catch (e) { setBulkError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const bulkAuto = async (plan: PlanItem[], due: string) => {
    setBusy(true); setBulkError("");
    try {
      const svc = await getChairService();
      const byReviewer = new Map<string, { rev: PoolReviewer; ids: string[] }>();
      plan.forEach((x) => x.reviewers.forEach((rev) => { const e = byReviewer.get(rev.memberId) ?? { rev, ids: [] }; e.ids.push(x.row.paper.dbId); byReviewer.set(rev.memberId, e); }));
      let made = 0; let problem: string | null = null;
      for (const { rev, ids } of byReviewer.values()) { const given = await svc.assignPapers(rev, ids, due); made += given.length; problem = (await mailAssigned(rev, given)) ?? problem; }
      keep(plan.filter((x) => x.reviewers.length).map((x) => x.row.paper.dbId));
      setBulk(null); setSelected([]);
      setToast({ title: `${made} assignment${made === 1 ? "" : "s"} made`, text: `${plan.filter((x) => x.reviewers.length).length} papers · ${byReviewer.size} reviewer${byReviewer.size === 1 ? "" : "s"} emailed.${problem ? ` ${problem}` : ""}` });
      reload();
    } catch (e) { setBulkError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  const bulkDecide = async (type: DecisionType) => {
    setBusy(true); setBulkError("");
    try {
      const svc = await getChairService();
      let ok = 0; const failed: string[] = [];
      for (const r of selectedRows) { try { await svc.recordDecision(r.paper.dbId, type.id, ""); ok += 1; } catch { failed.push(r.paper.id); } }
      keep(selectedRows.map((r) => r.paper.dbId));
      if (failed.length === selectedRows.length) { setBulkError(`Couldn't record the decision for ${failed.slice(0, 4).join(", ")}${failed.length > 4 ? "…" : ""}.`); return; }
      setBulk(null); setSelected([]);
      setToast({ title: "Decisions updated", text: `${ok} paper${ok === 1 ? "" : "s"} set to “${type.label}”.${failed.length ? ` ${failed.length} could not be changed (${failed.slice(0, 4).join(", ")}).` : ""}` });
      reload();
    } catch (e) { setBulkError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  // A reminder goes to a reviewer who is overdue, hasn't accepted the paper, or hasn't accepted the committee invitation. It is the email event "reviewer_reminder",
  // which the email server does not have yet: until it does, the server's refusal comes back as the notice below and nothing is marked as reminded.
  const canRemind = (x: PrRow["reviewers"][number]) => x.state === "overdue" || x.state === "waiting" || x.state === "invite";
  const remindMany = async (targets: Array<{ row: PrRow; x: PrRow["reviewers"][number] }>) => {
    const todo = targets.filter((t) => !reminded.includes(t.x.r.assignmentId));
    if (!todo.length) return;
    setBusy(true);
    let notice: string | null = null; const ok: string[] = [];
    for (const t of todo) {
      const mail = await sendActionEmails("reviewer_reminder", { submissionId: t.row.paper.dbId, assignmentId: t.x.r.assignmentId });
      if (mail) notice = mail; else ok.push(t.x.r.assignmentId);
    }
    setBusy(false);
    if (ok.length) setReminded((l) => [...new Set([...l, ...ok])]);
    const names = [...new Set(todo.filter((t) => ok.includes(t.x.r.assignmentId)).map((t) => t.x.r.name))];
    const papers = [...new Set(todo.map((t) => t.row.paper.id))];
    if (!ok.length) setToast({ title: "Reminder not sent", text: notice ?? "Something went wrong." });
    else setToast({ title: `Reminder sent to ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3} more` : ""}`, text: `${papers.length === 1 ? papers[0] : `${papers.length} papers`} · review reminder emailed.${notice ? ` ${notice}` : ""}` });
  };
  const overdueReviews = inTrack.filter((r) => !r.decided).flatMap((r) => r.reviewers.filter((x) => x.state === "overdue").map((x) => ({ row: r, x })));
  const overdueToRemind = overdueReviews.filter((t) => !reminded.includes(t.x.r.assignmentId));
  const askingForTime = inTrack.filter((r) => !r.decided && r.extensions > 0).length;
  const remindTargets = (list: PrRow[]) => list.flatMap((r) => (r.decided ? [] : r.reviewers.filter(canRemind).map((x) => ({ row: r, x }))));
  const assignHint = (r: PrRow) => (isShort(r) && r.canAssign && !r.decided ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); setAssignFor({ id: r.paper.dbId, rect: e.currentTarget.getBoundingClientRect() }); }} className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-primary hover:underline"><UserPlus size={12} aria-hidden="true" /> {r.declined.length ? "Find replacement" : "Assign"}</button>
  ) : r.canAssign && !r.decided && r.reviewers.length > 0 ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); setAssignFor({ id: r.paper.dbId, rect: e.currentTarget.getBoundingClientRect() }); }} className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-primary hover:underline"><UserPlus size={12} aria-hidden="true" /> Add reviewer</button>
  ) : !r.decided && r.stage === "plagiarism" ? (
    <span title="Reviewers are assigned only after the plagiarism check" className="mt-1.5 block text-[11px] text-ink-faint">Assign after plagiarism check</span>
  ) : null);
  const assignRow = assignFor ? all.find((x) => x.paper.dbId === assignFor.id) : undefined;

  const th = (label: string, o: { sortKey?: SortKey; filter?: ReactNode; className?: string; style?: CSSProperties } = {}) => {
    const on = o.sortKey && sort.key === o.sortKey;
    const Icon = on ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th style={o.style} aria-sort={o.sortKey ? (on ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined} className={`sticky top-0 z-10 bg-[#F8FAFC] px-2.5 pb-2 pt-2.5 text-left align-top text-ink-muted shadow-[inset_0_-1px_0_var(--border)] ${o.className ?? ""}`}>
        <div className="mb-1.5 flex items-center gap-1 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wider">
          {o.sortKey ? <button type="button" onClick={() => toggleSort(o.sortKey!)} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider hover:text-navy ${on ? "text-navy" : ""}`}>{label} <Icon size={12} className={on ? "" : "opacity-40"} aria-hidden="true" /></button> : label}
        </div>
        {o.filter ?? <div className="h-7" />}
      </th>
    );
  };

  const reviewDays = board.deadline ? daysUntil(board.deadline) : null;
  const dueBadge = reviewDays == null ? null
    : reviewDays < 0 ? { text: `Review deadline passed ${day(board.deadline)}`, tone: "danger" as const }
      : { text: reviewDays === 0 ? "Reviews due today" : `Reviews due ${day(board.deadline)} · ${reviewDays} day${reviewDays === 1 ? "" : "s"} left`, tone: reviewDays === 0 ? ("danger" as const) : reviewDays <= 14 ? ("warning" as const) : ("primary" as const) };

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="peer-review/list" screening={data.screening}>
      <PageHeader title="Peer Review" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page space-y-5 p-8">
        <div className="flex flex-wrap items-center gap-3">
          {dueBadge && <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${dueBadge.tone === "danger" ? "bg-danger-soft text-danger" : dueBadge.tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary"}`}><Clock size={13} aria-hidden="true" /> {dueBadge.text}</span>}
          <span className="text-xs text-ink-faint">Target {board.target} reviewers per paper · {settings?.limits.maxPapersPerReviewer ? `up to ${settings.limits.maxPapersPerReviewer} papers each` : "no limit on papers per reviewer"} · <Link href={`/chair/${slug}/settings/review`} className="font-semibold text-primary hover:underline">Change</Link></span>
        </div>
        {settings && <ReviewTimelineStrip slug={slug} timeline={settings.timeline} onSaved={reload} />}

        <div role="group" aria-label="Filter by job" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {PR_FILTERS.filter((x) => !x.hidden).map((x) => {
            const on = filter === x.key || PR_FILTERS.find((y) => y.key === filter)?.parent === x.key;
            const list = inTrack.filter(x.match);
            const chips = (x.chips ?? []).map((c) => ({ ...c, n: list.filter(c.test).length })).filter((c) => c.n > 0);
            const Icon = ICONS[x.key];
            return (
              <div key={x.key} style={{ border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary-soft)" : "#FFFFFF", boxShadow: on ? "0 0 0 3px rgba(124,58,237,0.12)" : "var(--shadow-card)" }} className="flex min-h-[118px] flex-col gap-3 rounded-2xl p-4 transition-colors">
                <button type="button" onClick={() => setFilter(x.key)} aria-pressed={filter === x.key} className="group text-left">
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${on ? "text-primary" : "text-ink-muted"}`}><Icon size={13} aria-hidden="true" /> {x.label}</div>
                  <div className="mt-2 text-[26px] font-extrabold leading-none tabular-nums text-navy transition-colors group-hover:text-primary"><AnimatedNumber value={list.length} /></div>
                </button>
                {chips.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {chips.map((c) => {
                      const t = TONES[c.tone]; const chipOn = filter === c.filter;
                      return (
                        <button key={c.filter} type="button" aria-pressed={chipOn} onClick={() => setFilter(chipOn ? x.key : c.filter)} title={chipOn ? "Show the whole bucket again" : "Show only these papers"} style={{ color: t.color, background: chipOn ? "#FFFFFF" : t.bg, border: `1px solid ${chipOn ? t.color : t.border}` }} className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold hover:brightness-95">
                          <span className="tabular-nums">{c.n}</span> {c.text}{chipOn && <X size={11} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tracks.length > 1 && (
            <select value={tracks.includes(track) ? track : "all"} onChange={(e) => setTrack(e.target.value)} aria-label="Track" className="h-9 max-w-[200px] cursor-pointer rounded-lg border border-line bg-white px-2.5 text-xs font-bold text-ink-soft outline-none">
              <option value="all">All tracks</option>
              {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <Link href={`/chair/${encodeURIComponent(conference.id)}/peer-review/manage?tab=reviews`} title="Every review as a row — scores per criterion, filter by reviewer, export CSV" className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft hover:bg-canvas"><Download size={13} aria-hidden="true" /> All reviews &amp; export</Link>
          <div className="relative">
            <button type="button" onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft hover:bg-canvas">
              Columns{extraCols.length ? ` (+${extraCols.length})` : ""} <ChevronDown size={13} aria-hidden="true" />
            </button>
            {colsOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setColsOpen(false)} aria-hidden="true" />
                <div style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px rgba(11,16,32,0.12)" }} className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl bg-white p-2">
                  <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">More columns</div>
                  {OPTIONAL_COLUMNS.map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink hover:bg-canvas">
                      <input className="cursor-pointer accent-primary" type="checkbox" checked={show(c.key)} onChange={() => setExtraCols((l) => (l.includes(c.key) ? l.filter((k) => k !== c.key) : [...l, c.key]))} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          {filtersOn && (
            <>
              <span className="text-xs text-ink-muted"><b className="text-navy">{rows.length}</b> paper{rows.length === 1 ? "" : "s"} match</span>
              <button type="button" onClick={clear} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink-soft hover:text-primary"><X size={13} aria-hidden="true" /> Clear filters</button>
            </>
          )}
        </div>

        {["waiting", "overdue", "extensions"].includes(filter) && (overdueReviews.length > 0 || askingForTime > 0) && (
          <div style={{ background: "var(--danger-soft)", border: "1px solid var(--border)" }} className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
            <Bell size={16} aria-hidden="true" className="shrink-0 text-danger" />
            <div className="min-w-0 flex-1 text-[13px] text-ink-soft">
              {overdueReviews.length > 0 && <><b className="text-navy">{overdueReviews.length} review{overdueReviews.length === 1 ? " is" : "s are"} overdue.</b>{" "}</>}
              {askingForTime > 0 && <>{askingForTime} paper{askingForTime === 1 ? " has a reviewer" : "s have reviewers"} asking for more time — open the paper to approve or decline.</>}
            </div>
            {overdueReviews.length > 0 && <button type="button" disabled={!overdueToRemind.length || busy} onClick={() => void remindMany(overdueToRemind)} title={overdueToRemind.length ? "One reminder email to each overdue reviewer" : "Every overdue reviewer was already reminded"} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white enabled:hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              <Bell size={13} aria-hidden="true" /> {overdueToRemind.length ? `Send reminder to ${overdueToRemind.length} overdue reviewer${overdueToRemind.length === 1 ? "" : "s"}` : "All reminded"}
            </button>}
          </div>
        )}

        {filter === "ready" && readyRows.length > 0 && (
          <div style={CARD} className="rounded-xl bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[13px] font-bold text-navy">Score cut-offs</span>
              {([["reject", "Reject below"], ["accept", "Accept from"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[13px] text-ink-soft">
                  {label}
                  <input type="number" min={1} max={5} step={0.1} value={cut[key]} onChange={(e) => setCutAt(key, e.target.value)} aria-label={`${label} (average score)`} className="h-8 w-16 rounded-lg border border-line px-2 text-[13px] font-bold tabular-nums text-navy outline-none focus:border-primary" />
                </label>
              ))}
              {rateLow != null && (
                <span className="ml-auto text-[13px] text-ink-soft">
                  Acceptance rate <b className="tabular-nums text-navy">{rateLow}%</b>
                  {rateHigh !== rateLow && <span className="text-ink-faint"> · up to {rateHigh}% if you accept the ones in the middle</span>}
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {([
                { key: "reject", label: "Reject", range: `below ${cut.reject}`, color: "var(--danger)", bg: "var(--danger-soft)" },
                { key: "borderline", label: "Decide yourself", range: `${cut.reject} – ${cut.accept}`, color: "#B45309", bg: "var(--warning-soft)" },
                { key: "accept", label: "Accept", range: `${cut.accept} and above`, color: "#15803D", bg: "var(--success-soft)" },
              ] as const).map((b) => {
                const list = bands[b.key];
                return (
                  <div key={b.key} style={{ background: b.bg, flexGrow: Math.max(list.length, 0.6), flexBasis: 0 }} className="flex min-w-[150px] items-center gap-2 rounded-lg px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div style={{ color: b.color }} className="text-[13px] font-bold"><span className="text-base tabular-nums">{list.length}</span> {b.label}</div>
                      <div className="truncate text-[11px] text-ink-muted">{b.range}</div>
                    </div>
                    {/* Reject / accept: select them for Edit decisions. The middle ones are opened one by one. */}
                    {b.key !== "borderline" && list.length > 0 && (
                      <button type="button" onClick={() => setSelected(list.map((r) => r.paper.dbId))} title="Select them, then use Edit decisions" style={{ border: `1px solid ${b.color}`, color: b.color }} className="h-7 shrink-0 cursor-pointer rounded-md bg-white px-2.5 text-[11px] font-bold">Select</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(filter === "unsent" || filter === "decided") && unsent.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-warning-soft px-4 py-3">
            <Mail size={16} aria-hidden="true" className="shrink-0 text-warning" />
            <div className="min-w-0 flex-1 text-[13px] text-ink-soft"><b className="text-navy">{unsent.length} decision{unsent.length === 1 ? "" : "s"} not sent to the authors yet.</b> Authors get the decision and the reviewer comments you shared.</div>
            <Button size="sm" onClick={() => setNotifyOpen(true)} disabled={busy}><Send size={13} aria-hidden="true" /> Notify {unsent.length} author{unsent.length === 1 ? "" : "s"}</Button>
          </div>
        )}

        {selected.length > 0 && (
          <div style={{ background: "var(--navy)" }} className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 text-white">
            <span className="mr-2 text-[13px] font-bold">{selected.length} selected</span>
            <button type="button" onClick={() => { setBulkError(""); setBulk("auto"); }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20"><Sparkles size={13} aria-hidden="true" /> Auto-assign</button>
            <button type="button" onClick={() => { setBulkError(""); setBulk("same"); }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20"><UserPlus size={13} aria-hidden="true" /> Assign same reviewers</button>
            {remindTargets(selectedRows).length > 0 && <button type="button" disabled={busy} onClick={() => void remindMany(remindTargets(selectedRows))} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20 disabled:opacity-50"><Bell size={13} aria-hidden="true" /> Send reminder</button>}
            <button type="button" onClick={() => { setBulkError(""); setBulk("decide"); }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-bold hover:bg-white/20"><Check size={13} aria-hidden="true" /> Edit decisions</button>
            <button type="button" onClick={() => setSelected([])} className="ml-auto h-8 cursor-pointer rounded-lg px-2.5 text-xs font-semibold hover:bg-white/10">Clear</button>
          </div>
        )}
        <div style={{ ...CARD, maxHeight: "calc(100vh - 190px)", minHeight: 360 }} className="overflow-auto rounded-2xl bg-white">
          <table className="ui-table w-full border-separate border-spacing-0 text-[13px] [&_tbody_td]:border-b [&_tbody_td]:border-muted">
            <thead>
              <tr>
                {th("", { className: "w-10", filter: <div className="flex h-7 items-center justify-center"><input className="cursor-pointer accent-primary" type="checkbox" aria-label="Select all shown" checked={allShownSelected} onChange={() => setSelected(allShownSelected ? selected.filter((id) => !rows.some((r) => r.paper.dbId === id)) : [...new Set([...selected, ...rows.map((r) => r.paper.dbId)])])} /></div> })}
                {th("ID", { sortKey: "id", className: "min-w-[100px]", filter: <input value={f.id} onChange={(e) => set("id")(e.target.value)} placeholder="Search ID" aria-label="Search ID" className={`${FCTL} px-2 font-medium`} /> })}
                {th("Title", { className: "min-w-[200px]", filter: <input value={f.title} onChange={(e) => set("title")(e.target.value)} placeholder="Search title or track" aria-label="Search title or track" className={`${FCTL} px-2 font-medium`} /> })}
                {th("Status", { className: "min-w-[135px]", filter: <Select label="Status" value={filter} onChange={setFilter} options={statusOpts} /> })}
                {icOn && th("Initial check", { className: "min-w-[115px]", filter: <Select label="Initial check" {...screenFilter(true)} /> })}
                {plOn && th("Plagiarism", { className: "min-w-[115px]", filter: <Select label="Plagiarism check" {...screenFilter(false)} /> })}
                {th("Reviewer", { className: "min-w-[160px]", filter: <Select label="Reviewers" value={f.reviewers} onChange={set("reviewers")} options={REVIEWER_OPTS} /> })}
                {th("Review", { className: "min-w-[100px]" })}
                {th("Due", { sortKey: "due", className: "min-w-[110px]", filter: <Select label="Due" value={f.due} onChange={set("due")} options={DUE_OPTS} /> })}
                {th("Score", { sortKey: "avg", className: "min-w-[120px]", filter: <Select label="Score" value={f.score} onChange={set("score")} options={SCORE_OPTS} /> })}
                {th("Decision", { className: "min-w-[150px]", style: { right: 0, zIndex: 12, borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 12px -10px rgba(11,16,32,0.25), inset 0 -1px 0 var(--border)" }, filter: <Select label="Decision" value={f.decision} onChange={set("decision")} options={[["all", "All"], ["undecided", "Undecided"], ...decTypes.map((t): [string, string] => [t.id, t.label])]} /> })}
                {show("plagiarism") && th("Plagiarism %", { className: "text-center" })}
                {show("confidence") && th("Confidence", { className: "text-center" })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => {
                const st = PR_STAGES[r.stage];
                const cur = typeOf(r);
                const canDecide = r.decided || (r.canAssign && r.reviewers.length > 0);
                const value = cur ? cur.id : r.decided ? "decided" : "pending";
                const color = cur?.color ?? "var(--ink-soft)";
                const reason = r.stage === "plagiarism" ? "After plagiarism check" : r.stage === "upload" ? "Upload pending" : "Assign reviewers first";
                const pendingReviews = r.reviewers.length - r.reviewsIn;
                return (
                  <tr key={r.paper.dbId} {...pick.row(r.paper.dbId)} onClick={(e) => openPaper(e, r)} style={filter === "ready" ? { boxShadow: `inset 3px 0 0 ${BAND_EDGE[bandOf(r)]}` } : undefined} className={`cursor-pointer align-top transition-colors hover:bg-canvas ${ri % 2 ? "ui-row-alt" : ""}`}>
                    <td data-nav-stop className="py-3 pl-4 pr-1"><input className="cursor-pointer accent-primary" type="checkbox" aria-label={`Select ${r.paper.id}`} checked={selected.includes(r.paper.dbId)} {...pick.box(r.paper.dbId)} /></td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink-muted">{r.paper.id}</td>
                    <td className="px-3 py-3">
                      <Link href={`/submissions/${encodeURIComponent(r.paper.id)}/chair/review`} onClick={rememberQueue} title={r.paper.title} className="line-clamp-2 max-w-[420px] font-semibold leading-snug text-navy hover:text-primary">{r.paper.title}</Link>
                      {r.paper.track && <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-bold text-ink-soft">{r.paper.track}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span style={{ background: st.bg, color: st.color }} className="whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold">{st.label}</span>
                      {!r.decided && r.reviewers.length > 0 && <div className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-ink-muted">{r.reviewsIn} of {r.reviewers.length} review{r.reviewers.length === 1 ? "" : "s"} in</div>}
                      {!r.decided && r.reviewers.length > 0 && <div className="mt-1.5 flex gap-[3px]" aria-hidden="true">{r.reviewers.map((x) => <span key={x.r.assignmentId} title={`${x.r.name} — ${REVIEWER_STATE[x.state].label}`} style={{ background: REVIEWER_STATE[x.state].color }} className="h-[5px] w-[22px] rounded-full" />)}</div>}
                      {keptIds.includes(r.paper.dbId) && !active.match(r) && <span title="Done here — it leaves this list when you change the filter or reopen the page" className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-success"><Check size={12} strokeWidth={3} aria-hidden="true" /> Done</span>}
                    </td>
                    {([
                      { on: icOn, value: scOf(r).initial ?? "pending", list: CHECK_DECISIONS, page: "initial-check", cta: "Open Initial check", done: "passed", key: "ic" },
                      { on: plOn, value: scOf(r).plag ?? "pending", list: PLAG_DECISIONS, page: "plagiarism", cta: "Open Plagiarism", done: "clear", key: "pl" },
                    ] as const).filter((c) => c.on).map((c) => {
                      const m = screeningMeta([...c.list], c.value);
                      return (
                        <td key={c.key} className="whitespace-nowrap px-3 py-3">
                          <span style={{ background: m.bg, color: m.color }} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold">
                            {c.value === c.done && <Check size={11} strokeWidth={3} aria-hidden="true" />} {c.value === "pending" ? "Not decided" : m.label}
                          </span>
                          {c.value !== c.done && c.value !== "waiting" && !r.decided && (
                            <button type="button" onClick={() => (c.value !== "pending" ? setReportFor(r.paper) : router.push(`/chair/${encodeURIComponent(conference.id)}/${c.page}`))} className="mt-1.5 block cursor-pointer text-[11px] font-bold text-primary hover:underline">{c.value !== "pending" ? "View report" : c.cta}</button>
                          )}
                        </td>
                      );
                    })}
                    <td data-nav-stop className="min-w-[170px] px-3 py-2.5">
                      {r.reviewers.length === 0 && declinedShown(r).length === 0 ? <span className="text-xs font-semibold text-ink-muted">0 assigned</span> : (
                        <Lines r={r} cell={(x) => (<><span title={`${x.r.name} — ${REVIEWER_STATE[x.state].label}`} style={{ color: REVIEWER_STATE[x.state].color, boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 3px ${REVIEWER_STATE[x.state].color}` }} className="ml-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[9.5px] font-bold">{initials(x.r.name)}</span><span className="max-w-[140px] truncate text-[13px] font-semibold text-navy">{x.r.name}</span></>)} />
                      )}
                    {assignHint(r)}</td>
                    <td className="px-3 py-2.5"><Lines r={r} cell={(x) => <span title={REVIEWER_STATE[x.state].label} style={{ color: REVIEWER_STATE[x.state].color, background: `color-mix(in srgb, ${REVIEWER_STATE[x.state].color} 12%, white)` }} className="rounded-full px-2 py-0.5 text-[11px] font-bold">{REVIEWER_STATE[x.state].word}</span>} /></td>
                    <td data-nav-stop className="px-3 py-2.5"><Lines r={r} cell={(x) => <><span className={`text-xs font-bold ${x.lateDays ? "text-danger" : x.r.review ? "text-ink-faint" : "text-ink"}`}>{x.r.due ? day(x.r.due) : "—"}</span>{x.lateDays > 0 && <span className="text-[11px] text-danger">{x.lateDays}d late</span>}{!r.decided && canRemind(x) && (reminded.includes(x.r.assignmentId)
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-faint"><Check size={11} aria-hidden="true" /> Reminded</span>
                      : <button type="button" disabled={busy} onClick={() => void remindMany([{ row: r, x }])} className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline disabled:opacity-50"><Bell size={11} aria-hidden="true" /> Send reminder</button>)}</>} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Lines r={r} cell={(x) => (x.r.review?.score ? <><span className="text-[13px] font-extrabold text-navy">{x.r.review.score}<span className="text-[10.5px] font-semibold text-ink-faint">/5</span></span>{typeof x.r.review.answers["f-decision"] === "string" && <span className="text-[11px] text-ink-muted">{String(x.r.review.answers["f-decision"])}</span>}</> : <span className="text-line-strong">—</span>)} />
                      {r.reviewers.length > 0 && (
                        <div className={`${LINE} mt-0.5 border-t border-line`}>
                          {r.avg != null ? <><span className="text-[13px] font-extrabold text-navy">Avg {r.avg}<span className="text-[10.5px] font-semibold text-ink-faint">/5</span></span>{r.split && <span title="Reviewers disagree — a recommendation split or a score gap of 2+" className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[10.5px] font-bold text-warning">Split</span>}</> : <span className="text-[11px] text-ink-faint">No scores yet</span>}
                        </div>
                      )}
                    </td>
                    <td data-nav-stop style={STICKY_DECISION} className="px-3 py-3">
                      <div className="min-w-[132px]">
                        <select value={value} disabled={!canDecide || busy} aria-label={`Decision for ${r.paper.id}`} title={canDecide ? undefined : reason} onChange={(e) => void decide(r, e.target.value)}
                          style={{ color: `color-mix(in srgb, ${color} 78%, #000000)`, background: cur ? `${cur.color}1A` : "var(--muted)", border: `1.5px solid ${value === "pending" ? "var(--border)" : "transparent"}` }}
                          className="h-8 w-full cursor-pointer rounded-md pl-2 pr-6 text-xs font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60">
                          <option value="pending">No Decision</option>
                          {decTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          {cur && !decTypes.some((t) => t.id === cur.id) && <option value={cur.id} disabled>{cur.label}</option>}
                          {r.decided && !cur && <option value="decided" disabled>{OUTCOME_LABEL[r.paper.outcome] ?? r.paper.outcome}</option>}
                        </select>
                        {!canDecide && <div className="mt-1 text-[11px] text-ink-faint">{reason}</div>}
                        {canDecide && !r.decided && (r.stage === "ready" ? <div className="mt-1 text-[11px] font-semibold text-success">All reviews in</div> : pendingReviews > 0 && <div className="mt-1 text-[11px] font-semibold text-warning">{pendingReviews} review{pendingReviews === 1 ? "" : "s"} still pending</div>)}
                        {r.unsent && <div className="mt-1 text-[11px] font-semibold text-warning">Not sent to authors</div>}
                      </div>
                    </td>
                    {show("plagiarism") && (
                      <td className="px-3 py-3 text-center">
                        {similarityOf(r) === null ? <span className="text-line-strong">—</span> : (
                          <span style={{ color: similarityOf(r)! > similarityLimit ? (plCleared(r) ? "#B45309" : "var(--danger)") : "var(--ink-soft)" }} className="text-xs font-bold tabular-nums">{similarityOf(r)}%</span>
                        )}
                        {plCleared(r) && similarityOf(r) !== null && similarityOf(r)! > similarityLimit && <div className="text-[10px] text-ink-faint">cleared</div>}
                      </td>
                    )}
                    {show("confidence") && <td className="px-3 py-3 text-center text-xs font-semibold text-ink-soft">{confidenceOf(r) == null ? "—" : confidenceOf(r)! >= 2.5 ? "High" : confidenceOf(r)! >= 1.5 ? "Medium" : "Low"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="py-14 text-center">
              <FileCheck size={26} aria-hidden="true" className="mx-auto mb-2 text-line-strong" />
              <p className="text-sm font-semibold text-navy">{all.length ? "No papers match this view." : "No submitted papers yet."}</p>
              {all.length > 0 && <button type="button" onClick={() => { setFilter("all"); setTrack("all"); clear(); }} className="mt-1 text-sm font-bold text-primary hover:underline">Show all papers</button>}
            </div>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-[11.5px] text-ink-faint"><Info size={12} aria-hidden="true" /> Papers get reviewers once they&apos;re plagiarism clear on the Plagiarism page.</p>
      </div>

      <Dialog open={notifyOpen} onClose={() => setNotifyOpen(false)} title="Notify authors" description={`${unsent.length} decision${unsent.length === 1 ? "" : "s"} · one email to each paper’s authors`} size="md">
        <ul className="max-h-[46vh] divide-y divide-muted overflow-y-auto rounded-xl border border-line">
          {unsent.map((r) => <li key={r.paper.dbId} className="flex items-center gap-3 px-4 py-2.5"><div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-ink-muted">{r.paper.id}</div><div className="truncate text-[13px] font-semibold text-navy">{r.paper.title}</div></div><span className="shrink-0 text-[11px] font-semibold text-ink-muted">{r.reviewers.filter((x) => x.r.review?.shared).length} comment(s) shared</span><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-ink-soft">{typeOf(r)?.label ?? r.paper.outcome}</span></li>)}
        </ul>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setNotifyOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void notifyAll()} disabled={busy}><Send size={15} aria-hidden="true" /> {busy ? "Sending…" : `Send ${unsent.length} email${unsent.length === 1 ? "" : "s"}`}</Button></div>
      </Dialog>
      {assignFor && assignRow && <AssignReviewerPopover row={assignRow} candidates={candidatesFor(assignRow)} maxLoad={maxLoad} deadline={dueDefault} anchor={assignFor.rect} busy={busy} onAssign={(rev, due) => void assignOne(assignRow, rev, due)} onInvite={() => { setAddError(""); setAddFor(assignRow.paper.dbId); setAssignFor(null); }} onClose={() => setAssignFor(null)} />}
      <Dialog open={addFor !== null} onClose={() => { if (!busy) setAddFor(null); }} title="Add reviewers" size="lg">
        {addFor && (() => {
          const row = all.find((x) => x.paper.dbId === addFor);
          return row ? <AddReviewersModal key={addFor} paperLabel={`${row.paper.id} · ${row.paper.title}`} candidates={candidatesFor(row)} poolEmails={poolList.map((x) => x.email)} acronym={conference.acronym} maxLoad={maxLoad} deadline={dueDefault} busy={busy} error={addError} onAdd={(picks, due) => void addReviewers(row, picks, due)} onClose={() => setAddFor(null)} /> : null;
        })()}
      </Dialog>
      {bulk === "auto" && <AutoAssignModal rows={selectedRows.filter((r) => r.canAssign && r.reviewers.length < r.target)} all={all} scope="selected" pool={poolList} maxLoad={maxLoad} defaultDeadline={dueDefault} busy={busy} onConfirm={(plan, due) => void bulkAuto(plan, due)} onClose={() => { if (!busy) setBulk(null); }} />}
      {bulk === "same" && <AssignSameModal reviewers={poolList} submissionCount={selected.length} defaultDeadline={dueDefault} busy={busy} error={bulkError} onAssign={(ids, due) => void bulkSame(ids, due)} onClose={() => { if (!busy) setBulk(null); }} />}
      {bulk === "decide" && <EditDecisionsModal types={data.decisionTypes} papers={selectedRows.map((r) => ({ id: r.paper.id }))} currentTypeOf={(id) => { const r = selectedRows.find((x) => x.paper.id === id); return r ? (typeOf(r)?.id ?? null) : null; }} settingsHref={`/chair/${slug}/settings/decision`} busy={busy} error={bulkError} onApply={(t) => void bulkDecide(t)} onClose={() => { if (!busy) setBulk(null); }} />}
      {reportFor && <ScreeningReportModal paper={reportFor} n={reportFor.versions} criteria={data.criteria} screening={data.screening} onClose={() => setReportFor(null)} />}
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
