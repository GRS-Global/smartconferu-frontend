"use client";

import { Info, Lock, Settings2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { ScreeningEmailForm, type ScreeningSendInput } from "./screening-email-form";
import { useIdSort } from "@/lib/use-id-sort";
import { useRangeSelect } from "@/lib/use-range-select";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import type { ChairPaper, ScreeningCheck, ScreeningFile, ScreeningRecord } from "@/types/chair";
import { CHECK_DECISIONS, COLUMN_OPTIONS, EMAILED, evaluateCheck, type CheckItem, checkOf, columnOk, fromIsoDay, inDays, isOverdue, lengthState, pageRange, toIsoDay, todayLabel, withCheckPatch, withOutcome, type DecisionMeta } from "../screening";
import { checkDecisionOf, inPeerReview, screeningStageOf } from "../stage";
import { useChairConference } from "../use-chair-conference";
import { ScreeningSearchParam } from "./screening-search-param";
import { chairPaperHref } from "@/lib/routes";
import {
  AutoStatus, AutoTag, BulkBar, Btn, CARD, CELL_INPUT, CELL_INPUT_ST, CellHint, DecisionChip, DecisionSelect, DecisionWarning, EMAIL_OPTIONS, EmailCell, FilterSelect, FilterText, IdCell, IdSortLabel, LoadingOverlay, LockNote, MovedNote, PlainText,
  BulkConfirmModal, RED_ST, ScreeningSettingsButton, ScreeningModal, ScreeningToast, SelectBox, SubmittedCell, SUBMITTED_OPTIONS, SummaryChip, TableFrame, Th, TitleCell, Toolbar, YES_NO, YesNoSwitch, YesNoText, decisionInfo, isControl, submittedBucket, yesNo, DueLine, type ScreeningToastData,
} from "./screening-ui";

/* The chair's Initial Check (the prototype's InitialCheckPage): the newest version of every submitted paper with what its PDF showed
   (editable, English, layout, pages), the chair's own corrections, and the decision (Passed / Hold / Revision / Reject), saved
   through `save_screening`; a paper's earlier versions open under its row. For Revision or Reject, "Send email" records what to fix and
   the due date, then the email server mails the authors (`screening_notified`).
   "Send Email" opens an editable draft (screening-email-form.tsx: Main / Reminder / Last chance, co-authors, the authors' earlier emails). Difference kept on purpose:
   the automatic initial check is a paid plan feature with no
   setting in the database, so "Set automatically" only appears for a record that already carries it. */

const FILTERS0 = { id: "", title: "", submitted: "all", editable: "all", english: "all", column: "all", length: "all", decision: "all", email: "all" };
const key = (p: ChairPaper, n: number) => `${p.dbId}:${n}`;
const numericId = (a: ChairPaper, b: ChairPaper) => a.id.localeCompare(b.id, undefined, { numeric: true });

export function SendDialog({ paper, n, check, problems, defaultDue, slug, acronym, confName, items, sent, onClose, onSend, busy, error }: { paper: ChairPaper; n: number; check: ScreeningCheck & { decision: string }; problems: string[]; defaultDue: string; slug: string; acronym: string; confName: string; items: CheckItem[]; sent: boolean; onClose: () => void; onSend: (input: ScreeningSendInput) => void; busy: boolean; error: string }) {
  return <ScreeningEmailForm stage="initial" slug={slug} paperDbId={paper.dbId} paperId={paper.id} n={n} title={paper.title} acronym={acronym} confName={confName} items={items} authors={paper.authors} reject={check.decision === "reject"} problems={problems} hasReport={false} reportFiles={[]} defaultDue={defaultDue} sent={sent} note={check.comment ?? ""} onClose={onClose} onSend={onSend} busy={busy} error={error} />;
}

/** Confirm before sending a paper that is already in (or through) the plagiarism check back to the initial check. */
export function ReopenModal({ paper, n, rec, decision, onConfirm, onClose }: { paper: ChairPaper; n: number; rec: ScreeningRecord | undefined; decision: string; onConfirm: () => void; onClose: () => void }) {
  const was = rec?.outcome?.kind === "clear" ? "already plagiarism clear" : rec?.outcome?.kind === "revision" ? "already marked for plagiarism revision" : "already has a plagiarism report";
  const to = CHECK_DECISIONS.find((d) => d.key === decision)?.label ?? decision;
  return (
    <ScreeningModal title={`Change ${paper.id} V${n} to ${to}?`} subtitle={paper.title} onClose={onClose} width={520} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary onClick={onConfirm}>Yes, change to {to}</Btn></>}>
      <p className="text-sm text-ink">This paper is <b>{was}</b>. Sending it back to the initial check will:</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
        <li>Reset its plagiarism decision to No Decision (the report files are kept).</li>
        <li>Take it out of the “Plagiarism clear” stage, so reviewers can&apos;t be assigned.</li>
        {decision === "revision" && <li>Let you email the author to upload a corrected version, which goes through both checks again.</li>}
        {decision === "reject" && <li>Let you email the author that the paper is rejected.</li>}
      </ul>
    </ScreeningModal>
  );
}

export function InitialCheckPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, retry, reload } = useChairConference(slug, { files: true, settings: true });
  const [f, setFiltersState] = useState(FILTERS0);
  // Rows the chair edits stay where they are (same rows, same order) until the filter changes, so a paper doesn't vanish the moment its
  // decision no longer matches.
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const idSort = useIdSort();
  const range = useRangeSelect();
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [local, setLocal] = useState<Record<string, ScreeningRecord>>({});
  const [draft, setDraft] = useState<{ paper: ChairPaper; n: number } | null>(null);
  const [reopen, setReopen] = useState<{ paper: ChairPaper; n: number; decision: string } | null>(null);
  const [bulk, setBulk] = useState<{ decision: DecisionMeta; total: number; todo: string[]; notes: string[] } | null>(null);
  const [busy, setBusy] = useState<{ label: string; hint: string } | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ScreeningToastData | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const closeToast = useCallback(() => setToast(null), []);
  useEffect(() => { const t = timers.current; return () => { Object.values(t).forEach(clearTimeout); }; }, []);

  const gate = workspaceGate(state, retry, { title: "Initial Check", loadingLabel: "Loading the initial check", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the initial check." });
  if (gate || state.status !== "ready" || !state.files) return gate;
  const { conference, roles, others, data, files } = state;
  const { criteria } = data;
  const doubleBlind = state.settings?.limits.reviewMode === "double_blind";
  const e = encodeURIComponent(conference.id);
  const shell = (body: ReactNode) => (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="screening/initial-check" screening={data.screening}>
      <PageHeader title="Initial Check" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} actions={<ScreeningSettingsButton href={`/chair/${slug}/settings/submissions`} />} />
      {body}
      <ScreeningToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
  if (!data.screening.initialCheck) {
    return shell(<div className="p-8"><div style={CARD} className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-14 text-center"><Lock size={26} aria-hidden="true" className="mx-auto mb-3 text-ink-faint" /><h2 className="text-base font-bold text-navy">Initial Check is turned off for this conference</h2><p className="mb-4 mt-1 text-sm text-ink-muted">Turn it on in Conference Settings › Submissions › Paper Screening.</p><a href={`/chair/${e}/settings/submissions`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white"><Settings2 size={14} aria-hidden="true" /> Open Screening Settings</a></div></div>);
  }

  const versionsOf = (p: ChairPaper) => Math.max(p.versions, (files[p.dbId] ?? []).length, 1);
  const fileOf = (p: ChairPaper, n: number): ScreeningFile | null => (files[p.dbId] ?? []).find((x) => x.n === n) ?? null;
  const recOf = (p: ChairPaper, n: number): ScreeningRecord | undefined => local[key(p, n)] ?? p.screening[String(n)];
  const view = (p: ChairPaper, n: number) => {
    const rec = recOf(p, n);
    const file = fileOf(p, n);
    const auto = file?.auto ?? null;
    const check = checkOf(rec, auto, criteria);
    const length = lengthState(check, criteria);
    const failing = evaluateCheck(check, criteria).filter((i) => !i.ok);
    return { rec, file, auto, check, length, range: pageRange(criteria, check.column), colOk: columnOk(check, criteria), failing, sentAt: EMAILED.includes(check.decision) ? (check.emailedAt || rec?.correction?.emailedAt || null) : null, deadline: check.decision === "revision" ? rec?.correction?.deadline : undefined, uploadedAt: file?.uploadedAt ?? (n === versionsOf(p) ? p.submittedAt : null) };
  };
  // Papers still to clear come first, cleared ones last; by ID within each.
  const clearOf = (p: ChairPaper) => (screeningStageOf({ ...p, screening: { ...p.screening, ...Object.fromEntries(Object.entries(local).filter(([k]) => k.startsWith(`${p.dbId}:`)).map(([k, v]) => [k.split(":")[1], v])) } }, data.screening) === "clear" ? 1 : 0);
  const papers = data.papers.filter((p) => !p.withdrawn && p.outcome !== "upload_pending").sort((a, b) => clearOf(a) - clearOf(b) || numericId(a, b)).map((p) => ({ p, count: versionsOf(p) }));
  const latestOf = (x: { p: ChairPaper; count: number }) => view(x.p, x.count);
  const idq = f.id.trim().toLowerCase(); const tq = f.title.trim().toLowerCase();
  const shown = papers.filter((x) => {
    const v = latestOf(x);
    return (!idq || `${x.p.id} v${x.count}`.toLowerCase().includes(idq))
      && (!tq || `${x.p.title} ${x.p.track}`.toLowerCase().includes(tq))
      && (f.submitted === "all" || submittedBucket(v.uploadedAt) === f.submitted)
      && yesNo(f.editable, !!v.check.editable) && yesNo(f.english, !!v.check.english)
      && (f.column === "all" || v.check.column === f.column)
      && (f.length === "all" || (f.length === "out" ? v.length === "short" || v.length === "long" : v.length === f.length))
      && (f.decision === "all" || v.check.decision === f.decision)
      && (f.email === "all" || (f.email === "sent" ? !!v.sentAt : f.email === "overdue" ? isOverdue(v.deadline) : EMAILED.includes(v.check.decision) && !v.sentAt));
  });
  const matching = new Set(shown.map((x) => x.p.dbId));
  const byId = new Map(papers.map((x) => [x.p.dbId, x]));
  const list = idSort.sort(frozen ? frozen.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)) : shown, (x) => x.p.id);
  const isMoved = (p: ChairPaper) => !!frozen && !matching.has(p.dbId);
  const movedCount = list.filter((x) => isMoved(x.p)).length;
  const freeze = () => setFrozen((ids) => ids ?? shown.map((x) => x.p.dbId));
  const counts = Object.fromEntries(CHECK_DECISIONS.map((d) => [d.key, papers.filter((x) => latestOf(x).check.decision === d.key).length]));
  const toSend = papers.filter((x) => { const v = latestOf(x); return EMAILED.includes(v.check.decision) && !v.sentAt; }).length;
  const overdue = papers.filter((x) => isOverdue(latestOf(x).deadline)).length;
  const filtersOn = JSON.stringify(f) !== JSON.stringify(FILTERS0);
  const setF = (k: keyof typeof FILTERS0) => (v: string) => { setFiltersState({ ...f, [k]: v }); setFrozen(null); setSelected([]); };
  const clearFilters = () => { setFiltersState(FILTERS0); setFrozen(null); setSelected([]); };

  // Selection: every listed paper whose newest version can still be changed here.
  const selectable = (p: ChairPaper) => !inPeerReview(p);
  const visibleSelectable = list.filter((x) => selectable(x.p)).map((x) => x.p.dbId);
  const allSelected = visibleSelectable.length > 0 && visibleSelectable.every((id) => selected.includes(id));
  const someSelected = visibleSelectable.some((id) => selected.includes(id));
  const pick = range({ ids: visibleSelectable, isSelected: (id) => selected.includes(id), setMany: (ids, on) => setSelected((l) => (on ? [...new Set([...l, ...ids])] : l.filter((x) => !ids.includes(x)))) });

  const persist = (p: ChairPaper, n: number, rec: ScreeningRecord, now = false) => {
    const k = key(p, n);
    setLocal((l) => ({ ...l, [k]: rec }));
    clearTimeout(timers.current[k]);
    const save = async () => {
      // The automatic check lives with the file, not in the chair's record.
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
  const edit = (p: ChairPaper, n: number, patch: Partial<ScreeningCheck>) => { freeze(); void persist(p, n, withCheckPatch(recOf(p, n), fileOf(p, n)?.auto ?? null, criteria, patch)); };
  const decide = (p: ChairPaper, n: number, decision: string, confirmed = false) => {
    const rec = recOf(p, n);
    // Taking a paper back from the plagiarism stage resets its plagiarism decision: ask first.
    if (!confirmed && checkDecisionOf(rec) === "passed" && decision !== "passed" && (rec?.outcome || rec?.report)) { setReopen({ paper: p, n, decision }); return; }
    freeze();
    const base = confirmed ? withOutcome(rec, "pending") : rec;
    void persist(p, n, withCheckPatch(base, fileOf(p, n)?.auto ?? null, criteria, { decision }));
    if (decision === "passed") setToast({ title: `${p.id} passed the initial check`, text: data.screening.plagiarism ? "It's now in Plagiarism check." : "Reviewers can now be assigned." });
    if (decision === "revision") setToast({ title: "Decision saved", text: `Send the email so the author of ${p.id} knows what to fix.` });
    if (decision === "reject") setToast({ title: "Decision saved", text: `Send the email to tell the author of ${p.id}.` });
  };

  // Bulk: work out what would happen, show it, then apply.
  const planBulk = (decision: DecisionMeta) => {
    const picked = selected.map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
    const locked = picked.filter((x) => !selectable(x.p));
    const same = picked.filter((x) => selectable(x.p) && latestOf(x).check.decision === decision.key);
    const todo = picked.filter((x) => selectable(x.p) && latestOf(x).check.decision !== decision.key);
    const reset = todo.filter((x) => { const r = recOf(x.p, x.count); return checkDecisionOf(r) === "passed" && decision.key !== "passed" && (r?.outcome || r?.report); });
    const failing = decision.key === "passed" ? todo.filter((x) => latestOf(x).failing.length) : [];
    const notes = [
      same.length && `${same.length} already ${same.length === 1 ? "is" : "are"} ${decision.label} — left as they are.`,
      locked.length && `${locked.length} ${locked.length === 1 ? "is" : "are"} in peer review — skipped.`,
      reset.length && `${reset.length} already ${reset.length === 1 ? "has" : "have"} a plagiarism decision or report — it will be reset to No Decision (report files are kept).`,
      failing.length && `${failing.length} ${failing.length === 1 ? "has" : "have"} failing checks (${failing.slice(0, 4).map((x) => x.p.id).join(", ")}${failing.length > 4 ? "…" : ""}) — they'll pass anyway.`,
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
      todo.forEach((x) => { const r = recOf(x.p, x.count); const reset = checkDecisionOf(r) === "passed" && decision.key !== "passed" && (r?.outcome || r?.report); void persist(x.p, x.count, withCheckPatch(reset ? withOutcome(r, "pending") : r, fileOf(x.p, x.count)?.auto ?? null, criteria, { decision: decision.key })); });
      setToast({ title: `${todo.length} paper${todo.length === 1 ? "" : "s"} set to ${decision.label}`, text: EMAILED.includes(decision.key) ? "Send each author the email from the Send Email column." : "" });
      return;
    }
    // Each author gets the standard email for their own paper: its own problems.
    setBusy({ label: `Sending ${todo.length} email${todo.length === 1 ? "" : "s"} to the authors…`, hint: "Each author is emailed and notified about their own paper. Please don't close or refresh the page." });
    let failed = 0;
    for (const x of todo) {
      try {
        const r = recOf(x.p, x.count);
        const reset = checkDecisionOf(r) === "passed" && decision.key !== "passed" && (r?.outcome || r?.report);
        let rec = withCheckPatch(reset ? withOutcome(r, "pending") : r, fileOf(x.p, x.count)?.auto ?? null, criteria, { decision: decision.key });
        const problems = evaluateCheck(rec.check as ScreeningCheck & { decision: string }, criteria).filter((i) => !i.ok && i.problem).map((i) => i.problem);
        rec = { ...rec, check: { ...rec.check, emailedAt: at } };
        if (decision.key === "revision") rec.correction = { reasons: problems, note: "", deadline, at, by: "Conference Chair", emailedAt: at };
        await persist(x.p, x.count, rec, true);
        await sendActionEmails("screening_notified", { submissionId: x.p.dbId, version: x.count, stage: decision.key === "reject" ? "reject" : "correction", coAuthors: false });
      } catch { failed += 1; }
    }
    setBusy(null);
    setToast(failed ? { title: `${todo.length - failed} of ${todo.length} authors emailed`, text: `${failed} could not be emailed: send those from the Send Email column.` } : { title: `${todo.length} paper${todo.length === 1 ? "" : "s"} set to ${decision.label}`, text: `All ${todo.length} author${todo.length === 1 ? " was" : "s were"} emailed and notified.` });
  };

  const send = async ({ note, deadline, co, kind, subject, body }: ScreeningSendInput) => {
    if (!draft) return;
    const x = byId.get(draft.paper.dbId);
    if (!x) return;
    const v = latestOf(x);
    freeze();
    setBusy({ label: "Sending the email to the author…", hint: "The author is emailed and notified. Please don't close or refresh the page." }); setError("");
    try {
      const at = todayLabel();
      const problems = v.failing.filter((i) => i.problem).map((i) => i.problem);
      const rec: ScreeningRecord = { ...(v.rec ?? {}), check: { ...v.check, comment: note, emailedAt: at } };
      if (v.check.decision === "revision") rec.correction = { reasons: problems, note, deadline, at, by: "Conference Chair", emailedAt: at };
      await persist(x.p, x.count, rec, true);
      const mail = await sendActionEmails("screening_notified", { submissionId: x.p.dbId, version: x.count, stage: v.check.decision === "reject" ? "reject" : "correction", coAuthors: co, kind, subject, body });
      setToast({ title: "Email sent", text: mail ?? `The author of ${x.p.id} was emailed and notified${co ? ", plus the co-authors" : ""}.` });
      setDraft(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); } finally { setBusy(null); }
  };
  const toggleRow = (id: string) => setOpen((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const openFile = async (p: ChairPaper, n: number, download: boolean) => {
    const file = fileOf(p, n);
    if (!file?.storagePath) { setToast({ title: "No file to open", text: "This version's file isn't stored here." }); return; }
    try { const url = await (await getChairService()).fileUrl(file.storagePath, download ? file.name : undefined); window.open(url, "_blank", "noopener"); } catch (err) { setToast({ title: "Couldn't open the file", text: err instanceof Error ? err.message : "Something went wrong." }); }
  };
  const checkHref = (p: ChairPaper) => `/chair/${e}/initial-check/${encodeURIComponent(p.id)}`;

  const row = (p: ChairPaper, n: number, count: number) => {
    const latest = n === count;
    // Reviewers assigned: the initial check is final — change things from Peer Review instead.
    const locked = latest && inPeerReview(p);
    const v = view(p, n);
    const { check } = v;
    const colWrong = !v.colOk;
    const lenWrong = v.length === "short" || v.length === "long";
    const isSel = latest && selected.includes(p.dbId);
    const emailable = EMAILED.includes(check.decision);
    return (
      <tr
        key={`${p.dbId}-${n}`}
        onClick={(ev) => { if (latest && count > 1 && !isControl(ev.target)) toggleRow(p.dbId); }}
        {...(latest ? pick.row(p.dbId) : {})}
        style={{ background: !latest ? "var(--canvas)" : isSel ? "var(--primary-soft)" : isMoved(p) ? "#FFFBEB" : "#FFFFFF", cursor: latest && count > 1 ? "pointer" : "default" }}
        className="[&>td]:border-b [&>td]:border-line [&>td]:px-3 [&>td]:py-4 [&>td]:align-middle hover:[&>td]:bg-[#FAFAFF]"
      >
        <td className="text-center">{latest && !locked && <SelectBox label={`Select ${p.id}`} checked={isSel} {...pick.box(p.dbId)} />}</td>
        <td><IdCell paper={p} n={n} latest={latest} count={count} open={open.has(p.dbId)} onToggle={() => toggleRow(p.dbId)} onOpenCheck={() => router.push(checkHref(p))} /></td>
        <td><TitleCell paper={p} latest={latest} onOpenDetails={() => router.push(chairPaperHref(slug, p.id))} onOpenPdf={() => void openFile(p, n, false)} onDownload={() => void openFile(p, n, true)} onOpenCheck={latest ? () => router.push(checkHref(p)) : null} /></td>
        <td><SubmittedCell at={v.uploadedAt} n={n} />{latest && <AutoStatus auto={v.auto} doubleBlind={doubleBlind} />}</td>
        {latest && !locked ? (
          <>
            <td className="text-center"><YesNoSwitch label="PDF Editable" on={!!check.editable} onChange={(x) => edit(p, n, { editable: x })} /><AutoTag auto={v.auto} field="editable" check={check} /></td>
            <td className="text-center"><YesNoSwitch label="English" on={!!check.english} onChange={(x) => edit(p, n, { english: x })} /><AutoTag auto={v.auto} field="english" check={check} /></td>
            <td>
              <select value={check.column} aria-label={`Layout for ${p.id}`} onChange={(ev) => edit(p, n, { column: ev.target.value as "single" | "double" })} title={colWrong ? `This conference requires ${criteria.column} column` : ""} style={{ ...CELL_INPUT_ST, ...(colWrong ? RED_ST : {}) }} className={`${CELL_INPUT} w-full cursor-pointer font-semibold`}>{COLUMN_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
              {colWrong && <CellHint bad>Needs {criteria.column}</CellHint>}
              <AutoTag auto={v.auto} field="column" check={check} />
            </td>
            <td className="text-center">
              <input type="number" min={1} inputMode="numeric" value={check.pages ?? ""} placeholder="—" aria-label={`Page count for ${p.id}`} onChange={(ev) => edit(p, n, { pages: ev.target.value })} title={`${check.column === "double" ? "Double" : "Single"} column: ${v.range.min}–${v.range.max} pages`} style={{ ...CELL_INPUT_ST, ...(lenWrong ? RED_ST : {}) }} className={`${CELL_INPUT} w-14 text-center font-semibold tabular-nums`} />
              {/* The range follows the Column cell: switch Single/Double and it changes. */}
              <CellHint bad={lenWrong}>{v.length === "short" ? "Too short · " : v.length === "long" ? "Too long · " : ""}{v.range.min}–{v.range.max}</CellHint>
              <AutoTag auto={v.auto} field="pages" check={check} />
            </td>
            <td>
              <DecisionSelect label={`Decision for ${p.id}`} value={check.decision} options={CHECK_DECISIONS} onChange={(d) => decide(p, n, d)} />
              {check.autoSet && <div title="The system decided this from the paper's own check. You can change it." className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary"><Sparkles size={11} aria-hidden="true" /> Set automatically</div>}
              <DecisionWarning decision={check.decision} failing={v.failing} lengthBlank={v.length === "blank"} />
              {isMoved(p) && <MovedNote />}
            </td>
          </>
        ) : (
          <>
            <td className="text-center"><YesNoText on={!!check.editable} /></td>
            <td className="text-center"><YesNoText on={!!check.english} /></td>
            <td><PlainText>{check.column === "double" ? "Double Column" : "Single Column"}</PlainText></td>
            <td className="text-center"><PlainText>{String(check.pages ?? "").trim() || "—"}</PlainText></td>
            <td><DecisionChip value={check.decision} options={CHECK_DECISIONS} />{locked && <LockNote />}</td>
          </>
        )}
        <td className="text-center">
          {latest && !locked
            ? <EmailCell enabled={emailable} sentAt={v.sentAt} deadline={v.deadline} disabledHint="Set the decision to Revision or Reject first" onSend={() => { setError(""); setDraft({ paper: p, n }); }} />
            : v.sentAt
              ? <div className="flex flex-col items-center gap-1"><span className="text-xs text-ink-faint">Sent · {v.sentAt}</span>{latest && <DueLine deadline={v.deadline} />}</div>
              : <span className="text-xs text-ink-faint">—</span>}
        </td>
      </tr>
    );
  };

  const draftRow = draft ? byId.get(draft.paper.dbId) : null;
  const draftView = draftRow ? latestOf(draftRow) : null;
  return shell(
    <div className="px-8 pb-8 pt-5">
      <ScreeningSearchParam onSearch={(id) => { setFiltersState({ ...FILTERS0, id }); setFrozen(null); setSelected([]); }} />
      <Toolbar
        filtersOn={filtersOn} onClear={clearFilters} moved={movedCount} onRefresh={() => setFrozen(null)}
        summary={(
          <>
            <SummaryChip label="All" count={papers.length} color="var(--navy)" bg="var(--muted)" active={!filtersOn} onClick={clearFilters} />
            {CHECK_DECISIONS.map((d) => <SummaryChip key={d.key} label={d.label} count={counts[d.key] ?? 0} color={d.color} bg={d.bg} active={f.decision === d.key} onClick={() => setF("decision")(f.decision === d.key ? "all" : d.key)} />)}
            {toSend > 0 && <SummaryChip label="Email to Send" count={toSend} color="var(--primary)" bg="var(--primary-soft)" active={f.email === "due"} onClick={() => setF("email")(f.email === "due" ? "all" : "due")} />}
            {overdue > 0 && <SummaryChip label="Overdue" count={overdue} color="var(--danger)" bg="var(--danger-soft)" active={f.email === "overdue"} onClick={() => setF("email")(f.email === "overdue" ? "all" : "overdue")} />}
          </>
        )}
      >
        <span className="hidden items-center gap-1 text-[11px] text-ink-faint 2xl:inline-flex"><Info size={12} aria-hidden="true" /> Requires {criteria.column === "either" ? "any" : criteria.column} column · single {criteria.minPages}–{criteria.maxPages} pages · double {criteria.doubleMinPages}–{criteria.doubleMaxPages} pages</span>
      </Toolbar>
      <BulkBar count={selected.length} options={CHECK_DECISIONS} onPick={planBulk} onClear={() => setSelected([])} />
      <TableFrame minWidth={1440} empty={list.length === 0 ? (papers.length ? "No paper matches these filters." : "No submitted papers yet.") : null}>
        <thead>
          <tr>
            <Th label="" className="w-[44px]"><div className="flex h-7 items-center justify-center"><SelectBox label="Select all listed papers" checked={allSelected} indeterminate={someSelected && !allSelected} disabled={!visibleSelectable.length} onChange={(on) => setSelected(on ? [...new Set([...selected, ...visibleSelectable])] : selected.filter((id) => !visibleSelectable.includes(id)))} /></div></Th>
            <Th label={<IdSortLabel label="ID" dir={idSort.dir} onToggle={idSort.toggle} />} className="w-[128px]"><FilterText value={f.id} onChange={setF("id")} placeholder="Search ID" /></Th>
            <Th label="Title" className="w-[340px]"><FilterText value={f.title} onChange={setF("title")} placeholder="Search title" /></Th>
            <Th label="Submitted" className="w-[130px]" info={"When this version was uploaded. A resubmitted version (V2, V3…) shows its own upload date."}><FilterSelect label="Submitted" value={f.submitted} onChange={setF("submitted")} options={SUBMITTED_OPTIONS} /></Th>
            <Th label="PDF Editable" className="w-[110px]" align="center" info={"Checks whether the PDF is editable — its text can be selected and copied.\nNO = a scanned or image-only PDF, which iThenticate can't check."}><FilterSelect label="PDF Editable" value={f.editable} onChange={setF("editable")} options={YES_NO} /></Th>
            <Th label="English" className="w-[110px]" align="center" info="Is the paper written in English — title, abstract and body?"><FilterSelect label="English" value={f.english} onChange={setF("english")} options={YES_NO} /></Th>
            <Th label="Paper Layout" className="w-[140px]" info={`Identifies the paper's column format, so the correct page limit is applied. This conference requires ${criteria.column === "either" ? "either layout" : `${criteria.column} column`}; red = a different layout.\nChanging it also changes the allowed page count.`}><FilterSelect label="Paper Layout" value={f.column} onChange={setF("column")} options={[["all", "All"], ["single", "Single Column"], ["double", "Double Column"]]} /></Th>
            <Th label="Page Count" className="w-[120px]" align="center" info={`The total number of pages in the submitted PDF. The allowed range depends on the layout:\nSingle column ${criteria.minPages}–${criteria.maxPages} pages\nDouble column ${criteria.doubleMinPages}–${criteria.doubleMaxPages} pages\nRed = outside the range for the selected layout.`}><FilterSelect label="Page Count" value={f.length} onChange={setF("length")} options={[["all", "All"], ["ok", "In range"], ["out", "Out of range"], ["blank", "Not set"]]} /></Th>
            <Th label="Decision" className="w-[150px]" tip="right" info={decisionInfo(CHECK_DECISIONS)}><FilterSelect label="Decision" value={f.decision} onChange={setF("decision")} options={[["all", "All"], ...CHECK_DECISIONS.map((d): [string, string] => [d.key, d.label])]} /></Th>
            <Th label="Send Email" className="w-[170px]" align="center" tip="right" info={"Active when the decision is Revision or Reject. Opens a ready email with the paper ID, title, what to fix and the initial check report.\nAfter sending, the due date for the new version shows here — red once it's overdue — with Send again."}><FilterSelect label="Send Email" value={f.email} onChange={setF("email")} options={EMAIL_OPTIONS} /></Th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ p, count }) => (
            <Fragment key={p.dbId}>
              {row(p, count, count)}
              {open.has(p.dbId) && Array.from({ length: count - 1 }, (_, i) => row(p, count - 1 - i, count))}
            </Fragment>
          ))}
        </tbody>
      </TableFrame>
      <Dialog open={draft !== null} onClose={() => { if (!busy) setDraft(null); }} title={`Email the Author — Initial Check ${draftView?.check.decision === "reject" ? "Rejection" : "Revision"}`} description={draft && draftRow ? `${draft.paper.id} · V${draftRow.count} · ${draft.paper.title}` : undefined} size="xl">
        {draft && draftRow && draftView ? <SendDialog key={draft.paper.dbId} paper={draftRow.p} n={draftRow.count} check={draftView.check} problems={draftView.failing.filter((i) => i.problem).map((i) => i.problem)} defaultDue={inDays(criteria.correctionDays)} slug={slug} acronym={conference.acronym} confName={conference.name} items={evaluateCheck(draftView.check, criteria)} sent={Boolean(draftView.sentAt)} onClose={() => setDraft(null)} onSend={(input) => void send(input)} busy={busy !== null} error={error} /> : null}
      </Dialog>
      {reopen && <ReopenModal paper={reopen.paper} n={reopen.n} rec={recOf(reopen.paper, reopen.n)} decision={reopen.decision} onClose={() => setReopen(null)} onConfirm={() => { const r = reopen; setReopen(null); decide(r.paper, r.n, r.decision, true); }} />}
      {bulk && <BulkConfirmModal key={bulk.decision.key} emailable={EMAILED.includes(bulk.decision.key)} defaultDue={toIsoDay(inDays(criteria.correctionDays))} decision={bulk.decision} total={bulk.total} change={bulk.todo.length} notes={bulk.notes} onConfirm={(o) => void applyBulk(o)} onClose={() => setBulk(null)} />}
      <LoadingOverlay open={busy !== null} label={busy?.label} hint={busy?.hint} />
    </div>,
  );
}
