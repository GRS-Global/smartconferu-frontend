"use client";

import { ClipboardCheck, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import type { ScreeningCriteria } from "@/types/chair";
import { useConferenceSettings } from "../use-conference-settings";
import { EmailsPanel, SUBMISSION_EMAILS } from "./policy-cards";
import { SubmissionSettingsPanel } from "./submission-settings-panel";

/* Conference Settings › Submissions: Paper Screening (which steps run and their limits — the prototype's ScreeningSettingsCard, kept in
   `conferences.settings.screening`, the record its Initial Check and Plagiarism pages read), the Tracks authors submit to (`tracks`) and
   the submission types they choose from (`conference_settings`, migration 0028). Not ported yet: the submission form editor and the
   rest of the prototype's Submission Settings (guidelines, deadlines on the Call for Papers) — they open in the prototype. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const LABEL = "mb-1 block text-xs font-bold text-ink-soft";
const CELL = "h-9 w-full rounded-md border-[1.5px] border-line bg-white px-2 text-xs text-ink outline-none focus:border-primary disabled:bg-canvas disabled:text-ink-faint";
type Msg = { title: string; text: string };


function Screening({ initial, steps, onSave, busy }: { initial: ScreeningCriteria; steps: { initialCheck: boolean; plagiarism: boolean }; onSave: (s: { initialCheck: boolean; plagiarism: boolean; criteria: ScreeningCriteria }) => void; busy: boolean }) {
  const [on, setOn] = useState(steps);
  const [c, setC] = useState({ column: initial.column, min: String(initial.minPages), max: String(initial.maxPages), dmin: String(initial.doubleMinPages), dmax: String(initial.doubleMaxPages), sim: String(initial.similarityLimit), ai: String(initial.aiLimit), cdays: String(initial.correctionDays), rdays: String(initial.revisionDays) });
  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const bad = (v: string, min = 0) => !Number.isFinite(n(v)) || n(v) < min || n(v) > 1000;
  const problems = {
    min: bad(c.min, 1), max: bad(c.max, 1) || n(c.min) > n(c.max), dmin: bad(c.dmin, 1), dmax: bad(c.dmax, 1) || n(c.dmin) > n(c.dmax),
  };
  const ok = !Object.values(problems).some(Boolean);
  const num = (id: string, label: string, key: keyof typeof c, p: boolean, disabled = false) => (
    <div><label htmlFor={id} className={LABEL}>{label}</label><input id={id} type="number" min={0} value={c[key]} disabled={disabled} aria-invalid={p} onChange={(e) => setC({ ...c, [key]: e.target.value })} onBlur={flush} className={`${CELL} tabular-nums ${p ? "!border-danger" : ""}`} /></div>
  );
  const stepRows: Array<{ key: "initialCheck" | "plagiarism"; icon: typeof ClipboardCheck; label: string; desc: string }> = [
    { key: "initialCheck", icon: ClipboardCheck, label: "Initial Check", desc: "Check every new version: editable, in English, column layout and page count — before it goes to iThenticate." },
    { key: "plagiarism", icon: ShieldCheck, label: "Plagiarism Check", desc: "Upload the iThenticate report (up to 2 files), decide, and email the author when a revision is needed. Reviewers can be assigned once it's clear." },
  ];
  // The prototype saves each change as it is made: the toggles at once, a number when its box is left.
  const payload = () => ({ initialCheck: on.initialCheck, plagiarism: on.plagiarism, criteria: { column: c.column as ScreeningCriteria["column"], minPages: n(c.min), maxPages: n(c.max), doubleMinPages: n(c.dmin), doubleMaxPages: n(c.dmax), similarityLimit: n(c.sim), aiLimit: n(c.ai), correctionDays: n(c.cdays), revisionDays: n(c.rdays) } });
  const saved = useRef(JSON.stringify(payload()));
  const flush = () => { const now = JSON.stringify(payload()); if (ok && now !== saved.current) { saved.current = now; onSave(payload()); } };
  const toggleStep = (k: "initialCheck" | "plagiarism", v: boolean) => { const next = { ...on, [k]: v }; setOn(next); saved.current = JSON.stringify({ ...payload(), initialCheck: next.initialCheck, plagiarism: next.plagiarism }); onSave({ ...payload(), initialCheck: next.initialCheck, plagiarism: next.plagiarism }); };
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      <h3 className="text-base font-extrabold text-navy">Paper Screening</h3>
      <p className="mb-4 mt-0.5 text-sm text-ink-muted">Each step you turn on gets its own menu in the sidebar. With both off, papers go straight to peer review.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {stepRows.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className={`flex items-start gap-3 rounded-xl border-[1.5px] p-4 ${on[s.key] ? "border-[var(--primary-soft-border)] bg-primary-soft" : "border-line bg-white"}`}>
              <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on[s.key] ? "bg-white text-primary" : "bg-canvas text-ink-faint"}`}><Icon size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-navy">{s.label}</span><span className="mt-0.5 block text-xs text-ink-muted">{s.desc}</span></span>
              <button type="button" role="switch" aria-checked={on[s.key]} aria-label={`${s.label} menu`} disabled={busy} onClick={() => toggleStep(s.key, !on[s.key])} style={{ background: on[s.key] ? "var(--success)" : "var(--border-strong)" }} className="relative mt-1 h-[22px] w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-60"><span style={{ transform: `translateX(${on[s.key] ? 20 : 2}px)` }} className="absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform" /></button>
            </div>
          );
        })}
      </div>
      <div style={{ opacity: on.initialCheck ? 1 : 0.55 }} className="mt-3 rounded-xl border-[1.5px] border-line bg-white p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-faint"><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-navy">Auto initial check</span><span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-bold text-warning"><Lock size={10} aria-hidden="true" /> Paid feature</span></div>
            <p className="mt-0.5 text-xs text-ink-muted">The system decides the initial check for every new paper, so you only handle the exceptions: a paper that meets every requirement passes by itself; one that doesn&apos;t is dealt with as chosen below. You can still change any decision.</p>
          </div>
          <button type="button" role="switch" aria-checked={false} aria-label="Auto initial check" disabled style={{ background: "var(--border-strong)" }} className="relative mt-1 h-[22px] w-10 shrink-0 cursor-not-allowed rounded-full opacity-60 transition-colors"><span style={{ transform: "translateX(2px)" }} className="absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform" /></button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div><label htmlFor="sc-col" className={LABEL}>Required Layout</label><select id="sc-col" value={c.column} disabled={!on.initialCheck} onChange={(e) => setC({ ...c, column: e.target.value as ScreeningCriteria["column"] })} onBlur={flush} className={`${CELL} cursor-pointer disabled:cursor-not-allowed`}><option value="single">Single column</option><option value="double">Double column</option><option value="either">Either</option></select></div>
        {num("sc-min", "Single Column · Min Pages", "min", problems.min, !on.initialCheck)}
        {num("sc-max", "Single Column · Max Pages", "max", problems.max, !on.initialCheck)}
        {num("sc-dmin", "Double Column · Min Pages", "dmin", problems.dmin, !on.initialCheck)}
        {num("sc-dmax", "Double Column · Max Pages", "dmax", problems.dmax, !on.initialCheck)}
      </div>
      {!ok && <p role="alert" className="mt-3 text-xs font-medium text-danger">Check the numbers: a minimum can&apos;t be above its maximum.</p>}
    </section>
  );
}

export function SubmissionSettingsPage({ slug }: { slug: string }) {
  const { state, retry, reload } = useConferenceSettings(slug);
  const [busy, setBusy] = useState<"" | "screening" | "tracks" | "types" | "period" | "numbering" | "guidelines">("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const gate = workspaceGate(state, retry, { title: "Submissions", loadingLabel: "Loading the submission settings", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the submission settings." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, data, settings, info } = state;
  const e = encodeURIComponent(conference.id);
  const run = async (which: "screening" | "tracks" | "types" | "period" | "numbering" | "guidelines", job: () => Promise<void>, done: Msg) => {
    setBusy(which); setError("");
    try { await job(); setToast(done); reload(); } catch (err) { setError(err instanceof AuthRequiredError ? "Your session ended — please sign in again." : err instanceof Error ? err.message : "Something went wrong."); } finally { setBusy(""); }
  };
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="settings/submissions" screening={data.screening}>
      <PageHeader title="Submissions" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }, { label: "Submissions", strong: true }]} />
      <div className="hd-page p-8">
        <div id="ss-screening" data-tour="ss-screening" className="mb-6 scroll-mt-24"><Screening key={`s-${JSON.stringify(data.criteria)}-${data.screening.initialCheck}-${data.screening.plagiarism}`} initial={data.criteria} steps={data.screening} busy={busy === "screening"} onSave={(s) => void run("screening", () => getChairService().then((x) => x.saveScreeningSetup(slug, s)), { title: "Screening saved", text: "The sidebar and the screening pages follow it." })} /></div>
        <SubmissionSettingsPanel
          slug={slug} acronym={conference.acronym} received={data.papers.length} lastNumber={Math.max(0, ...data.papers.map((p) => Number(/(\d+)$/.exec(p.id)?.[1] ?? 0)))} settings={settings} deadline={info?.submissionDeadline ?? ""} detailsHref={`/chair/${e}/settings`}
          before={<>
            {error && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          </>}
          below={<>
            <EmailsPanel id="ss-emails" title="Submission period emails" desc="Sent automatically around the submission window — nobody has to click anything." items={SUBMISSION_EMAILS} href={`/chair/${e}/settings/email-templates`} slug={slug} conferenceName={conference.name} acronym={conference.acronym} backLabel="Submission settings" />
          </>}
          extraSections={[{ id: "ss-emails", label: "Submission period emails", meta: `${SUBMISSION_EMAILS.length} automatic emails`, children: SUBMISSION_EMAILS.flatMap((x) => (x.key ? [{ id: `ss-emails-${x.key}`, label: x.name }] : [])) }]}
          links={[
            { label: "Submission Form", desc: "Configure the fields authors complete", href: `/chair/${e}/manage` },
          ]}
        />
      </div>
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
