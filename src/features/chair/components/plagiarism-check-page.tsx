"use client";

import { Check, ChevronRight, Clock, Download, FileText, Info, Lock, Settings2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { ScreeningEmailForm, type ScreeningSendInput } from "./screening-email-form";
import { useIdSort } from "@/lib/use-id-sort";
import { useRangeSelect } from "@/lib/use-range-select";
import { buildZip, saveBlob } from "@/lib/zip";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import type { ChairPaper, ScreeningFile, ScreeningRecord } from "@/types/chair";
import { CHECK_DECISIONS, EMAILED, fromIsoDay, inDays, isOverdue, MAX_REPORT_FILES, PLAG_DECISIONS, PLAG_REJECT_PROBLEM, PLAG_REVISION_PROBLEM, plagDecisionOf, reportFilesOf, toIsoDay, todayLabel, withOutcome, type DecisionMeta } from "../screening";
import { checkDecisionOf, inPeerReview, screeningStageOf } from "../stage";
import { useChairConference } from "../use-chair-conference";
import { ScreeningSearchParam } from "./screening-search-param";
import { chairPaperHref } from "@/lib/routes";
import {
  BulkBar, BulkConfirmModal, CARD, DecisionChip, DecisionSelect, DecisionWarning, DueLine, EMAIL_OPTIONS, EmailCell, FilterSelect, FilterText, IdCell, IdSortLabel, InitialReportModal, LoadingOverlay, LockNote, MovedNote, ScreeningSettingsButton,
  ScreeningToast, SelectBox, SubmittedCell, SUBMITTED_OPTIONS, SummaryChip, TableFrame, Th, TitleCell, Toolbar, decisionInfo, isControl, submittedBucket, type ScreeningToastData,
} from "./screening-ui";

/* The chair's Plagiarism Check (the prototype's PlagiarismCheckPage): the papers whose newest version passed the Initial Check, with
   up to two iThenticate report PDFs (stored next to the paper in the private papers bucket; the paper's authors can read them only when
   the chair shares them), the decision (Plag Cleared / Hold / Revision / Reject, saved through `save_screening`) and "Send email" for
   Revision or Reject (`screening_notified`); a paper's earlier versions open under its row, and the selection can be downloaded as one ZIP
   for iThenticate. The iThenticate scores live on the paper's own page.
   "Send Email" opens the same editable draft as the Initial Check (screening-email-form.tsx), with the option to share the report. */

const FILTERS0 = { id: "", title: "", submitted: "all", initial: "all", report: "all", decision: "all", email: "all" };
const key = (p: ChairPaper, n: number) => `${p.dbId}:${n}`;
const numericId = (a: ChairPaper, b: ChairPaper) => a.id.localeCompare(b.id, undefined, { numeric: true });
const REPORT_OPTIONS: Array<[string, string]> = [["all", "All"], ["missing", "Not uploaded"], ["added", "Uploaded"]];

export function PlagiarismCheckPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, retry, reload } = useChairConference(slug, { files: true });
  const [f, setFiltersState] = useState(FILTERS0);
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const idSort = useIdSort();
  const range = useRangeSelect();
  const [selected, setSelected] = useState<string[]>([]);
  const [showNot, setShowNot] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [local, setLocal] = useState<Record<string, ScreeningRecord>>({});
  const [draft, setDraft] = useState<string | null>(null);
  const [reportOf, setReportOf] = useState<{ paper: ChairPaper; n: number } | null>(null);
  const [bulk, setBulk] = useState<{ decision: DecisionMeta; total: number; todo: string[]; notes: string[] } | null>(null);
  const [busy, setBusy] = useState<{ label: string; hint: string } | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ScreeningToastData | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const closeToast = useCallback(() => setToast(null), []);
  useEffect(() => { const t = timers.current; return () => { Object.values(t).forEach(clearTimeout); }; }, []);

  const gate = workspaceGate(state, retry, { title: "Plagiarism Check", loadingLabel: "Loading the plagiarism check", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the plagiarism check." });
  if (gate || state.status !== "ready" || !state.files) return gate;
  const { conference, roles, others, data, files } = state;
  const { criteria } = data;
  const e = encodeURIComponent(conference.id);
  const shell = (body: ReactNode) => (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="screening/plagiarism" screening={data.screening}>
      <PageHeader title="Plagiarism Check" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} actions={<ScreeningSettingsButton href={`/chair/${slug}/settings/submissions`} />} />
      {body}
      <ScreeningToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
  if (!data.screening.plagiarism) {
    return shell(<div className="p-8"><div style={CARD} className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-14 text-center"><Lock size={26} aria-hidden="true" className="mx-auto mb-3 text-ink-faint" /><h2 className="text-base font-bold text-navy">Plagiarism Check is turned off for this conference</h2><p className="mb-4 mt-1 text-sm text-ink-muted">Turn it on in Conference Settings › Submissions › Paper Screening.</p><a href={`/chair/${e}/settings/submissions`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white"><Settings2 size={14} aria-hidden="true" /> Open Screening Settings</a></div></div>);
  }

  const versionsOf = (p: ChairPaper) => Math.max(p.versions, (files[p.dbId] ?? []).length, 1);
  const fileOf = (p: ChairPaper, n: number): ScreeningFile | null => (files[p.dbId] ?? []).find((x) => x.n === n) ?? null;
  const recOf = (p: ChairPaper, n: number): ScreeningRecord | undefined => local[key(p, n)] ?? p.screening[String(n)];
  const passedCheck = (rec: ScreeningRecord | undefined) => !data.screening.initialCheck || checkDecisionOf(rec) === "passed";
  const inPlag = (rec: ScreeningRecord | undefined) => passedCheck(rec) || !!rec?.report || !!rec?.outcome;
  const view = (p: ChairPaper, n: number) => {
    const rec = recOf(p, n);
    const latest = n === versionsOf(p);
    const reports = reportFilesOf(rec);
    // A paper with reviewers (or a decision) has been through both steps, whatever the record says.
    const decision = latest && plagDecisionOf(rec) === "pending" && inPeerReview(p) ? "clear" : plagDecisionOf(rec);
    return { rec, reports, has: reports.length > 0, waiting: !(latest && inPeerReview(p)) && !inPlag(rec), decision, sentAt: EMAILED.includes(decision) ? (rec?.outcome?.emailedAt || null) : null, deadline: rec?.outcome?.deadline, uploadedAt: fileOf(p, n)?.uploadedAt ?? (latest ? p.submittedAt : null) };
  };
  const stagePapers = data.papers.filter((p) => !p.withdrawn && p.outcome !== "upload_pending");
  const clearOf = (p: ChairPaper) => (screeningStageOf({ ...p, screening: { ...p.screening, ...Object.fromEntries(Object.entries(local).filter(([k]) => k.startsWith(`${p.dbId}:`)).map(([k, v]) => [k.split(":")[1], v])) } }, data.screening) === "clear" ? 1 : 0);
  const ordered = [...stagePapers].sort((a, b) => clearOf(a) - clearOf(b) || numericId(a, b)).map((p) => ({ p, count: versionsOf(p) }));
  const anyIn = (x: { p: ChairPaper; count: number }) => inPeerReview(x.p) || Array.from({ length: x.count }, (_, i) => recOf(x.p, i + 1)).some(inPlag);
  const papers = ordered.filter(anyIn);
  const notPassed = data.screening.initialCheck ? ordered.filter((x) => !anyIn(x)) : [];
  const latestOf = (x: { p: ChairPaper; count: number }) => view(x.p, x.count);
  const idq = f.id.trim().toLowerCase(); const tq = f.title.trim().toLowerCase();
  const textMatch = (x: { p: ChairPaper; count: number }) => (!idq || `${x.p.id} v${x.count}`.toLowerCase().includes(idq)) && (!tq || x.p.title.toLowerCase().includes(tq)) && (f.submitted === "all" || submittedBucket(view(x.p, x.count).uploadedAt) === f.submitted);
  // They have no report, plagiarism decision or plagiarism email yet, so those filters leave them out; the rest apply.
  const notPassedShown = (f.decision !== "all" || f.report !== "all" || f.email !== "all" || f.initial === "passed") ? [] : notPassed.filter(textMatch);
  const shown = papers.filter((x) => {
    const v = latestOf(x);
    return textMatch(x)
      && (f.initial === "all" || (f.initial === "waiting" ? v.waiting : !v.waiting))
      && (f.report === "all" || (f.report === "missing" ? !v.has && !v.waiting : v.has))
      && (f.decision === "all" || (!v.waiting && v.decision === f.decision))
      && (f.email === "all" || (f.email === "sent" ? !!v.sentAt : f.email === "overdue" ? isOverdue(v.deadline) : EMAILED.includes(v.decision) && !v.sentAt));
  });
  const matching = new Set(shown.map((x) => x.p.dbId));
  const byId = new Map([...papers, ...notPassed].map((x) => [x.p.dbId, x]));
  const list = idSort.sort(frozen ? frozen.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)) : shown, (x) => x.p.id);
  const isMoved = (p: ChairPaper) => !!frozen && !matching.has(p.dbId);
  const movedCount = list.filter((x) => isMoved(x.p)).length;
  const freeze = () => setFrozen((ids) => ids ?? shown.map((x) => x.p.dbId));
  const counts = Object.fromEntries(PLAG_DECISIONS.map((d) => [d.key, papers.filter((x) => { const v = latestOf(x); return !v.waiting && v.decision === d.key; }).length]));
  const overdue = papers.filter((x) => isOverdue(latestOf(x).deadline)).length;
  const filtersOn = JSON.stringify(f) !== JSON.stringify(FILTERS0);
  const setF = (k: keyof typeof FILTERS0) => (v: string) => { setFiltersState({ ...f, [k]: v }); setFrozen(null); setSelected([]); };
  const clearFilters = () => { setFiltersState(FILTERS0); setFrozen(null); setSelected([]); };

  // Selection: any listed paper whose newest version is in this step and not yet in peer review. It serves both bulk actions (a decision, and the ZIP).
  const selectable = (x: { p: ChairPaper; count: number }) => !latestOf(x).waiting && !inPeerReview(x.p);
  const visibleSelectable = list.filter(selectable).map((x) => x.p.dbId);
  const allSelected = visibleSelectable.length > 0 && visibleSelectable.every((id) => selected.includes(id));
  const someSelected = visibleSelectable.some((id) => selected.includes(id));
  const pick = range({ ids: visibleSelectable, isSelected: (id) => selected.includes(id), setMany: (ids, on) => setSelected((l) => (on ? [...new Set([...l, ...ids])] : l.filter((x) => !ids.includes(x)))) });

  const persist = (p: ChairPaper, n: number, rec: ScreeningRecord, now = false) => {
    const k = key(p, n);
    setLocal((l) => ({ ...l, [k]: rec }));
    clearTimeout(timers.current[k]);
    const save = async () => {
      const { auto, ...record } = rec as ScreeningRecord & { auto?: unknown }; void auto;
      try { await (await getChairService()).saveScreening(p.dbId, n, JSON.parse(JSON.stringify(record))); } catch (err) {
        setToast({ title: "Couldn't save the change", text: err instanceof Error ? err.message : "Something went wrong." });
        setLocal({}); reload();
      }
    };
    if (now) return save();
    timers.current[k] = setTimeout(() => { void save(); }, 400);
    return Promise.resolve();
  };
  const decide = (p: ChairPaper, n: number, kind: string) => {
    freeze();
    void persist(p, n, withOutcome(recOf(p, n), kind));
    if (kind === "clear") setToast({ title: `${p.id} is plagiarism clear`, text: "Reviewers can now be assigned." });
    if (kind === "revision") setToast({ title: "Decision saved", text: `Send the email so the author of ${p.id} can revise.` });
    if (kind === "reject") setToast({ title: "Decision saved", text: `Send the email to tell the author of ${p.id}.` });
  };

  // Bulk: work out what would happen, show it, then apply.
  const planBulk = (decision: DecisionMeta) => {
    const picked = selected.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const skipped = picked.filter((x) => !selectable(x));
    const same = picked.filter((x) => selectable(x) && latestOf(x).decision === decision.key);
    const todo = picked.filter((x) => selectable(x) && latestOf(x).decision !== decision.key);
    const noReport = decision.key !== "pending" && decision.key !== "hold" ? todo.filter((x) => !latestOf(x).has) : [];
    const notes = [
      same.length && `${same.length} already ${same.length === 1 ? "is" : "are"} ${decision.label} — left as they are.`,
      skipped.length && `${skipped.length} ${skipped.length === 1 ? "is" : "are"} in peer review or not in this step — skipped.`,
      noReport.length && `${noReport.length} ${noReport.length === 1 ? "has" : "have"} no plagiarism report uploaded (${noReport.slice(0, 4).map((x) => x.p.id).join(", ")}${noReport.length > 4 ? "…" : ""}).`,
      decision.key === "clear" && todo.length && "Reviewers can be assigned to them straight away.",
    ].filter((x): x is string => Boolean(x));
    setBulk({ decision, total: picked.length, todo: todo.map((x) => x.p.dbId), notes });
  };
  const applyBulk = async ({ sendEmails, dueIso }: { sendEmails: boolean; dueIso: string }) => {
    if (!bulk) return;
    const { decision } = bulk;
    const todo = bulk.todo.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    freeze();
    const at = todayLabel();
    const deadline = decision.key === "reject" || !dueIso ? "" : fromIsoDay(dueIso);
    setBulk(null); setSelected([]);
    if (!sendEmails) {
      todo.forEach((x) => void persist(x.p, x.count, withOutcome(recOf(x.p, x.count), decision.key)));
      setToast({ title: `${todo.length} paper${todo.length === 1 ? "" : "s"} set to ${decision.label}`, text: EMAILED.includes(decision.key) ? "Send each author the email from the Send Email column." : decision.key === "clear" ? "Reviewers can now be assigned." : "" });
      return;
    }
    // Each author gets the standard email for their own paper, with its plagiarism report attached.
    setBusy({ label: `Sending ${todo.length} email${todo.length === 1 ? "" : "s"} to the authors…`, hint: "Each author is emailed with their own plagiarism report. Please don't close or refresh the page." });
    let failed = 0;
    for (const x of todo) {
      try {
        const reject = decision.key === "reject";
        const rec = withOutcome(recOf(x.p, x.count), decision.key);
        rec.outcome = { ...(rec.outcome ?? { kind: decision.key }), reasons: [reject ? PLAG_REJECT_PROBLEM : PLAG_REVISION_PROBLEM], note: "", deadline, shareReport: reportFilesOf(rec).length > 0, emailedAt: at };
        await persist(x.p, x.count, rec, true);
        await sendActionEmails("screening_notified", { submissionId: x.p.dbId, version: x.count, stage: reject ? "reject" : "revision", coAuthors: false });
      } catch { failed += 1; }
    }
    setBusy(null);
    setToast(failed ? { title: `${todo.length - failed} of ${todo.length} authors emailed`, text: `${failed} could not be emailed: send those from the Send Email column.` } : { title: `${todo.length} paper${todo.length === 1 ? "" : "s"} set to ${decision.label}`, text: `All ${todo.length} author${todo.length === 1 ? " was" : "s were"} emailed with their report.` });
  };

  const addReports = async (p: ChairPaper, n: number, picked: File[]) => {
    const rec = recOf(p, n);
    const current = reportFilesOf(rec);
    const room = MAX_REPORT_FILES - current.length;
    if (room <= 0) return;
    setBusy({ label: "Uploading the report…", hint: "Storing it next to the paper." });
    try {
      const svc = await getChairService();
      const added: string[] = []; const paths: Record<string, string> = {};
      for (const file of picked.slice(0, room)) { const up = await svc.uploadScreeningReport(p.dbId, file); if (!current.includes(up.name)) { added.push(up.name); paths[up.name] = up.path; } }
      const names = [...current, ...added];
      freeze();
      await persist(p, n, { ...(rec ?? {}), report: { similarity: null, ai: null, ...(rec?.report ?? {}), files: names, file: names[0] ?? "", at: todayLabel(), by: "Conference Chair" }, paths: { ...(rec?.paths ?? {}), ...paths } }, true);
      if (picked.length > room) setToast({ title: `Only ${MAX_REPORT_FILES} report files per version`, text: `${picked.length - room} file${picked.length - room === 1 ? " was" : "s were"} not added.` });
    } catch (err) { setToast({ title: "Couldn't upload the report", text: err instanceof Error ? err.message : "Something went wrong." }); } finally { setBusy(null); }
  };
  const removeReport = (p: ChairPaper, n: number, name: string) => {
    const rec = recOf(p, n);
    const names = reportFilesOf(rec).filter((x) => x !== name);
    freeze();
    void persist(p, n, { ...(rec ?? {}), report: { similarity: null, ai: null, ...(rec?.report ?? {}), files: names, file: names[0] ?? "", at: todayLabel(), by: "Conference Chair" } });
  };
  const openReport = async (p: ChairPaper, n: number, name: string) => {
    const path = recOf(p, n)?.paths?.[name];
    if (!path) { setToast({ title: "No stored file", text: "This report has no stored file to open." }); return; }
    try { window.open(await (await getChairService()).fileUrl(path, name), "_blank", "noopener"); } catch (err) { setToast({ title: "Couldn't open the file", text: err instanceof Error ? err.message : "Something went wrong." }); }
  };
  const openPaper = async (p: ChairPaper, n: number, download: boolean) => {
    const file = fileOf(p, n);
    if (!file?.storagePath) { setToast({ title: "No file to open", text: "This version's file isn't stored here." }); return; }
    try { window.open(await (await getChairService()).fileUrl(file.storagePath, download ? file.name : undefined), "_blank", "noopener"); } catch (err) { setToast({ title: "Couldn't open the file", text: err instanceof Error ? err.message : "Something went wrong." }); }
  };
  const send = async (p: ChairPaper, n: number, { note, deadline, share, co, kind, subject, body }: ScreeningSendInput) => {
    const v = view(p, n);
    setBusy({ label: "Sending the email to the author…", hint: "The author is emailed and notified, with the plagiarism report. Please don't close or refresh the page." }); setError("");
    try {
      const reject = v.decision === "reject";
      freeze();
      const rec: ScreeningRecord = { ...(v.rec ?? {}) };
      rec.outcome = { ...(rec.outcome ?? { kind: v.decision }), reasons: [reject ? PLAG_REJECT_PROBLEM : PLAG_REVISION_PROBLEM], note, deadline, shareReport: share, emailedAt: todayLabel() };
      await persist(p, n, rec, true);
      const mail = await sendActionEmails("screening_notified", { submissionId: p.dbId, version: n, stage: reject ? "reject" : "revision", coAuthors: co, kind, subject, body });
      setToast({ title: "Email sent", text: mail ?? `The author of ${p.id} was emailed${share ? " with the plagiarism report" : ""}${co ? ", plus the co-authors" : ""}.` });
      setDraft(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); } finally { setBusy(null); }
  };
  /** "Download for iThenticate (ZIP)": the newest version of each selected paper in one file; each is marked as sent to iThenticate. */
  const downloadSelected = async () => {
    const picked = selected.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    setBusy({ label: `Preparing ${picked.length} paper${picked.length === 1 ? "" : "s"} for iThenticate…`, hint: "Collecting the newest version of each paper into one ZIP file." });
    try {
      const svc = await getChairService();
      const out: Array<{ name: string; data: Uint8Array }> = [];
      for (const x of picked) {
        const file = fileOf(x.p, x.count);
        if (!file?.storagePath) continue;
        const res = await fetch(await svc.fileUrl(file.storagePath));
        if (!res.ok) continue;
        const ext = (file.name.match(/\.[^.]+$/) ?? [".pdf"])[0];
        out.push({ name: `${x.p.id}_v${x.count}${ext}`, data: new Uint8Array(await res.arrayBuffer()) });
        const rec = recOf(x.p, x.count);
        void persist(x.p, x.count, { ...(rec ?? {}), ithenticate: { at: todayLabel(), by: "Conference Chair" } });
      }
      if (!out.length) { setToast({ title: "Nothing to download", text: "None of the selected papers has a stored file here." }); return; }
      saveBlob(buildZip(out), `${conference.acronym.replace(/\s+/g, "-")}_for-iThenticate_${out.length}.zip`);
      setToast({ title: `Downloaded ${out.length} paper${out.length === 1 ? "" : "s"}`, text: "Newest version of each, in one ZIP — ready to upload to iThenticate." });
    } catch (err) { setToast({ title: "Couldn't prepare the ZIP", text: err instanceof Error ? err.message : "Something went wrong." }); } finally { setBusy(null); }
  };
  const toggleRow = (id: string) => setOpen((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const checkHref = (p: ChairPaper) => `/chair/${e}/plagiarism/${encodeURIComponent(p.id)}`;

  const row = (x: { p: ChairPaper; count: number }, n: number) => {
    const { p, count } = x;
    const latest = n === count;
    const v = view(p, n);
    const editable = latest && !v.waiting && !inPeerReview(p);
    const isSel = latest && selected.includes(p.dbId);
    const ic = CHECK_DECISIONS.find((d) => d.key === (latest && inPeerReview(p) && checkDecisionOf(v.rec) === "pending" ? "passed" : checkDecisionOf(v.rec))) ?? CHECK_DECISIONS[0];
    const chooseFiles = (ev: React.ChangeEvent<HTMLInputElement>) => { const chosen = Array.from(ev.target.files ?? []); ev.target.value = ""; if (chosen.length) void addReports(p, n, chosen); };
    const initialSent = v.rec?.check?.emailedAt || v.rec?.correction?.emailedAt;
    const initialDue = v.rec?.correction?.deadline;
    const waitingText = !latest && checkDecisionOf(v.rec) === "pending" ? `V${n} was replaced by a newer version before its initial check` : ({ revision: `V${n} went back to the author at the initial check — not sent for plagiarism check`, hold: `V${n} is on hold at the initial check`, reject: `V${n} was rejected at the initial check` } as Record<string, string>)[checkDecisionOf(v.rec)] ?? `V${n} is waiting for its initial check`;
    return (
      <tr
        key={`${p.dbId}-${n}`}
        onClick={(ev) => { if (latest && count > 1 && !isControl(ev.target)) toggleRow(p.dbId); }}
        {...(latest ? pick.row(p.dbId) : {})}
        style={{ background: !latest ? "var(--canvas)" : isSel ? "var(--primary-soft)" : isMoved(p) ? "#FFFBEB" : "#FFFFFF", cursor: latest && count > 1 ? "pointer" : "default" }}
        className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-4 [&>td]:align-middle hover:[&>td]:bg-[#FAFAFF]"
      >
        <td className="text-center">{latest && selectable(x) && <SelectBox label={`Select ${p.id}`} checked={isSel} {...pick.box(p.dbId)} />}</td>
        <td><IdCell paper={p} n={n} latest={latest} count={count} open={open.has(p.dbId)} onToggle={() => toggleRow(p.dbId)} onOpenCheck={() => router.push(checkHref(p))} openTitle="Open this paper's plagiarism check" /></td>
        <td><TitleCell paper={p} latest={latest} onOpenDetails={() => router.push(chairPaperHref(slug, p.id))} onOpenPdf={() => void openPaper(p, n, false)} onDownload={() => void openPaper(p, n, true)} onOpenCheck={latest ? () => router.push(checkHref(p)) : null} checkTitle="Everything about this paper's plagiarism check" checkLabel="Check details" /></td>
        <td><SubmittedCell at={v.uploadedAt} n={n} /></td>
        <td>
          {!data.screening.initialCheck
            ? <span className="text-xs text-ink-faint">Not required</span>
            : (
              <button type="button" onClick={() => setReportOf({ paper: p, n })} title="See the initial check report" style={{ color: ic.color, background: ic.bg }} className="inline-flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold hover:opacity-80">
                {ic.key === "passed" ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <Clock size={12} aria-hidden="true" />} {ic.key === "pending" ? "Waiting" : ic.label} <Info size={11} aria-hidden="true" className="opacity-70" />
              </button>
            )}
        </td>
        {v.waiting ? (
          <td colSpan={3}>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint"><Clock size={12} aria-hidden="true" /> {waitingText}</span>
            {initialSent && <span className="mt-1 block pl-[18px] text-[11px] font-semibold text-ink-muted">Author emailed {initialSent}{initialDue ? ` · new version due ${initialDue}` : ""}</span>}
          </td>
        ) : (
          <>
            <td>
              <div className="flex w-full flex-col items-stretch gap-1.5">
                {/* The upload button first; the files already uploaded sit underneath it. */}
                {editable && v.reports.length < MAX_REPORT_FILES && (
                  <label style={{ border: "1.5px dashed var(--border-strong)" }} className="relative flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-semibold text-ink-soft hover:border-primary hover:text-primary">
                    <input type="file" accept=".pdf,application/pdf" multiple={MAX_REPORT_FILES - v.reports.length > 1} aria-label={`Upload report for ${p.id}`} className="sr-only" onChange={chooseFiles} />
                    <Upload size={13} aria-hidden="true" /> {v.reports.length ? "Add another file" : "Upload report"} <span className="font-normal text-ink-faint">({v.reports.length}/{MAX_REPORT_FILES})</span>
                  </label>
                )}
                {v.reports.map((name) => (
                  <span key={name} style={{ border: "1px solid var(--border)" }} className="flex w-full items-center rounded-md bg-white">
                    <button type="button" onClick={() => void openReport(p, n, name)} title={`Download ${name}`} className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-1.5 pl-2.5 pr-1.5 text-xs font-semibold text-primary hover:underline"><FileText size={13} aria-hidden="true" className="shrink-0" /> <span className="flex-1 truncate text-left">{name}</span> <Download size={12} aria-hidden="true" className="shrink-0 opacity-70" /></button>
                    {editable && v.decision === "pending" && <button type="button" onClick={() => removeReport(p, n, name)} aria-label={`Remove ${name}`} title="Remove this file" className="h-8 cursor-pointer px-1.5 text-ink-faint hover:text-danger-ink"><X size={13} aria-hidden="true" /></button>}
                  </span>
                ))}
                {!editable && !v.reports.length && <span className="text-xs text-ink-faint">—</span>}
              </div>
            </td>
            <td>
              {editable ? (
                <>
                  <DecisionSelect label={`Decision for ${p.id}`} value={v.decision} options={PLAG_DECISIONS} onChange={(d) => decide(p, n, d)} />
                  {!v.has && v.decision === "pending" && <div className="mt-1 text-[11px] text-ink-faint">Upload the report first</div>}
                  <DecisionWarning decision={v.decision} noReport={!v.has} />
                  {isMoved(p) && <MovedNote />}
                </>
              ) : <><DecisionChip value={v.decision} options={PLAG_DECISIONS} />{latest && inPeerReview(p) && <LockNote />}</>}
            </td>
            <td className="text-center">
              {editable
                ? <EmailCell enabled={EMAILED.includes(v.decision)} sentAt={v.sentAt} deadline={v.deadline} disabledHint="Set the decision to Revision or Reject first" onSend={() => { setError(""); setDraft(p.dbId); }} />
                : v.sentAt
                  ? <div className="flex flex-col items-center gap-1"><span className="text-xs text-ink-faint">Sent · {v.sentAt}</span>{latest && <DueLine deadline={v.deadline} />}</div>
                  : <span className="text-xs text-ink-faint">—</span>}
            </td>
          </>
        )}
      </tr>
    );
  };

  const draftRow = draft ? byId.get(draft) : undefined;
  const draftView = draftRow ? latestOf(draftRow) : null;
  return shell(
    <div className="px-8 pb-8 pt-5">
      <ScreeningSearchParam onSearch={(id) => { setFiltersState({ ...FILTERS0, id }); setFrozen(null); setSelected([]); }} />
      <Toolbar
        filtersOn={filtersOn} onClear={clearFilters} moved={movedCount} onRefresh={() => setFrozen(null)}
        summary={(
          <>
            <SummaryChip label="All" count={papers.length} color="var(--navy)" bg="var(--muted)" active={!filtersOn} onClick={clearFilters} />
            {PLAG_DECISIONS.map((d) => <SummaryChip key={d.key} label={d.label} count={counts[d.key] ?? 0} color={d.color} bg={d.bg} active={f.decision === d.key} onClick={() => setF("decision")(f.decision === d.key ? "all" : d.key)} />)}
            {overdue > 0 && <SummaryChip label="Overdue" count={overdue} color="var(--danger)" bg="var(--danger-soft)" active={f.email === "overdue"} onClick={() => setF("email")(f.email === "overdue" ? "all" : "overdue")} />}
            {notPassed.length > 0 && <SummaryChip label={showNot ? "Hide not passed initial check" : "Not passed initial check"} count={notPassed.length} color="var(--ink-soft)" bg="var(--canvas)" active={showNot} onClick={() => setShowNot((o) => !o)} />}
          </>
        )}
      />
      <BulkBar count={selected.length} options={PLAG_DECISIONS} onPick={planBulk} onClear={() => setSelected([])}>
        <button type="button" onClick={() => void downloadSelected()} className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-2.5 text-xs font-bold hover:bg-white/25"><Download size={13} aria-hidden="true" /> Download for iThenticate (ZIP)</button>
      </BulkBar>
      <TableFrame minWidth={1400} empty={list.length === 0 && notPassedShown.length === 0 ? (papers.length ? "No paper matches these filters." : "No paper has passed the initial check yet.") : null}>
        <thead>
          <tr>
            <Th label="" className="w-[44px]"><div className="flex h-7 items-center justify-center"><SelectBox label="Select all listed papers" checked={allSelected} indeterminate={someSelected && !allSelected} disabled={!visibleSelectable.length} onChange={(on) => setSelected(on ? [...new Set([...selected, ...visibleSelectable])] : selected.filter((id) => !visibleSelectable.includes(id)))} /></div></Th>
            <Th label={<IdSortLabel label="ID" dir={idSort.dir} onToggle={idSort.toggle} />} className="w-[128px]"><FilterText value={f.id} onChange={setF("id")} placeholder="Search ID" /></Th>
            <Th label="Title" className="w-[320px]"><FilterText value={f.title} onChange={setF("title")} placeholder="Search title" /></Th>
            <Th label="Submitted" className="w-[130px]" info={"When this version was uploaded. A resubmitted version (V2, V3…) shows its own upload date."}><FilterSelect label="Submitted" value={f.submitted} onChange={setF("submitted")} options={SUBMITTED_OPTIONS} /></Th>
            <Th label="Initial Check" className="w-[140px]" info={"The result of this version's initial check. Click it to see the full initial check report."}><FilterSelect label="Initial Check" value={f.initial} onChange={setF("initial")} options={[["all", "All"], ["passed", "Passed"], ["waiting", "Waiting"]]} /></Th>
            <Th label="Plagiarism Report" className="w-[280px]" info={"Upload the report from iThenticate — up to 2 PDF files (e.g. the similarity report and the AI-writing report). It's attached to the email to the author automatically."}><FilterSelect label="Plagiarism Report" value={f.report} onChange={setF("report")} options={REPORT_OPTIONS} /></Th>
            <Th label="Decision" className="w-[170px]" tip="right" info={decisionInfo(PLAG_DECISIONS)}><FilterSelect label="Decision" value={f.decision} onChange={setF("decision")} options={[["all", "All"], ...PLAG_DECISIONS.map((d): [string, string] => [d.key, d.label])]} /></Th>
            <Th label="Send Email" className="w-[170px]" align="center" tip="right" info={"Active when the decision is Revision or Reject. Opens a ready email with the paper ID, title and the plagiarism report attached.\nAfter sending, the due date for the revised version shows here — red once it's overdue — with Send again."}><FilterSelect label="Send Email" value={f.email} onChange={setF("email")} options={EMAIL_OPTIONS} /></Th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <Fragment key={x.p.dbId}>
              {row(x, x.count)}
              {open.has(x.p.dbId) && Array.from({ length: x.count - 1 }, (_, i) => row(x, x.count - 1 - i))}
            </Fragment>
          ))}
          {list.length === 0 && notPassedShown.length > 0 && <tr><td colSpan={8} className="py-8 text-center text-sm text-ink-faint">{papers.length ? "No paper matches these filters." : "No paper has passed the initial check yet."}</td></tr>}
          {/* Papers that haven't passed the initial check: hidden until the chair opens them, with their check status. */}
          {notPassedShown.length > 0 && (
            <>
              <tr><td colSpan={8} style={{ background: "var(--canvas)" }} className="border-y border-line px-3 py-2.5"><button type="button" onClick={() => setShowNot((o) => !o)} aria-expanded={showNot} className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-navy"><ChevronRight size={14} aria-hidden="true" style={{ transform: showNot ? "rotate(90deg)" : "none" }} className="transition-transform" /> Not passed the initial check <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">{notPassedShown.length}</span><span className="font-medium text-ink-faint">With the author, on hold, rejected or still waiting · {showNot ? "click to hide" : "click to show"}</span></button></td></tr>
              {showNot && notPassedShown.map((x) => (
                <Fragment key={`np-${x.p.dbId}`}>
                  {row(x, x.count)}
                  {open.has(x.p.dbId) && Array.from({ length: x.count - 1 }, (_, i) => row(x, x.count - 1 - i))}
                </Fragment>
              ))}
            </>
          )}
        </tbody>
      </TableFrame>
      <Dialog open={draftRow !== undefined} onClose={() => { if (!busy) setDraft(null); }} title={`Email the Author — Plagiarism Check ${draftView?.decision === "reject" ? "Rejection" : "Revision"}`} description={draftRow ? `${draftRow.p.id} · V${draftRow.count} · ${draftRow.p.title}` : undefined} size="xl">
        {draftRow && draftView && <SendDialog key={draftRow.p.dbId} paper={draftRow.p} n={draftRow.count} reject={draftView.decision === "reject"} hasReport={draftView.reports.length > 0} reportFiles={draftView.reports} defaultDue={inDays(criteria.revisionDays)} slug={slug} acronym={conference.acronym} confName={conference.name} sent={Boolean(draftView.sentAt)} onClose={() => setDraft(null)} onSend={(input) => void send(draftRow.p, draftRow.count, input)} busy={busy !== null} error={error} />}
      </Dialog>
      {reportOf && <InitialReportModal paper={reportOf.paper} n={reportOf.n} rec={recOf(reportOf.paper, reportOf.n)} criteria={criteria} onClose={() => setReportOf(null)} />}
      {bulk && <BulkConfirmModal key={bulk.decision.key} emailable={EMAILED.includes(bulk.decision.key)} defaultDue={toIsoDay(inDays(criteria.revisionDays))} decision={bulk.decision} total={bulk.total} change={bulk.todo.length} notes={bulk.notes} onConfirm={(o) => void applyBulk(o)} onClose={() => setBulk(null)} />}
      <LoadingOverlay open={busy !== null} label={busy?.label} hint={busy?.hint} />
    </div>,
  );
}

export function SendDialog({ paper, n, reject, hasReport, reportFiles, defaultDue, slug, acronym, confName, sent, onClose, onSend, busy, error }: { paper: ChairPaper; n: number; reject: boolean; hasReport: boolean; reportFiles: string[]; defaultDue: string; slug: string; acronym: string; confName: string; sent: boolean; onClose: () => void; onSend: (input: ScreeningSendInput) => void; busy: boolean; error: string }) {
  return <ScreeningEmailForm stage="plag" slug={slug} paperDbId={paper.dbId} paperId={paper.id} n={n} title={paper.title} acronym={acronym} confName={confName} authors={paper.authors} reject={reject} problems={[reject ? PLAG_REJECT_PROBLEM : PLAG_REVISION_PROBLEM]} hasReport={hasReport} reportFiles={reportFiles} defaultDue={defaultDue} sent={sent} note="" onClose={onClose} onSend={onSend} busy={busy} error={error} />;
}
