"use client";

import { AlertTriangle, Calendar, Check, ChevronRight, ClipboardCheck, Clock, Download, Eye, FileText, Hash, Paperclip, Send, Settings2, ShieldCheck, Tag, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { HeroButton, HeroChip, PageHero } from "@/features/workspace/components/hero";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import type { ChairPaper, ScreeningFile, ScreeningRecord } from "@/types/chair";
import { CHECK_DECISIONS, EMAILED, MAX_REPORT_FILES, PLAG_DECISIONS, PLAG_REJECT_PROBLEM, PLAG_REVISION_PROBLEM, inDays, plagDecisionOf, reportFilesOf, todayLabel, withOutcome } from "../screening";
import { checkDecisionOf, inPeerReview, screeningStageOf } from "../stage";
import { useChairConference } from "../use-chair-conference";
import { useScreeningSave } from "../use-screening-save";
import { SendDialog } from "./plagiarism-check-page";
import type { ScreeningSendInput } from "./screening-email-form";
import { CheckRow, PaperNav, SectionCard, VersionActions } from "./screening-detail-ui";
import { chairPaperHref } from "@/lib/routes";
import {
  Btn, CARD, DecisionChip, DecisionSelect, DecisionWarning, EmailCell, LoadingOverlay, LockNote, ScreeningSettingsButton, ScreeningToast, SentNote, daysAgo, type ScreeningToastData,
} from "./screening-ui";

/* One paper's own Plagiarism Check page (the prototype's PlagiarismDetailPage): the iThenticate scores and report files, the decision, the
   email to the author and each version's result. Same record as the table row, so a change here shows there and the other way round.
   Differences kept on purpose: the prototype reads the scores from the uploaded report; here the chair types them (Similarity % / AI %), since
   nothing reads the report. The email is an editable draft (screening-email-form.tsx). */

export function PlagiarismDetailPage({ slug, paperLabel }: { slug: string; paperLabel: string }) {
  const router = useRouter();
  const { state, retry, reload } = useChairConference(slug, { files: true });
  const [draft, setDraft] = useState(false);
  const [busy, setBusy] = useState<{ label: string; hint: string } | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ScreeningToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const onError = useCallback((title: string, text: string) => setToast({ title, text }), []);
  const { recOf, persist } = useScreeningSave(onError, reload);

  const gate = workspaceGate(state, retry, { title: "Plagiarism Check", loadingLabel: "Loading the plagiarism check", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the plagiarism check." });
  if (gate || state.status !== "ready" || !state.files) return gate;
  const { conference, roles, others, data, files } = state;
  const { criteria } = data;
  const e = encodeURIComponent(conference.id);
  const listHref = `/chair/${e}/plagiarism`;
  const settingsHref = `/chair/${e}/settings/submissions`;
  const shell = (title: string, body: ReactNode) => (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="screening/plagiarism" screening={data.screening}>
      <PageHeader title={title} breadcrumbs={title === "Plagiarism Check" ? [{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }] : [{ label: "My Conferences", href: "/dashboard" }, { label: "Plagiarism Check", href: listHref }, { label: title }]} actions={<ScreeningSettingsButton href={settingsHref} />} />
      {body}
      <ScreeningToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
  if (!data.screening.plagiarism) {
    return shell("Plagiarism Check", <div className="p-8"><div style={CARD} className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-14 text-center"><h2 className="text-base font-bold text-navy">Plagiarism Check is turned off for this conference</h2><p className="mb-4 mt-1 text-sm text-ink-muted">Turn it on in Conference Settings › Submissions › Paper Screening.</p><a href={`/chair/${e}/settings/submissions`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white"><Settings2 size={14} aria-hidden="true" /> Open Screening Settings</a></div></div>);
  }
  const paper = data.papers.find((p) => p.id === paperLabel && !p.withdrawn && p.outcome !== "upload_pending");
  if (!paper) {
    return shell("Plagiarism Check", <div className="p-8"><div style={CARD} className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-14 text-center"><h2 className="text-base font-bold text-navy">This paper isn&apos;t in the plagiarism check</h2><p className="mb-4 mt-1 text-sm text-ink-muted">It hasn&apos;t been submitted yet, or it was withdrawn.</p><Btn primary onClick={() => router.push(listHref)}>Back to Plagiarism Check</Btn></div></div>);
  }

  const versionsOf = (p: ChairPaper) => Math.max(p.versions, (files[p.dbId] ?? []).length, 1);
  const fileOf = (p: ChairPaper, n: number): ScreeningFile | null => (files[p.dbId] ?? []).find((x) => x.n === n) ?? null;
  const passedCheck = (r: ScreeningRecord | undefined) => !data.screening.initialCheck || checkDecisionOf(r) === "passed";
  const view = (p: ChairPaper, n: number) => {
    const r = recOf(p, n);
    const latest = n === versionsOf(p);
    const reports = reportFilesOf(r);
    const decision = latest && plagDecisionOf(r) === "pending" && inPeerReview(p) ? "clear" : plagDecisionOf(r);
    return { rec: r, files: reports, has: reports.length > 0, waiting: !(latest && inPeerReview(p)) && !(passedCheck(r) || !!r?.report || !!r?.outcome), decision, sentAt: EMAILED.includes(decision) ? (r?.outcome?.emailedAt || null) : null, deadline: r?.outcome?.deadline };
  };
  const count = versionsOf(paper);
  const n = count; // the newest version is the one being checked
  const v = view(paper, n);
  const rec = v.rec;
  const locked = inPeerReview(paper);
  const editable = !v.waiting && !locked;
  const decisionMeta = PLAG_DECISIONS.find((d) => d.key === v.decision) ?? PLAG_DECISIONS[0];
  const initialMeta = CHECK_DECISIONS.find((d) => d.key === (locked && checkDecisionOf(rec) === "pending" ? "passed" : checkDecisionOf(rec))) ?? CHECK_DECISIONS[0];
  const reject = v.decision === "reject";
  const report = rec?.report ?? {};
  const score = (value: number | null | undefined, limit: number) => (typeof value === "number" ? { state: (value <= limit ? "ok" : "bad") as "ok" | "bad", text: `${value}% (limit ${limit}%)` } : { state: "blank" as const, text: `Not entered · limit ${limit}%` });
  const sim = score(report.similarity, criteria.similarityLimit);
  const ai = score(report.ai, criteria.aiLimit);
  const overLimit = [sim, ai].filter((x) => x.state === "bad").length;
  const hasScores = typeof report.similarity === "number" || typeof report.ai === "number";
  const waitingWhy = ({ revision: `V${n} went back to the author at the initial check — it isn't sent for plagiarism check.`, hold: `V${n} is on hold at the initial check.`, reject: `V${n} was rejected at the initial check.` } as Record<string, string>)[checkDecisionOf(rec)] ?? `V${n} is waiting for its initial check.`;

  // The papers the table lists in this step, in its order: for Previous / Next.
  const clearOf = (p: ChairPaper) => (screeningStageOf({ ...p, screening: { ...p.screening, [String(versionsOf(p))]: recOf(p, versionsOf(p)) ?? {} } }, data.screening) === "clear" ? 1 : 0);
  const inStep = (p: ChairPaper) => inPeerReview(p) || Array.from({ length: versionsOf(p) }, (_, i) => view(p, i + 1)).some((x) => !x.waiting);
  const queue = data.papers.filter((p) => !p.withdrawn && p.outcome !== "upload_pending").filter(inStep).sort((a, b) => clearOf(a) - clearOf(b) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const at = queue.findIndex((p) => p.id === paper.id);
  const prev = at > 0 ? queue[at - 1].id : null;
  const next = at >= 0 && at < queue.length - 1 ? queue[at + 1].id : null;

  const decide = (kind: string) => {
    void persist(paper, n, withOutcome(rec, kind));
    if (kind === "clear") setToast({ title: `${paper.id} is plagiarism clear`, text: "Reviewers can now be assigned." });
    if (kind === "revision") setToast({ title: "Decision saved", text: `Send the email so the author of ${paper.id} can revise.` });
    if (kind === "reject") setToast({ title: "Decision saved", text: `Send the email to tell the author of ${paper.id}.` });
  };
  const withReportPatch = (patch: NonNullable<ScreeningRecord["report"]>, paths?: Record<string, string>): ScreeningRecord => ({ ...(rec ?? {}), report: { similarity: null, ai: null, ...(rec?.report ?? {}), ...patch, at: todayLabel(), by: "Conference Chair" }, ...(paths ? { paths: { ...(rec?.paths ?? {}), ...paths } } : {}) });
  const setScore = (which: "similarity" | "ai", raw: string) => { const x = raw.trim() === "" ? null : Math.min(100, Math.max(0, Number(raw))); void persist(paper, n, withReportPatch({ [which]: Number.isFinite(x as number) ? x : null })); };
  const addReports = async (picked: File[]) => {
    const room = MAX_REPORT_FILES - v.files.length;
    if (room <= 0) return;
    setBusy({ label: "Uploading the report…", hint: "Storing it next to the paper." });
    try {
      const svc = await getChairService();
      const added: string[] = []; const paths: Record<string, string> = {};
      for (const f of picked.slice(0, room)) { const up = await svc.uploadScreeningReport(paper.dbId, f); if (!v.files.includes(up.name)) { added.push(up.name); paths[up.name] = up.path; } }
      const names = [...v.files, ...added];
      await persist(paper, n, withReportPatch({ files: names, file: names[0] ?? "" }, paths), true);
      if (picked.length > room) setToast({ title: `Only ${MAX_REPORT_FILES} report files per version`, text: `${picked.length - room} file${picked.length - room === 1 ? " was" : "s were"} not added.` });
    } catch (err) { setToast({ title: "Couldn't upload the report", text: err instanceof Error ? err.message : "Something went wrong." }); } finally { setBusy(null); }
  };
  const removeReport = (name: string) => { const names = v.files.filter((x) => x !== name); void persist(paper, n, withReportPatch({ files: names, file: names[0] ?? "" })); };
  const openReport = async (name: string) => {
    const path = rec?.paths?.[name];
    if (!path) { setToast({ title: "No stored file", text: "This report has no stored file to open." }); return; }
    try { window.open(await (await getChairService()).fileUrl(path, name), "_blank", "noopener"); } catch (err) { setToast({ title: "Couldn't open the file", text: err instanceof Error ? err.message : "Something went wrong." }); }
  };
  const openPaper = async (vn: number, download: boolean) => {
    const f = fileOf(paper, vn);
    if (!f?.storagePath) { setToast({ title: "No file to open", text: "This version's file isn't stored here." }); return; }
    try { window.open(await (await getChairService()).fileUrl(f.storagePath, download ? f.name : undefined), "_blank", "noopener"); } catch (err) { setToast({ title: "Couldn't open the file", text: err instanceof Error ? err.message : "Something went wrong." }); }
  };
  const send = async ({ note, deadline, share, co, kind, subject, body }: ScreeningSendInput) => {
    setBusy({ label: "Sending the email to the author…", hint: "The author is emailed and notified, with the plagiarism report. Please don't close or refresh the page." }); setError("");
    try {
      const out: ScreeningRecord = { ...(rec ?? {}) };
      out.outcome = { ...(out.outcome ?? { kind: v.decision }), reasons: [reject ? PLAG_REJECT_PROBLEM : PLAG_REVISION_PROBLEM], note, deadline, shareReport: share, emailedAt: todayLabel() };
      await persist(paper, n, out, true);
      const mail = await sendActionEmails("screening_notified", { submissionId: paper.dbId, version: n, stage: reject ? "reject" : "revision", coAuthors: co, kind, subject, body });
      setToast({ title: "Email sent", text: mail ?? `The author of ${paper.id} was emailed${share ? " with the plagiarism report" : ""}${co ? ", plus the co-authors" : ""}.` });
      setDraft(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); } finally { setBusy(null); }
  };

  const uploaded = fileOf(paper, n)?.uploadedAt ?? paper.submittedAt;
  const ago = daysAgo(uploaded);
  const versions = Array.from({ length: count }, (_, i) => count - i); // newest first
  const chooseFiles = (ev: React.ChangeEvent<HTMLInputElement>) => { const chosen = Array.from(ev.target.files ?? []); ev.target.value = ""; if (chosen.length) void addReports(chosen); };

  return shell(paper.id,
    <div className="p-8">
      <PaperNav backLabel="Plagiarism Check" onBack={() => router.push(listHref)} at={at} total={queue.length} prev={prev} next={next} onGo={(id) => router.push(`${listHref}/${encodeURIComponent(id)}`)} />

      <div className="mb-5">
        <PageHero
          label="Plagiarism check"
          tile={String(conference.acronym || "PC").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || <ShieldCheck size={34} aria-hidden="true" />}
          title={paper.title}
          badge={v.waiting
            ? <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-ink-muted">Waiting for initial check</span>
            : <span style={{ color: decisionMeta.color, background: decisionMeta.bg }} className="rounded-full px-3 py-1 text-xs font-bold">{decisionMeta.label}</span>}
          chips={(
            <>
              <HeroChip icon={Hash}>{paper.id}</HeroChip>
              <HeroChip icon={ShieldCheck} tone="var(--primary)">V{n}{n > 1 ? " · resubmitted" : ""}</HeroChip>
              {paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}
              <HeroChip icon={Calendar}>Uploaded {uploaded || "—"}{ago !== null ? ` · ${ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}` : ""}</HeroChip>
              {Boolean((rec?.ithenticate as { at?: string } | undefined)?.at) && <HeroChip icon={Send}>Sent to iThenticate {(rec?.ithenticate as { at: string }).at}</HeroChip>}
            </>
          )}
          actions={(
            <>
              <HeroButton icon={FileText} onClick={() => router.push(chairPaperHref(conference.id, paper.id))} title="Abstract, authors, files and paper actions">Submission details</HeroButton>
              <HeroButton icon={Eye} onClick={() => void openPaper(n, false)} title="Open this version's PDF">View PDF</HeroButton>
              <HeroButton icon={Download} primary onClick={() => void openPaper(n, true)} title="Download this version">Download</HeroButton>
            </>
          )}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {data.screening.initialCheck && (
            <SectionCard title="Initial check" hint="A paper reaches the plagiarism check once it passes the initial check." action={<button type="button" onClick={() => router.push(`/chair/${e}/initial-check/${encodeURIComponent(paper.id)}`)} className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline"><ClipboardCheck size={12} aria-hidden="true" /> Initial check details <ChevronRight size={12} aria-hidden="true" /></button>}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span style={{ color: initialMeta.color, background: initialMeta.bg }} className="rounded-full px-2.5 py-1 text-xs font-bold">{initialMeta.label}</span>
                <span className="text-xs text-ink-muted">{rec?.check?.at ? `${rec.check.by || "Conference Chair"} · ${rec.check.at}` : "No initial check decision yet."}</span>
              </div>
            </SectionCard>
          )}

          {v.waiting ? (
            <SectionCard title="iThenticate report">
              <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="inline-flex w-full items-start gap-2 rounded-xl px-3.5 py-3 text-sm text-ink-soft"><Clock size={15} aria-hidden="true" className="mt-0.5 shrink-0" /> <span>{waitingWhy} The plagiarism check starts once it passes.</span></div>
            </SectionCard>
          ) : (
            <>
              {(hasScores || editable) && (
                <SectionCard
                  title="Scores" hint="From the iThenticate report. The limits are set in Paper Screening settings." pad={false}
                  action={overLimit
                    ? <span style={{ color: "var(--danger)", background: "var(--danger-soft)" }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"><AlertTriangle size={12} aria-hidden="true" /> {overLimit} over the limit</span>
                    : hasScores ? <span style={{ color: "var(--success)", background: "var(--success-soft)" }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"><Check size={12} strokeWidth={3} aria-hidden="true" /> Within the limits</span> : null}
                >
                  <ul style={{ borderTop: "1px solid var(--border)" }} className="divide-y divide-line">
                    {([["Similarity", "similarity", sim, "How much of the paper matches existing sources.", criteria.similarityLimit], ["AI-generated text", "ai", ai, "How much of the paper is likely AI-written.", criteria.aiLimit]] as const).filter(([, field]) => editable || typeof report[field] === "number").map(([label, field, s, need, limit]) => (
                      <CheckRow key={field} state={s.state} title={label} need={`${need} Limit ${limit}%.`}>
                        {editable
                          ? <label className="flex items-center gap-1 text-xs font-semibold text-ink-muted">% <input type="number" min={0} max={100} aria-label={`${label} percent`} value={report[field] ?? ""} onChange={(ev) => setScore(field, ev.target.value)} style={{ border: "1.5px solid var(--border)", ...(s.state === "bad" ? { borderColor: "var(--danger)", color: "var(--danger)" } : {}) }} className="h-8 w-20 rounded-md bg-white px-2 text-center text-xs font-semibold tabular-nums outline-none" /></label>
                          : <span style={{ color: s.state === "bad" ? "var(--danger)" : "var(--ink)" }} className="text-sm font-bold tabular-nums">{report[field]}%</span>}
                      </CheckRow>
                    ))}
                  </ul>
                </SectionCard>
              )}

              <SectionCard title="Report files" hint={`Up to ${MAX_REPORT_FILES} PDF files from iThenticate (e.g. the similarity and the AI-writing report). They're attached to the email to the author.`}>
                <div className="space-y-2">
                  {v.files.map((name) => (
                    <span key={name} style={{ border: "1px solid var(--border)" }} className="flex w-full items-center gap-3 rounded-lg bg-white py-2 pl-3 pr-2">
                      <FileText size={15} aria-hidden="true" className="shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink" title={name}>{name}</span>
                      <VersionActions onView={() => void openReport(name)} onDownload={() => void openReport(name)} />
                      {editable && v.decision === "pending" && <button type="button" onClick={() => removeReport(name)} aria-label={`Remove ${name}`} title="Remove this file" className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-faint hover:bg-danger-soft hover:text-danger"><X size={15} aria-hidden="true" /></button>}
                    </span>
                  ))}
                  {editable && v.files.length < MAX_REPORT_FILES && (
                    <label style={{ border: "1.5px dashed var(--border-strong)" }} className="relative flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-soft hover:border-primary hover:text-primary">
                      <input type="file" accept=".pdf,application/pdf" multiple={MAX_REPORT_FILES - v.files.length > 1} aria-label="Upload report" className="sr-only" onChange={chooseFiles} />
                      <Upload size={15} aria-hidden="true" /> {v.files.length ? "Add another file" : "Upload report"} <span className="font-normal text-ink-faint">({v.files.length}/{MAX_REPORT_FILES})</span>
                    </label>
                  )}
                  {!editable && !v.files.length && <p className="text-sm text-ink-muted">No report was uploaded.</p>}
                </div>
              </SectionCard>
            </>
          )}

          <SectionCard title="Versions" hint={count > 1 ? `${count} versions uploaded — each had its own plagiarism check.` : "Only one version has been uploaded."}>
            <ul style={{ border: "1px solid var(--border)" }} className="divide-y divide-line rounded-xl">
              {versions.map((vn) => {
                const pv = view(paper, vn);
                const dm = PLAG_DECISIONS.find((d) => d.key === pv.decision) ?? PLAG_DECISIONS[0];
                const vf = fileOf(paper, vn);
                return (
                  <li key={vn} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span style={{ background: vn === n ? "var(--primary-soft)" : "var(--muted)", color: vn === n ? "var(--primary)" : "var(--ink-muted)" }} className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-extrabold">V{vn}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{vf?.name ?? `${paper.id}_v${vn}.pdf`}</div>
                      <div className="text-[11px] text-ink-faint">
                        Uploaded {vf?.uploadedAt || (vn === n ? paper.submittedAt : null) || "—"}
                        {typeof pv.rec?.report?.similarity === "number" ? ` · similarity ${pv.rec.report.similarity}%` : ""}
                        {pv.files.length ? ` · ${pv.files.length} report file${pv.files.length === 1 ? "" : "s"}` : ""}
                        {pv.sentAt ? ` · email sent ${pv.sentAt}` : ""}{vn === n ? " · latest" : ""}
                      </div>
                    </div>
                    {pv.waiting ? <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-bold text-ink-muted">Not in this step</span> : <span style={{ color: dm.color, background: dm.bg }} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold">{dm.label}</span>}
                    <VersionActions onView={() => void openPaper(vn, false)} onDownload={() => void openPaper(vn, true)} />
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-5 xl:sticky xl:top-4">
          <SectionCard title="Decision" hint="Only Revision and Reject are emailed to the author.">
            {v.waiting ? <p className="text-sm text-ink-muted">{waitingWhy}</p> : (
              <>
                {editable ? <DecisionSelect label="Decision" value={v.decision} options={PLAG_DECISIONS} onChange={decide} /> : <><DecisionChip value={v.decision} options={PLAG_DECISIONS} />{locked && <div className="mt-2"><LockNote /></div>}</>}
                <p className="mt-2.5 text-xs text-ink-muted">{decisionMeta.hint}</p>
                {!v.has && v.decision === "pending" && <div className="mt-1 text-[11px] text-ink-faint">Upload the report first</div>}
                <DecisionWarning decision={v.decision} noReport={!v.has} />
                {rec?.outcome?.at && <p className="mt-2.5 text-[11px] text-ink-faint">Decided by {rec.outcome.by || "Conference Chair"} · {rec.outcome.at}</p>}
              </>
            )}
          </SectionCard>

          <SectionCard title="Email to the author">
            {!v.waiting && EMAILED.includes(v.decision) ? (
              <>
                <div className="flex justify-center"><EmailCell enabled={editable} sentAt={v.sentAt} deadline={v.deadline} disabledHint="Set the decision to Revision or Reject first" onSend={() => { setError(""); setDraft(true); }} /></div>
                {rec?.outcome && ((rec.outcome.reasons?.length ?? 0) > 0 || rec.outcome.note || rec.outcome.emailedAt) && <SentNote title={rec.outcome.emailedAt ? `Emailed ${rec.outcome.emailedAt}${rec.outcome.deadline ? ` · due ${rec.outcome.deadline}` : ""}` : "Not emailed yet"} reasons={rec.outcome.reasons} note={rec.outcome.note} />}
                {v.has && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-muted"><Paperclip size={12} aria-hidden="true" /> The {v.files.length} report file{v.files.length === 1 ? "" : "s"} can be attached to the email.</p>}
              </>
            ) : (
              <p className="text-sm text-ink-muted">{v.waiting ? "Nothing to send yet." : v.decision === "pending" ? "Nothing to send yet — the author is emailed once you choose Revision or Reject." : `No email is needed for ${decisionMeta.label}.`}</p>
            )}
          </SectionCard>

          <SectionCard title="Limits" hint="From Paper Screening settings." action={<a href={settingsHref} className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline"><Settings2 size={12} aria-hidden="true" /> Change</a>}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-ink-muted">Similarity</dt><dd className="text-right font-semibold text-ink">up to {criteria.similarityLimit}%</dd>
              <dt className="text-ink-muted">AI-generated text</dt><dd className="text-right font-semibold text-ink">up to {criteria.aiLimit}%</dd>
            </dl>
          </SectionCard>
        </div>
      </div>

      <Dialog open={draft} onClose={() => { if (!busy) setDraft(false); }} title={`Email the Author — Plagiarism Check ${reject ? "Rejection" : "Revision"}`} description={`${paper.id} · V${n} · ${paper.title}`} size="xl">
        {draft && <SendDialog key={paper.dbId} paper={paper} n={n} reject={reject} hasReport={v.has} reportFiles={v.files} defaultDue={inDays(criteria.revisionDays)} slug={slug} acronym={conference.acronym} confName={conference.name} sent={Boolean(v.sentAt)} onClose={() => setDraft(false)} onSend={(input) => void send(input)} busy={busy !== null} error={error} />}
      </Dialog>
      <LoadingOverlay open={busy !== null} label={busy?.label} hint={busy?.hint} />
    </div>,
  );
}
