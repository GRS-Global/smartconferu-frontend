"use client";

import { AlertTriangle, Check, ChevronDown, ChevronsUpDown, ChevronUp, Clock, Download, Eye, FileText, Layers, Mail, Pencil, PlusCircle, ShieldCheck, Tag, Ticket, Trash2, X, XCircle, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Dialog } from "@/components/ui/dialog";
import { monogram } from "@/features/author/format";
import { ConferenceStatusPill, PageHero } from "@/features/workspace/components/hero";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getChairService } from "@/services/chair";
import { PAYMENT_LABELS, attendanceLabel, type ChairPaper, type DecisionType, type PoolReviewer } from "@/types/chair";
import { chairStageOf, type Screening } from "../stage";
import { useChairConference } from "../use-chair-conference";
import { AGE_OPTIONS, COLUMNS, COLUMN_WIDTHS, REGISTRATION_COLUMNS, REVIEW_PROGRESS_OPTIONS, SCORE_BAND_OPTIONS, ageBucket, decisionOf, presenterOf, progressOf, readColumns, readViews, registrationFilterValue, scoreBand, statusFilterValue, writeColumns, writeViews, type SavedView } from "../submission-columns";
import { ColumnsPanel } from "./submissions-columns-panel";
import { AssignReviewersDialog, ContactDialog, EditDecisionsDialog, EditTrackDialog } from "./submissions-bulk-dialogs";
import { chairPaperHref } from "@/lib/routes";

/* The chair's Submissions page (the prototype's ChairSubmissionsPage + SubmissionsListPanel, chair role): the stage cards (which are
   also the filter), saved views, the Columns picker, the list of submitted papers with a search box or a dropdown under the column
   titles that have one and a sort arrow on ID, Submitted on, Last update, Review progress and Average score, row selection with the
   bulk bar (Contact, Assign reviewers, Edit decisions, Edit track, Delete) and a delete icon on every row. Not offered: "Add to
   sessions" (the database holds no programme sessions). Opening a paper goes to the paper's chair page. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
type QuickKey = "all" | "initial" | "plagiarism" | "review" | "decision" | "registration" | "withdrawn";
const STAT_CARDS: Array<{ key: QuickKey; label: string; icon: LucideIcon; color: string }> = [
  { key: "all", label: "Submitted", icon: FileText, color: "var(--navy)" },
  { key: "initial", label: "Initial check", icon: ShieldCheck, color: "var(--primary)" },
  { key: "plagiarism", label: "Plagiarism check", icon: ShieldCheck, color: "#0369A1" },
  { key: "review", label: "Review", icon: Clock, color: "var(--warning-ink)" },
  { key: "decision", label: "Decision", icon: Check, color: "#7C3AED" },
  { key: "registration", label: "Registration", icon: Ticket, color: "var(--success-ink)" },
  { key: "withdrawn", label: "Withdrawn", icon: XCircle, color: "var(--danger-ink)" },
];

const dateValue = (text: string | null) => { const t = Date.parse(text || ""); return Number.isNaN(t) ? null : t; };
const compareIds = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const SORT_FIRST_DIR: Record<string, "asc" | "desc"> = { id: "asc", updatedAt: "desc", reviewProgress: "desc", avgScore: "desc" };
const SORTS: Record<string, (p: ChairPaper) => string | number | null> = {
  id: (p) => p.id, submittedAt: (p) => dateValue(p.submittedAt), updatedAt: (p) => dateValue(p.lastUpdate),
  reviewProgress: (p) => (p.reviewersAssigned ? p.reviewsReceived / p.reviewersAssigned : null), avgScore: (p) => p.averageScore,
};
const FCTL = "h-7 w-full rounded-md border-[1.5px] border-line bg-white text-[11px] normal-case tracking-normal outline-none focus:border-primary";
type Opt = [string, string, boolean?];
const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** One CSV cell. A value an author typed that starts like a formula (=, +, -, @) gets a leading ' so Excel shows it as text. */
const FORMULA_START = /^[=+\-@\t\r]/;
const csvCell = (v: unknown) => { const s = String(v ?? ""); return `"${(FORMULA_START.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
const BOM = String.fromCharCode(0xfeff);
const CRLF = String.fromCharCode(13, 10);
/** The registration counts above the list on the Registration stage; each one is also a filter. */
const REG_CHIPS: Array<{ key: "payment" | "attendance"; value: string }> = [
  { key: "payment", value: "Paid" }, { key: "payment", value: "Waived" }, { key: "payment", value: "Not paid" },
  { key: "attendance", value: "Physical" }, { key: "attendance", value: "Virtual" }, { key: "attendance", value: "Not known" },
];

export function ChairSubmissionsPage({ slug }: { slug: string }) {
  const { state, retry, reload } = useChairConference(slug, { board: true, pool: true });
  const router = useRouter();
  const [quick, setQuick] = useState<QuickKey>("all");
  const [colFilters, setColFilters] = useState<Record<string, string>>({}); // column key → what the filter under its title is set to
  const [sort, setSort] = useState<{ key: string | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const [selected, setSelected] = useState<string[]>([]); // the papers ticked (database ids)
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => readColumns(slug));
  const [showColumns, setShowColumns] = useState(false);
  const [views, setViews] = useState<SavedView[]>(() => readViews(slug));
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<"contact" | "assign" | "decisions" | "track" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const gate = workspaceGate(state, retry, { title: "Submissions", loadingLabel: "Loading the submissions", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the submissions." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, data, board, pool } = state;
  const screening: Screening = data.screening;
  const ctx = { data, screening, board };
  const stageOf = (p: ChairPaper) => chairStageOf(p, screening);
  const matchQuick = (p: ChairPaper, k: QuickKey) => (k === "all" ? true : k === "withdrawn" ? p.withdrawn : stageOf(p).key === k);
  const inStage = data.papers.filter((p) => matchQuick(p, quick));
  // On the Registration stage the payment, attendance and presenter columns are always shown.
  const shownKeys = quick === "registration" ? [...visibleKeys, ...REGISTRATION_COLUMNS.filter((k) => !visibleKeys.includes(k))] : visibleKeys;
  const shownColumns = shownKeys.map((k) => COLUMNS.find((c) => c.key === k)).filter((c): c is (typeof COLUMNS)[number] => Boolean(c));

  /* The filters under the column titles: a search box (id, title) or a dropdown that lists what the stage's papers hold. */
  const getters: Record<string, (p: ChairPaper) => string> = {
    track: (p) => p.track || "", type: (p) => p.presentationType || "", status: (p) => statusFilterValue(p, screening), decision: (p) => decisionOf(p, data)?.label ?? "Pending",
    ...registrationFilterValue,
  };
  const fixedOptions: Record<string, Array<[string, string]>> = { submittedAt: AGE_OPTIONS, updatedAt: AGE_OPTIONS, reviewProgress: REVIEW_PROGRESS_OPTIONS, avgScore: SCORE_BAND_OPTIONS };
  const fixedTests: Record<string, (p: ChairPaper, v: string) => boolean> = {
    submittedAt: (p, v) => ageBucket(p.submittedAt ?? "") === v, updatedAt: (p, v) => ageBucket(p.lastUpdate) === v, reviewProgress: (p, v) => progressOf(p) === v, avgScore: (p, v) => scoreBand(p) === v,
  };
  const selectLabels: Record<string, string> = { track: "Track", type: "Presentation type", status: "Status", submittedAt: "Submitted on", updatedAt: "Last update", reviewProgress: "Review progress", avgScore: "Average score", decision: "Decision", payment: "Payment", attendance: "Attending", presenter: "Presenter" };
  const optionsOf = (key: string): Opt[] | null => {
    if (fixedOptions[key]) return fixedOptions[key];
    const get = getters[key];
    if (!get) return null;
    const counts = new Map<string, number>();
    inStage.forEach((p) => { const v = get(p); if (v) counts.set(v, (counts.get(v) || 0) + 1); });
    const current = colFilters[key];
    if (current && current !== "all" && !counts.has(current)) counts.set(current, 0);
    return [["all", `All (${inStage.length})`], ...[...counts.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([v, n]): Opt => [v, `${v} (${n})`, n === 0 && current !== v])];
  };
  const passes = (p: ChairPaper) => Object.entries(colFilters).every(([key, value]) => {
    if (!value || value === "all") return true;
    if (key === "id") return p.id.toLowerCase().includes(value.trim().toLowerCase());
    if (key === "title") { const q = value.trim().toLowerCase(); return p.title.toLowerCase().includes(q) || p.keywords.some((k) => k.toLowerCase().includes(q)) || p.authors.some((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)); }
    if (fixedTests[key]) return fixedTests[key](p, value);
    return getters[key] ? getters[key](p) === value : true;
  });
  const matched = inStage.filter(passes);
  const filtersOn = Object.values(colFilters).some((v) => v && v !== "all" && v.trim());
  const sortedMatched = (() => {
    const get = sort.key ? SORTS[sort.key] : null;
    if (!get) return matched;
    const sign = sort.dir === "desc" ? -1 : 1;
    // A paper without a value (no score yet, no reviewers) always sorts last.
    return [...matched].sort((a, b) => { const av = get(a); const bv = get(b); if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1; return sign * (typeof av === "string" && typeof bv === "string" ? compareIds(av, bv) : Number(av) - Number(bv)); });
  })();
  // Withdrawn papers sit at the end of the list (the order is otherwise kept).
  const filtered = [...sortedMatched.filter((p) => !p.withdrawn), ...sortedMatched.filter((p) => p.withdrawn)];
  const toggleSort = (key: string) => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: SORT_FIRST_DIR[key] ?? "asc" }));
  const setFilter = (key: string, v: string) => setColFilters((f) => ({ ...f, [key]: v }));

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.includes(p.dbId));
  const toggleAll = () => setSelected((ids) => (allSelected ? ids.filter((id) => !filtered.some((p) => p.dbId === id)) : [...new Set([...ids, ...filtered.map((p) => p.dbId)])]));
  const toggleOne = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const selectedPapers = data.papers.filter((p) => selected.includes(p.dbId));

  const applyColumns = (keys: string[]) => { setVisibleKeys(keys); writeColumns(slug, keys); setShowColumns(false); setActiveViewId(null); };
  const addView = (name: string, keys: string[]) => {
    const view: SavedView = { id: `view-${Date.now()}`, name, columns: keys, filter: quick };
    const next = [...views, view];
    setViews(next); writeViews(slug, next); applyColumns(keys); setActiveViewId(view.id);
  };
  const openView = (v: SavedView) => { setVisibleKeys(v.columns); writeColumns(slug, v.columns); setQuick((STAT_CARDS.some((s) => s.key === v.filter) ? v.filter : "all") as QuickKey); setActiveViewId(v.id); };
  const removeView = (id: string) => { const next = views.filter((v) => v.id !== id); setViews(next); writeViews(slug, next); if (activeViewId === id) setActiveViewId(null); };

  const run = async (work: () => Promise<void>, done: () => void) => {
    setBusy(true); setActionError("");
    try { await work(); done(); reload(); } catch (e) { setActionError(e instanceof Error ? e.message : "That didn't work."); }
    setBusy(false);
  };
  const performDelete = (ids: string[]) => run(async () => { await (await getChairService()).deleteSubmissions(ids); }, () => { setSelected((cur) => cur.filter((id) => !ids.includes(id))); setConfirmDelete(null); });
  const closeBulk = () => { setBulk(null); setActionError(""); };
  const bulkAssign = (reviewers: PoolReviewer[], due: string) => run(async () => { const svc = await getChairService(); for (const r of reviewers) await svc.assignPapers(r, selectedPapers.map((p) => p.dbId), due); }, closeBulk);
  const bulkDecision = (type: DecisionType) => run(async () => { const svc = await getChairService(); for (const p of selectedPapers) await svc.recordDecision(p.dbId, type.id, ""); }, closeBulk);
  const bulkTrack = (track: string) => run(async () => { await (await getChairService()).setSubmissionTrack(selectedPapers.map((p) => p.dbId), track); }, closeBulk);

  const th = (key: string, label: string) => {
    const sortable = key in SORTS;
    const on = sortable && sort.key === key;
    const Icon = on ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    const w = COLUMN_WIDTHS[key];
    const options = optionsOf(key);
    let filter: ReactNode = <div className="h-7" />;
    if (key === "id" || key === "title") {
      const ph = key === "id" ? "Search ID" : "Search title or author";
      filter = <input value={colFilters[key] ?? ""} onChange={(e) => setFilter(key, e.target.value)} placeholder={ph} aria-label={key === "id" ? "Search ID" : "Search title, author or keyword"} className={`${FCTL} px-2 font-medium placeholder:font-normal placeholder:text-slate-400`} />;
    } else if (options) {
      const cur = colFilters[key] || "all";
      filter = (
        <select value={cur} onChange={(e) => setFilter(key, e.target.value)} aria-label={selectLabels[key]} style={{ color: cur === "all" ? "var(--ink-faint)" : "var(--primary)" }} className={`${FCTL} cursor-pointer px-1.5 font-semibold`}>
          {options.map(([k, l, off]) => <option key={k} value={k} disabled={off}>{l}</option>)}
        </select>
      );
    }
    return (
      <th key={key} scope="col" aria-sort={sortable ? (on ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined} style={{ color: "var(--ink-muted)", minWidth: w?.min ?? (options || key === "id" || key === "title" ? 120 : undefined), width: w?.width }} className="px-2.5 pb-2.5 pt-3 text-left align-top">
        <div className="mb-1.5 flex items-center gap-1 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wider">
          {sortable ? <button type="button" onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider hover:text-navy ${on ? "text-navy" : ""}`}>{label} <Icon size={12} aria-hidden="true" style={{ opacity: on ? 1 : 0.4 }} /></button> : label}
        </div>
        {filter}
      </th>
    );
  };
  const clearAll = () => { setColFilters({}); setQuick("all"); };
  /* The list as it is filtered now (or the ticked papers) as a CSV file: who paid and who comes, for the registration desk. */
  const exportCsv = () => {
    const rows = selected.length ? filtered.filter((p) => selected.includes(p.dbId)) : filtered;
    const header = ["Paper ID", "Title", "Track", "Presentation type", "Status", "Decision", "Payment", "Attending", "Presenter", "Presenter email", "Corresponding author", "Corresponding email", "All authors", "Payment note"];
    const body = rows.map((p) => {
      const r = p.registration;
      const corr = p.authors.find((a) => a.corresponding) ?? p.authors[0];
      return [p.id, p.title, p.track, p.presentationType, stageOf(p).status, decisionOf(p, data)?.label ?? "Pending", r ? PAYMENT_LABELS[r.payment] : "", r ? attendanceLabel(r.attendance) : "", r ? presenterOf(p) : "", r?.presenterEmail ?? "", corr?.name ?? "", corr?.email ?? "", p.authors.map((a) => a.name).join("; "), r?.note ?? ""];
    });
    // The BOM lets Excel read names with accents correctly.
    const csv = BOM + [header, ...body].map((row) => row.map(csvCell).join(",")).join(CRLF);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${(conference.acronym || "submissions").replace(/[^\w-]+/g, "-")}-${quick === "registration" ? "registrations" : "submissions"}-${ymd(new Date())}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const regBase = data.papers.filter((p) => matchQuick(p, "registration") && p.registration);
  const regCount = (key: "payment" | "attendance", value: string) => regBase.filter((p) => registrationFilterValue[key](p) === value).length;
  const emptyHint = data.papers.length === 0 ? `No papers have been submitted to ${conference.acronym} yet.` : "No submissions match your filters.";
  const bulkBtn = "flex items-center gap-1.5 text-xs font-semibold text-navy hover:underline";
  const due0 = board?.deadline || ymd(new Date(Date.now() + 28 * 86400000));
  const tracksList = pool?.tracks.length ? pool.tracks : ["General Track"];

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="submissions/list" screening={screening}>
      <PageHeader title="Submissions" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="p-8">
        <div className="mb-6">
          <PageHero
            label="Conference"
            tile={monogram(conference.acronym)}
            title={conference.acronym}
            badge={<ConferenceStatusPill conference={conference} />}
            subtitle={conference.name}
            actions={conference.status !== "archived" ? <Link href={`/chair/${encodeURIComponent(conference.id)}/submit-behalf`} className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-bold text-white transition-shadow hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]"><PlusCircle size={15} aria-hidden="true" /> Submit on behalf of an author</Link> : undefined}
          />
        </div>

        <div role="group" aria-label="Filter by stage" className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {STAT_CARDS.map((st) => {
            const Icon = st.icon;
            const value = data.papers.filter((p) => matchQuick(p, st.key)).length;
            const on = quick === st.key && !activeViewId;
            return (
              <button key={st.key} type="button" aria-pressed={on} onClick={() => { setQuick(on && st.key !== "all" ? "all" : st.key); setActiveViewId(null); }} title={on && st.key !== "all" ? "Click again to show every paper" : `Show ${st.label.toLowerCase()}`}
                style={{ border: on ? "1.5px solid var(--primary)" : "1px solid var(--border)", boxShadow: on ? "0 0 0 3px var(--primary-soft)" : "var(--shadow-card)", background: on ? "var(--primary-soft)" : "#FFFFFF" }}
                className="cursor-pointer rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary">
                <span aria-hidden="true" style={{ background: `${st.color}18`, color: st.color }} className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"><Icon size={17} strokeWidth={2.2} /></span>
                <div className="text-2xl font-bold text-navy"><AnimatedNumber value={value} /></div>
                <div style={{ color: on ? "var(--primary)" : "var(--ink-muted)" }} className="mt-0.5 text-xs font-medium">{st.label}</div>
              </button>
            );
          })}
        </div>

        {/* saved views */}
        {views.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {views.map((v) => {
              const active = activeViewId === v.id;
              return (
                <span key={v.id} style={{ background: active ? "var(--primary)" : "var(--primary-soft)", color: active ? "#FFFFFF" : "var(--primary)", border: `1px solid ${active ? "var(--primary)" : "var(--primary-soft-border)"}` }} className="flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-2 text-xs font-bold">
                  <button type="button" onClick={() => openView(v)}>{v.name}</button>
                  <button type="button" onClick={() => removeView(v.id)} aria-label={`Delete view ${v.name}`} className="opacity-60 transition-opacity hover:opacity-100"><X size={12} aria-hidden="true" /></button>
                </span>
              );
            })}
          </div>
        )}

        {/* Registration stage: who paid and how they attend; each count filters the list */}
        {quick === "registration" && !activeViewId && regBase.length > 0 && (
          <div role="group" aria-label="Filter by payment and attendance" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3">
            <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">Payment</span>
            {REG_CHIPS.map((c, i) => {
              const on = colFilters[c.key] === c.value;
              return (
                <span key={`${c.key}-${c.value}`} className="contents">
                  {i === 3 && <span className="ml-3 mr-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">Attending</span>}
                  <button type="button" aria-pressed={on} onClick={() => setFilter(c.key, on ? "all" : c.value)}
                    style={{ background: on ? "var(--primary)" : "var(--canvas)", color: on ? "#FFFFFF" : "var(--ink-soft)", border: `1px solid ${on ? "var(--primary)" : "var(--border)"}` }}
                    className="rounded-full px-3 py-1 text-xs font-bold transition-colors">{c.value} <span style={{ opacity: 0.75 }}>{regCount(c.key, c.value)}</span></button>
                </span>
              );
            })}
          </div>
        )}

        {/* what matches + columns */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-h-9 flex-wrap items-center gap-2.5">
            <span className="text-xs text-ink-muted"><b className="text-navy">{filtered.length}</b> of {data.papers.length} paper{data.papers.length === 1 ? "" : "s"}{filtersOn || quick !== "all" ? " match" : ""}</span>
            {(filtersOn || quick !== "all") && <button type="button" onClick={clearAll} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink-soft hover:text-primary"><X size={13} aria-hidden="true" /> Clear filters</button>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} disabled={filtered.length === 0} title="Download the papers listed below (or the ticked ones) as a spreadsheet" className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink-soft transition-colors hover:text-primary disabled:opacity-50"><Download size={13} aria-hidden="true" /> Export{selected.length ? ` (${selected.length})` : " CSV"}</button>
            <div className="relative">
              <button type="button" onClick={() => setShowColumns((v) => !v)} aria-expanded={showColumns} style={{ background: showColumns ? "var(--primary)" : "#FFFFFF", color: showColumns ? "#FFFFFF" : "var(--ink-soft)", border: `1px solid ${showColumns ? "var(--primary)" : "var(--border)"}` }} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors">
                <Layers size={13} aria-hidden="true" /> Columns
                <span style={{ background: showColumns ? "rgba(255,255,255,0.22)" : "var(--muted)", color: showColumns ? "#FFFFFF" : "var(--ink-muted)" }} className="rounded px-1.5 py-0.5 text-[10px]">{shownColumns.length}</span>
                {showColumns ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
              </button>
              {showColumns && <ColumnsPanel visible={visibleKeys} onApply={applyColumns} onClose={() => setShowColumns(false)} onSaveView={addView} />}
            </div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-soft-border bg-primary-soft px-4 py-3">
            <span className="shrink-0 text-sm font-semibold text-navy">{selected.length} selected</span>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => setBulk("contact")} className={bulkBtn}><Mail size={13} aria-hidden="true" /> Contact</button>
              <button type="button" onClick={() => { setActionError(""); setBulk("assign"); }} className={bulkBtn}><Eye size={13} aria-hidden="true" /> Assign reviewers</button>
              <button type="button" onClick={() => { setActionError(""); setBulk("decisions"); }} className={bulkBtn}><Pencil size={13} aria-hidden="true" /> Edit decisions</button>
              <button type="button" onClick={() => { setActionError(""); setBulk("track"); }} className={bulkBtn}><Tag size={13} aria-hidden="true" /> Edit track</button>
              <button type="button" onClick={() => { setActionError(""); setConfirmDelete([...selected]); }} className="flex items-center gap-1.5 text-xs font-semibold text-danger-ink hover:underline"><Trash2 size={13} aria-hidden="true" /> Delete</button>
              <button type="button" onClick={() => setSelected([])} className="text-xs font-semibold text-ink-muted hover:underline">Clear</button>
            </div>
          </div>
        )}

        <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border)" }}>
                  <th scope="col" className="w-9 pb-2.5 pl-4 pr-1 pt-3 text-left align-top">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all submissions" style={{ accentColor: "var(--primary)" }} className="h-4 w-4 cursor-pointer rounded" />
                  </th>
                  {shownColumns.map((c) => th(c.key, c.label))}
                  <th scope="col" className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const checked = selected.includes(p.dbId);
                  return (
                    <tr key={p.dbId} onClick={() => router.push(chairPaperHref(slug, p.id))} style={{ background: checked ? "var(--primary-soft)" : undefined, borderBottom: i < filtered.length - 1 ? "1px solid var(--muted)" : "none" }} className="cursor-pointer transition-colors">
                      <td onClick={(e) => e.stopPropagation()} className="py-3.5 pl-4 pr-1 align-top">
                        <input type="checkbox" checked={checked} onChange={() => toggleOne(p.dbId)} aria-label={`Select submission ${p.id}`} style={{ accentColor: "var(--primary)" }} className="mt-0.5 h-4 w-4 cursor-pointer rounded" />
                      </td>
                      {shownColumns.map((c) => <td key={c.key} className="px-3 py-3.5 align-top">{c.render(p, ctx)}</td>)}
                      <td onClick={(e) => e.stopPropagation()} className="px-3 py-3.5 text-right align-top">
                        <button type="button" onClick={() => { setActionError(""); setConfirmDelete([p.dbId]); }} aria-label={`Delete submission ${p.id}`} className="text-ink-faint transition-colors hover:text-danger-ink"><Trash2 size={15} aria-hidden="true" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-14 text-center">
              <FileText size={28} aria-hidden="true" className="mx-auto mb-2 text-line-strong" />
              <p className="text-sm text-ink-faint">{emptyHint}</p>
            </div>
          )}
        </div>
      </div>

      {bulk === "contact" && <ContactDialog open papers={selectedPapers} onClose={closeBulk} />}
      {bulk === "assign" && <AssignReviewersDialog open count={selected.length} reviewers={(pool?.reviewers ?? []).filter((r) => r.status !== "declined")} defaultDue={due0} busy={busy} error={actionError} onAssign={(r, d) => { void bulkAssign(r, d); }} onClose={closeBulk} />}
      {bulk === "decisions" && <EditDecisionsDialog open papers={selectedPapers} types={data.decisionTypes} busy={busy} error={actionError} onApply={(t) => { void bulkDecision(t); }} onClose={closeBulk} />}
      {bulk === "track" && <EditTrackDialog open count={selected.length} tracks={tracksList} busy={busy} error={actionError} onApply={(t) => { void bulkTrack(t); }} onClose={closeBulk} />}

      <Dialog open={confirmDelete !== null} onClose={() => { if (!busy) setConfirmDelete(null); }} title="Delete Submission(s)" size="sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft"><AlertTriangle size={18} aria-hidden="true" className="text-danger-ink" /></div>
          <p className="text-sm leading-relaxed text-ink-soft">{(confirmDelete?.length ?? 0) === 1 ? "Are you sure you want to delete this submission? This cannot be undone." : `Are you sure you want to delete these ${confirmDelete?.length ?? 0} submissions? This cannot be undone.`}</p>
        </div>
        {actionError && confirmDelete && <p role="alert" className="mb-3 text-sm font-semibold text-danger-ink">{actionError}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(null)} className="rounded-lg border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={() => { if (confirmDelete) void performDelete(confirmDelete); }} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50">{busy ? "Deleting…" : "Delete"}</button>
        </div>
      </Dialog>
    </ConferenceShell>
  );
}
