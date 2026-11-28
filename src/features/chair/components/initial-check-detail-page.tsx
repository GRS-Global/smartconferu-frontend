"use client";

import { AlertTriangle, Calendar, Check, ClipboardCheck, Download, Eye, FileText, Hash, Settings2, Sparkles, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/load-more";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { HeroButton, HeroChip, PageHero } from "@/features/workspace/components/hero";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import type { ChairPaper, ScreeningFile } from "@/types/chair";
import { CHECK_DECISIONS, COLUMN_OPTIONS, EMAILED, checkOf, columnOk, evaluateCheck, inDays, lengthState, pageRange, todayLabel, withCheckPatch, withOutcome } from "../screening";
import { checkDecisionOf, inPeerReview, screeningStageOf } from "../stage";
import { useChairConference } from "../use-chair-conference";
import { useScreeningSave } from "../use-screening-save";
import { ReopenModal, SendDialog } from "./initial-check-page";
import type { ScreeningSendInput } from "./screening-email-form";
import { CheckRow, PaperNav, SectionCard, VersionActions } from "./screening-detail-ui";
import { chairPaperHref } from "@/lib/routes";
import { STICKY_SIDE_XL } from "@/components/layout/sticky-side";
import {
  AutoTag, Btn, CARD, CELL_INPUT, CELL_INPUT_ST, DecisionChip, DecisionSelect, DecisionWarning, EmailCell, LoadingOverlay, LockNote, MISSING_LABEL, PlainText, RED_ST, ScreeningSettingsButton, ScreeningToast, SentNote, YesNoSwitch, YesNoText, daysAgo,
  type ScreeningToastData,
} from "./screening-ui";

/* One paper's own Initial Check page (the prototype's InitialCheckDetailPage): the checks and what the PDF showed, the decision, the email to
   the author and every version's result. It is the same record as the table row, so a change here shows there and the other way round.
   The email is an editable draft (screening-email-form.tsx). Difference kept on purpose: the automatic initial check is a
   paid-plan feature with no setting in the database. */

export function InitialCheckDetailPage({ slug, paperLabel }: { slug: string; paperLabel: string }) {
  const router = useRouter();
  const { state, retry, reload } = useChairConference(slug, { files: true, settings: true });
  const [draft, setDraft] = useState(false);
  const [reopen, setReopen] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ label: string; hint: string } | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ScreeningToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const onError = useCallback((title: string, text: string) => setToast({ title, text }), []);
  const { recOf, persist } = useScreeningSave(onError, reload);

  const gate = workspaceGate(state, retry, { title: "Initial Check", loadingLabel: "Loading the initial check", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the initial check." });
  if (gate || state.status !== "ready" || !state.files) return gate;
  const { conference, roles, others, data, files } = state;
  const { criteria } = data;
  const doubleBlind = state.settings?.limits.reviewMode === "double_blind";
  const e = encodeURIComponent(conference.id);
  const listHref = `/chair/${e}/initial-check`;
  const settingsHref = `/chair/${e}/settings/submissions`;
  const crumbs = (last?: string) => [{ label: "My Conferences", href: "/dashboard" }, { label: "Initial Check", href: listHref }, ...(last ? [{ label: last }] : [])];
  const shell = (title: string, body: ReactNode) => (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="screening/initial-check" screening={data.screening}>
      <PageHeader title={title} breadcrumbs={title === "Initial Check" ? [{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }] : crumbs(title)} actions={<ScreeningSettingsButton href={settingsHref} />} />
      {body}
      <ScreeningToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
  if (!data.screening.initialCheck) {
    return shell("Initial Check", <div className="p-8"><div style={CARD} className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-14 text-center"><h2 className="text-base font-bold text-navy">Initial Check is turned off for this conference</h2><p className="mb-4 mt-1 text-sm text-ink-muted">Turn it on in Conference Settings › Submissions › Paper Screening.</p><a href={`/chair/${e}/settings/submissions`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white"><Settings2 size={14} aria-hidden="true" /> Open Screening Settings</a></div></div>);
  }
  const paper = data.papers.find((p) => p.id === paperLabel && !p.withdrawn && p.outcome !== "upload_pending");
  if (!paper) {
    return shell("Initial Check", <div className="p-8"><div style={CARD} className="mx-auto max-w-xl rounded-2xl bg-white px-6 py-14 text-center"><h2 className="text-base font-bold text-navy">This paper isn&apos;t in the initial check</h2><p className="mb-4 mt-1 text-sm text-ink-muted">It hasn&apos;t been submitted yet, or it was withdrawn.</p><Btn primary onClick={() => router.push(listHref)}>Back to Initial Check</Btn></div></div>);
  }

  const versionsOf = (p: ChairPaper) => Math.max(p.versions, (files[p.dbId] ?? []).length, 1);
  const fileOf = (p: ChairPaper, n: number): ScreeningFile | null => (files[p.dbId] ?? []).find((x) => x.n === n) ?? null;
  const count = versionsOf(paper);
  const n = count; // the newest version is the one being checked
  const rec = recOf(paper, n);
  const file = fileOf(paper, n);
  const auto = file?.auto ?? null;
  const check = checkOf(rec, auto, criteria);
  const length = lengthState(check, criteria);
  const failing = evaluateCheck(check, criteria).filter((i) => !i.ok);
  const range = pageRange(criteria, check.column);
  const colWrong = !columnOk(check, criteria);
  const lenWrong = length === "short" || length === "long";
  const locked = inPeerReview(paper);
  const decisionMeta = CHECK_DECISIONS.find((d) => d.key === check.decision) ?? CHECK_DECISIONS[0];
  const problems = failing.filter((i) => i.problem).map((i) => i.problem);
  const sentAt = EMAILED.includes(check.decision) ? (check.emailedAt || rec?.correction?.emailedAt || null) : null;
  const deadline = check.decision === "revision" ? rec?.correction?.deadline : undefined;
  const missing = (auto?.missing ?? []).filter((k) => !(doubleBlind && (k === "author_names" || k === "affiliations"))).map((k) => MISSING_LABEL[k] ?? k);
  const lowConfidence = (["column", "english"] as const).filter((f) => auto?.status === "done" && !check.edited?.[f] && auto?.confidence?.[f] === "low");

  // The papers the table lists, in its order: for Previous / Next.
  const clearOf = (p: ChairPaper) => (screeningStageOf({ ...p, screening: { ...p.screening, [String(versionsOf(p))]: recOf(p, versionsOf(p)) ?? {} } }, data.screening) === "clear" ? 1 : 0);
  const queue = data.papers.filter((p) => !p.withdrawn && p.outcome !== "upload_pending").sort((a, b) => clearOf(a) - clearOf(b) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const at = queue.findIndex((p) => p.id === paper.id);
  const prev = at > 0 ? queue[at - 1].id : null;
  const next = at >= 0 && at < queue.length - 1 ? queue[at + 1].id : null;

  const edit = (patch: Parameters<typeof withCheckPatch>[3]) => { void persist(paper, n, withCheckPatch(rec, auto, criteria, patch)); };
  const decide = (decision: string, confirmed = false) => {
    // Taking a paper back from the plagiarism stage resets its plagiarism decision: ask first.
    if (!confirmed && checkDecisionOf(rec) === "passed" && decision !== "passed" && (rec?.outcome || rec?.report)) { setReopen(decision); return; }
    void persist(paper, n, withCheckPatch(confirmed ? withOutcome(rec, "pending") : rec, auto, criteria, { decision }));
    if (decision === "passed") setToast({ title: `${paper.id} passed the initial check`, text: data.screening.plagiarism ? "It's now in Plagiarism check." : "Reviewers can now be assigned." });
    if (decision === "revision") setToast({ title: "Decision saved", text: `Send the email so the author of ${paper.id} knows what to fix.` });
    if (decision === "reject") setToast({ title: "Decision saved", text: `Send the email to tell the author of ${paper.id}.` });
  };
  const send = async ({ note, deadline: dueLabel, co, kind, subject, body }: ScreeningSendInput) => {
    setBusy({ label: "Sending the email to the author…", hint: "The author is emailed and notified. Please don't close or refresh the page." }); setError("");
    try {
      const at2 = todayLabel();
      const nextRec = { ...(rec ?? {}), check: { ...check, comment: note, emailedAt: at2 } };
      if (check.decision === "revision") nextRec.correction = { reasons: problems, note, deadline: dueLabel, at: at2, by: "Conference Chair", emailedAt: at2 };
      await persist(paper, n, nextRec, true);
      const mail = await sendActionEmails("screening_notified", { submissionId: paper.dbId, version: n, stage: check.decision === "reject" ? "reject" : "correction", coAuthors: co, kind, subject, body });
      setToast({ title: "Email sent", text: mail ?? `The author of ${paper.id} was emailed and notified${co ? ", plus the co-authors" : ""}.` });
      setDraft(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); } finally { setBusy(null); }
  };
  const openFile = async (vn: number, download: boolean) => {
    const f = fileOf(paper, vn);
    if (!f?.storagePath) { setToast({ title: "No file to open", text: "This version's file isn't stored here." }); return; }
    try { window.open(await (await getChairService()).fileUrl(f.storagePath, download ? f.name : undefined), "_blank", "noopener"); } catch (err) { setToast({ title: "Couldn't open the file", text: err instanceof Error ? err.message : "Something went wrong." }); }
  };

  const layoutNeed = criteria.column === "either" ? "Single or double column" : `${criteria.column === "double" ? "Double" : "Single"} column`;
  const uploaded = file?.uploadedAt ?? paper.submittedAt;
  const ago = daysAgo(uploaded);
  const versions = Array.from({ length: count }, (_, i) => count - i); // newest first

  return shell(paper.id,
    <div className="p-8">
      <PaperNav backLabel="Initial Check" onBack={() => router.push(listHref)} at={at} total={queue.length} prev={prev} next={next} onGo={(id) => router.push(`${listHref}/${encodeURIComponent(id)}`)} />

      <div className="mb-5">
        <PageHero
          label="Initial check"
          tile={String(conference.acronym || "IC").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || <FileText size={34} aria-hidden="true" />}
          title={paper.title}
          badge={<span style={{ color: decisionMeta.color, background: decisionMeta.bg }} className="rounded-full px-3 py-1 text-xs font-bold">{decisionMeta.label}</span>}
          chips={(
            <>
              <HeroChip icon={Hash}>{paper.id}</HeroChip>
              <HeroChip icon={ClipboardCheck} tone="var(--primary)">V{n}{n > 1 ? " · resubmitted" : ""}</HeroChip>
              {paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}
              <HeroChip icon={Calendar}>Uploaded {uploaded || "—"}{ago !== null ? ` · ${ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}` : ""}</HeroChip>
            </>
          )}
          actions={(
            <>
              <HeroButton icon={FileText} onClick={() => router.push(chairPaperHref(conference.id, paper.id))} title="Abstract, authors, files and paper actions">Submission details</HeroButton>
              <HeroButton icon={Eye} onClick={() => void openFile(n, false)} title="Open this version's PDF">View PDF</HeroButton>
              <HeroButton icon={Download} primary onClick={() => void openFile(n, true)} title="Download this version">Download</HeroButton>
            </>
          )}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <SectionCard
            title="Initial check"
            hint={locked ? "Reviewers are assigned, so the initial check is final. Use Peer Review to change anything." : "Set each value from the PDF. The page range follows the paper's layout."}
            pad={false}
            action={failing.length
              ? <span style={{ color: "var(--danger-ink)", background: "var(--danger-soft)" }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"><AlertTriangle size={12} aria-hidden="true" /> {failing.length} need{failing.length === 1 ? "s" : ""} attention</span>
              : <span style={{ color: "var(--success-ink)", background: "var(--success-soft)" }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold"><Check size={12} strokeWidth={3} aria-hidden="true" /> All requirements met</span>}
          >
            <ul style={{ borderTop: "1px solid var(--border)" }} className="divide-y divide-line">
              <CheckRow state={check.editable ? "ok" : "bad"} title="PDF editable" need="Text can be selected and copied — a scanned or image-only PDF can't be checked for plagiarism." tag={<AutoTag auto={auto} field="editable" check={check} />}>
                {locked ? <YesNoText on={!!check.editable} /> : <YesNoSwitch label="PDF Editable" on={!!check.editable} onChange={(x) => edit({ editable: x })} />}
              </CheckRow>
              <CheckRow state={check.english ? "ok" : "bad"} title="English" need="Title, abstract and body are written in English." tag={<AutoTag auto={auto} field="english" check={check} />}>
                {locked ? <YesNoText on={!!check.english} /> : <YesNoSwitch label="English" on={!!check.english} onChange={(x) => edit({ english: x })} />}
              </CheckRow>
              <CheckRow state={colWrong ? "bad" : "ok"} title="Paper layout" need={`Required: ${layoutNeed}${colWrong ? ` — this paper is ${check.column === "double" ? "double" : "single"} column` : ""}`} tag={<AutoTag auto={auto} field="column" check={check} />}>
                {locked ? <PlainText>{check.column === "double" ? "Double Column" : "Single Column"}</PlainText> : (
                  <select value={check.column} onChange={(ev) => edit({ column: ev.target.value as "single" | "double" })} aria-label="Paper layout" style={{ ...CELL_INPUT_ST, ...(colWrong ? RED_ST : {}) }} className={`${CELL_INPUT} cursor-pointer font-semibold`}>{COLUMN_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                )}
              </CheckRow>
              <CheckRow
                state={length === "blank" ? "blank" : lenWrong ? "bad" : "ok"} title="Page count"
                need={`Required: ${range.min}–${range.max} pages (${check.column === "double" ? "double" : "single"} column)${length === "short" ? " — too short" : length === "long" ? " — too long" : length === "blank" ? " — not entered yet" : ""}`}
                tag={<AutoTag auto={auto} field="pages" check={check} />}
              >
                {locked ? <PlainText>{String(check.pages ?? "").trim() || "—"}</PlainText> : (
                  <input type="number" min={1} inputMode="numeric" value={check.pages ?? ""} placeholder="—" aria-label="Page count" onChange={(ev) => edit({ pages: ev.target.value })} style={{ ...CELL_INPUT_ST, ...(lenWrong ? RED_ST : {}) }} className={`${CELL_INPUT} w-20 text-center font-semibold tabular-nums`} />
                )}
              </CheckRow>
              {(check.other ?? []).map((o, i) => (
                <CheckRow key={o.key ?? i} state="bad" title={o.label} need={o.problem || "Marked as a problem by the chair"}><span className="text-xs font-bold text-danger-ink">Missing</span></CheckRow>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Read from the PDF" hint="What the system found when it read this version's PDF.">
            {!auto ? (
              <p className="text-sm text-ink-muted">The PDF hasn&apos;t been read.</p>
            ) : auto.status === "running" ? (
              <p className="inline-flex items-center gap-2 text-sm text-ink-muted"><Spinner size={14} /> Reading the PDF…</p>
            ) : auto.status === "failed" ? (
              <div style={{ background: "#FFF4E5", color: "#92400E" }} className="inline-flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm"><AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0" /> <span>The PDF couldn&apos;t be read{auto.error ? ` (${auto.error})` : ""}. Check its values by hand from the PDF.</span></div>
            ) : (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-ink"><Check size={14} strokeWidth={3} aria-hidden="true" /> The PDF was read and the values above were filled in from it.</div>
                {lowConfidence.length > 0 && (
                  <div style={{ background: "#FFF4E5", color: "#92400E" }} className="inline-flex w-full items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm"><AlertTriangle size={15} aria-hidden="true" className="mt-0.5 shrink-0" /> <span>Not certain about {lowConfidence.map((f) => (f === "column" ? "the layout" : "the language")).join(" and ")} — please check {lowConfidence.length > 1 ? "them" : "it"} in the PDF.</span></div>
                )}
                <div>
                  <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">Parts of the paper</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(MISSING_LABEL).filter(([k]) => !(doubleBlind && (k === "author_names" || k === "affiliations"))).map(([k, label]) => {
                      const gone = missing.includes(label);
                      return (
                        <span key={k} style={gone ? { color: "#B45309", background: "#FFF4E5" } : { color: "var(--success-ink)", background: "var(--success-soft)" }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold">
                          {gone ? <AlertTriangle size={11} aria-hidden="true" /> : <Check size={11} strokeWidth={3} aria-hidden="true" />} {label.charAt(0).toUpperCase() + label.slice(1)}{gone ? " — missing" : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Versions" hint={count > 1 ? `${count} versions uploaded — each had its own initial check.` : "Only one version has been uploaded."}>
            <ul style={{ border: "1px solid var(--border)" }} className="divide-y divide-line rounded-xl">
              {versions.map((vn) => {
                const vr = recOf(paper, vn);
                const dm = CHECK_DECISIONS.find((d) => d.key === checkDecisionOf(vr)) ?? CHECK_DECISIONS[0];
                const sent = vr?.check?.emailedAt || vr?.correction?.emailedAt;
                const vf = fileOf(paper, vn);
                return (
                  <li key={vn} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span style={{ background: vn === n ? "var(--primary-soft)" : "var(--muted)", color: vn === n ? "var(--primary)" : "var(--ink-muted)" }} className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-extrabold">V{vn}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{vf?.name ?? `${paper.id}_v${vn}.pdf`}</div>
                      <div className="text-[11px] text-ink-faint">Uploaded {vf?.uploadedAt || (vn === n ? paper.submittedAt : null) || "—"}{sent ? ` · email sent ${sent}` : ""}{vn === n ? " · latest" : ""}</div>
                    </div>
                    <span style={{ color: dm.color, background: dm.bg }} className="rounded-full px-2.5 py-1 text-[11.5px] font-bold">{dm.label}</span>
                    <VersionActions onView={() => void openFile(vn, false)} onDownload={() => void openFile(vn, true)} />
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>

        <div className={`min-w-0 space-y-5 ${STICKY_SIDE_XL}`}>
          <SectionCard title="Decision" hint="Only Revision and Reject are emailed to the author.">
            {locked ? (
              <><DecisionChip value={check.decision} options={CHECK_DECISIONS} /><div className="mt-2"><LockNote /></div></>
            ) : (
              <DecisionSelect label="Decision" value={check.decision} options={CHECK_DECISIONS} onChange={(d) => decide(d)} />
            )}
            <p className="mt-2.5 text-xs text-ink-muted">{decisionMeta.hint}</p>
            {check.autoSet && <div title="The system decided this from the paper's own check. You can change it." className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold text-primary"><Sparkles size={12} aria-hidden="true" /> Set automatically</div>}
            <DecisionWarning decision={check.decision} failing={failing} lengthBlank={length === "blank"} />
            {rec?.check?.at && <p className="mt-2.5 text-[11px] text-ink-faint">{check.autoSet ? "Set automatically" : `Decided by ${rec.check.by || "Conference Chair"}`} · {rec.check.at}</p>}
          </SectionCard>

          <SectionCard title="Email to the author">
            {EMAILED.includes(check.decision) ? (
              <>
                <div className="flex justify-center"><EmailCell enabled={!locked} sentAt={sentAt} deadline={deadline} disabledHint="Set the decision to Revision or Reject first" onSend={() => { setError(""); setDraft(true); }} /></div>
                {rec?.correction && <SentNote title={`Correction emailed ${rec.correction.emailedAt || rec.correction.at}${rec.correction.deadline ? ` · due ${rec.correction.deadline}` : ""}`} reasons={rec.correction.reasons} note={rec.correction.note} />}
                {!sentAt && problems.length > 0 && (
                  <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="mt-3 rounded-lg px-3.5 py-2.5 text-xs">
                    <div className="mb-1 font-bold text-navy">The email will say</div>
                    {problems.map((p) => <div key={p} className="text-ink-soft">• {p}</div>)}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">{check.decision === "pending" ? "Nothing to send yet — the author is emailed once you choose Revision or Reject." : `No email is needed for ${decisionMeta.label}.`}</p>
            )}
          </SectionCard>

          <SectionCard title="Requirements" hint="From Paper Screening settings." action={<a href={settingsHref} className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline"><Settings2 size={12} aria-hidden="true" /> Change</a>}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-ink-muted">Layout</dt><dd className="text-right font-semibold text-ink">{layoutNeed}</dd>
              <dt className="text-ink-muted">Single column</dt><dd className="text-right font-semibold text-ink">{criteria.minPages}–{criteria.maxPages} pages</dd>
              <dt className="text-ink-muted">Double column</dt><dd className="text-right font-semibold text-ink">{criteria.doubleMinPages}–{criteria.doubleMaxPages} pages</dd>
              <dt className="text-ink-muted">Language</dt><dd className="text-right font-semibold text-ink">English</dd>
            </dl>
          </SectionCard>
        </div>
      </div>

      <Dialog open={draft} onClose={() => { if (!busy) setDraft(false); }} title={`Email the Author — Initial Check ${check.decision === "reject" ? "Rejection" : "Revision"}`} description={`${paper.id} · V${n} · ${paper.title}`} size="xl">
        {draft && <SendDialog key={paper.dbId} paper={paper} n={n} check={check} problems={problems} defaultDue={inDays(criteria.correctionDays)} slug={slug} acronym={conference.acronym} confName={conference.name} items={evaluateCheck(check, criteria)} sent={Boolean(sentAt)} onClose={() => setDraft(false)} onSend={(input) => void send(input)} busy={busy !== null} error={error} />}
      </Dialog>
      {reopen && <ReopenModal paper={paper} n={n} rec={rec} decision={reopen} onClose={() => setReopen(null)} onConfirm={() => { const d = reopen; setReopen(null); decide(d, true); }} />}
      <LoadingOverlay open={busy !== null} label={busy?.label} hint={busy?.hint} />
    </div>,
  );
}
