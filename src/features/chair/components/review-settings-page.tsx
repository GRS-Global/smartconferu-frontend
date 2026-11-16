"use client";

import { AlertTriangle, Calendar, Clock, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import type { InstructionsPdf, ConferenceSettings, ReviewLimits, ReviewMode, ReviewPolicy, ReviewSetup, ReviewTimeline } from "@/types/chair";
import { useConferenceSettings } from "../use-conference-settings";
import { FormEditor, InstructionsEditor } from "./review-form-editor";
import { EmailsPanel, RECRUITMENT_EMAILS, REVIEW_EMAILS, VisibilityCard } from "./policy-cards";
import { SectionsRail } from "./sections-rail";
import { HelpLabel } from "./setting-label";
import { ReviewTimelineEditor } from "./review-timeline-strip";

/* Conference Settings › Review: the review period and timeline (how many days a reviewer has, the two automatic reminders; kept in
   `conferences.settings.reviewTimeline`, which the daily reminder job reads) and the reviewer limits (reviewers per paper, a
   reviewer's paper limit, double-blind; `conference_settings`, migration 0028). The Peer Review list reads the reviewers-per-paper
   target from here. Not ported: the review form and reviewer instructions editor (they go with the forms in the next settings step). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
// The reviewing-period fields in the prototype use their own label: 12 px / 600, --text-muted, 6 px below, with a red required "*".
const DATE_BOX = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary";
const when = (v: string) => (v ? new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const reminderWhen = (days: number) => (Number(days) === 0 ? "on the last day" : `${days} day${Number(days) === 1 ? "" : "s"} before`);
const PERIOD_LABEL = "mb-1.5 block text-xs font-semibold text-ink-muted";
const int = (v: string) => (v.trim() === "" ? NaN : Number(v));

function Card({ id, icon: Icon, title, desc, children, footer }: { id?: string; icon: typeof Clock; title: string; desc: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section id={id} data-tour={id?.replace("rs-period", "rv-window").replace(/^rs-/, "rv-")} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={15} aria-hidden="true" /></span><h3 className="text-sm font-bold text-navy">{title}</h3></div></div>
      <p className="-mt-1 mb-4 text-xs text-ink-faint">{desc}</p>
      {children}
      {footer && <div className="mt-5 flex flex-wrap items-center justify-end gap-3">{footer}</div>}
    </section>
  );
}

/** Reviewing period: From / To. Picking a start moves the end with it when the end would fall on or before it (the prototype's rule), and a period that ends
 *  before it starts is not saved. */
function PeriodCard({ tl, onChange }: { tl: ReviewTimeline; onChange: (patch: Partial<ReviewTimeline>) => void }) {
  const bad = tl.opensAt && tl.closesAt && tl.closesAt <= tl.opensAt ? "The review period must end after it starts." : "";
  const onOpens = (value: string) => {
    if (!value || (tl.closesAt && tl.closesAt > value)) { onChange({ opensAt: value }); return; }
    const span = tl.opensAt && tl.closesAt && tl.closesAt > tl.opensAt ? new Date(tl.closesAt).getTime() - new Date(tl.opensAt).getTime() : 7 * 24 * 3600 * 1000;
    const end = new Date(new Date(value).getTime() + span);
    const pad = (x: number) => String(x).padStart(2, "0");
    onChange({ opensAt: value, closesAt: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}` });
  };
  return (
    <Card id="rs-period" icon={Calendar} title="Reviewing period" desc="When reviewers can open and submit reviews. Also sets the &quot;Reviews due&quot; date reviewers see.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="rs-opens" className={PERIOD_LABEL}>From <span className="text-danger">*</span></label><input id="rs-opens" type="datetime-local" value={tl.opensAt} onChange={(e) => onOpens(e.target.value)} className={DATE_BOX} /></div>
        <div><label htmlFor="rs-closes" className={PERIOD_LABEL}>To <span className="text-danger">*</span></label><input id="rs-closes" type="datetime-local" value={tl.closesAt} min={tl.opensAt || undefined} onChange={(e) => onChange({ closesAt: e.target.value })} aria-invalid={Boolean(bad)} className={`${DATE_BOX} ${bad ? "!border-danger" : ""}`} /></div>
      </div>
      {bad && <p role="alert" className="mt-2 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {bad}</p>}
    </Card>
  );
}

/** Reviewer assignment: how many reviewers a paper gets and the most papers one reviewer can carry (saved as you change them). */
function AssignmentCard({ lim, stored, onChange }: { lim: ReviewLimits; stored: boolean; onChange: (patch: Partial<ReviewLimits>) => void }) {
  const [per, setPer] = useState(String(lim.reviewersPerPaper));
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (wait.current) clearTimeout(wait.current); }, []);
  const n = int(per);
  const bad = !Number.isInteger(n) || n < 1 || n > 20 ? "Use 1 to 20 reviewers." : "";
  const typed = (v: string) => {
    setPer(v);
    if (wait.current) clearTimeout(wait.current);
    const x = int(v);
    if (Number.isInteger(x) && x >= 1 && x <= 20) wait.current = setTimeout(() => onChange({ reviewersPerPaper: x }), 600);
  };
  const row = "flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3.5";
  const max = lim.maxPapersPerReviewer;
  return (
    <Card id="rs-assignment" icon={Users} title="Reviewer assignment" desc="Controls how many reviewers each submission gets, and how much load any one reviewer can carry.">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={row}>
          <div><div className="flex items-center gap-1.5 text-sm font-medium text-ink"><HelpLabel help="reviewersPerPaper">Number of reviewers per paper</HelpLabel></div><div className="mt-0.5 text-xs text-ink-faint">How many reviewers get assigned to each submission by default.</div>{bad && <p role="alert" className="mt-1 text-xs font-medium text-danger">{bad}</p>}</div>
          <input type="number" min={1} max={20} value={per} onChange={(e) => typed(e.target.value)} aria-label="Number of reviewers per paper" aria-invalid={Boolean(bad)} className="w-20 shrink-0 rounded-lg border border-line px-3 py-2 text-right text-sm text-ink outline-none focus:border-primary" />
        </div>
        <div className={row}>
          <div><div className="flex items-center gap-1.5 text-sm font-medium text-ink"><HelpLabel help="maxPapersPerReviewer">Maximum papers per reviewer</HelpLabel></div><div className="mt-0.5 text-xs text-ink-faint">Caps how many submissions any single reviewer can be assigned.</div></div>
          {/* 1–10, or no limit. A larger value saved earlier stays selectable until it is changed. */}
          <select aria-label="Maximum papers per reviewer" value={max ?? ""} onChange={(e) => onChange({ maxPapersPerReviewer: e.target.value ? Number(e.target.value) : null })} className="w-28 shrink-0 cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary">
            <option value="">No limit</option>
            {max !== null && max > 10 && <option value={max}>{max}</option>}
            {Array.from({ length: 10 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>
      {!stored && <p className="mt-3 text-xs font-semibold text-warning">Run migration 0028_conference_settings.sql to save the two limits.</p>}
    </Card>
  );
}

type Which = "timeline" | "limits" | "instructions" | "form" | "visibility";

/** The save state the editors share: which one is busy, the last error and the toast that says it was saved. */
function useReviewSave(reload: () => void) {
  const [busy, setBusy] = useState<"" | Which>("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const run = async (which: Which, job: () => Promise<void>, done: FlowToastData) => {
    setBusy(which); setError("");
    try { await job(); setToast(done); reload(); } catch (e) { setError(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(""); }
  };
  return { busy, error, toast, closeToast, run };
}

type Loaded = { slug: string; conferenceId: string; conferenceName: string; acronym: string; settings: ConferenceSettings; setup: ReviewSetup; reload: () => void };

/** The review settings and the form editors, with the rail on the right (the prototype's ReviewSettingsPanel): the Conference Settings › Review page
 *  and the Settings tab of Peer Review › Manage show the same one. Like the prototype, the period, timeline, limits and visibility save as soon as they change. */
export function ReviewSettingsPanel({ slug, conferenceId, conferenceName, acronym, settings, setup, reload, withForm = true, links, backLabel = "Review settings" }: Loaded & { withForm?: boolean; links?: Array<{ label: string; desc: string; href: string }>; /** Where "Edit template" says Back leads (this page). */ backLabel?: string }) {
  const { busy, error, toast, closeToast, run } = useReviewSave(reload);
  const e = encodeURIComponent(conferenceId);
  // The values on screen are the newest saved ones (kept here, so the rail and the cards agree without reloading the page).
  const [tl, setTl] = useState(settings.timeline);
  const [lim, setLim] = useState(settings.limits);
  const [pol, setPol] = useState(settings.review);
  const tlRef = useRef(tl); const limRef = useRef(lim); const polRef = useRef(pol);
  const [status, setStatus] = useState<"" | "saving" | "saved">("");
  const [problem, setProblem] = useState("");
  const persist = async (job: () => Promise<void>) => {
    setStatus("saving"); setProblem("");
    try { await job(); setStatus("saved"); } catch (err) { setStatus(""); setProblem(err instanceof AuthRequiredError ? "Your session ended — please sign in again." : err instanceof Error ? err.message : "Something went wrong."); throw err; }
  };
  const saveTl = (patch: Partial<ReviewTimeline>) => {
    tlRef.current = { ...tlRef.current, ...patch }; setTl(tlRef.current);
    const next = tlRef.current;
    // An unfinished period (From without To, or To before From) stays on screen but is not saved.
    if (next.opensAt && next.closesAt && next.closesAt <= next.opensAt) return Promise.resolve();
    return persist(async () => { await (await getChairService()).saveReviewTimeline(slug, next); });
  };
  const saveLim = (patch: Partial<ReviewLimits>) => {
    limRef.current = { ...limRef.current, ...patch }; setLim(limRef.current);
    const next = limRef.current;
    return persist(async () => { await (await getChairService()).saveReviewLimits(slug, next); }).catch(() => undefined);
  };
  const savePol = (p: ReviewPolicy, m: ReviewMode) => {
    polRef.current = p; setPol(p);
    const modeChanged = m !== limRef.current.reviewMode;
    if (modeChanged) { limRef.current = { ...limRef.current, reviewMode: m }; setLim(limRef.current); }
    return persist(async () => { const svc = await getChairService(); await svc.saveReviewPolicy(slug, p); if (modeChanged) await svc.saveReviewLimits(slug, limRef.current); }).catch(() => undefined);
  };
  const emails = `/chair/${e}/settings/email-templates`;
  return (
    <>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative min-w-0 space-y-5">
        {(error || problem) && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error || problem}</p>}
        <div aria-live="polite" className="pointer-events-none absolute -top-5 right-0 h-4 text-right text-[11px] font-semibold text-ink-faint">{status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : ""}</div>
        <PeriodCard tl={tl} onChange={(patch) => void saveTl(patch).catch(() => undefined)} />
        <Card id="rs-timeline" icon={Clock} title="Review timeline" desc="How many days each reviewer gets, and the two automatic reminders that nudge reviewers who haven't submitted yet.">
          <ReviewTimelineEditor timeline={tl} emailsHref={emails} onSave={saveTl} />
        </Card>
        <AssignmentCard lim={lim} stored={settings.stored} onChange={(patch) => void saveLim(patch)} />
        <VisibilityCard initial={pol} mode={lim.reviewMode} fields={setup.form.flatMap((sec) => sec.fields)} onChange={(p, m) => void savePol(p, m)} />
        <div id="rs-instructions" data-tour="rv-instructions" className="scroll-mt-24 space-y-3">
          <InstructionsEditor key={`i-${setup.instructions}-${settings.stored}`} initial={setup.instructions} stored={settings.stored} busy={busy === "instructions"} mode={setup.instructionsMode} pdf={setup.instructionsPdf} onSave={(t) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructions(slug, t)), { title: "Instructions saved", text: t.trim() ? "Reviewers read your text." : "Reviewers read the standard text." })} onMode={(m) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructionsMode(slug, m)), { title: "Instructions saved", text: m === "pdf" ? "Reviewers read the attached PDF." : "Reviewers read your written instructions." })} onPdf={async (file) => { let out: InstructionsPdf | undefined; await run("instructions", async () => { out = await (await getChairService()).saveReviewInstructionsPdf(slug, file); }, { title: "PDF attached", text: "Reviewers can download it from their review page." }); return out; }} />
        </div>
        {withForm && <div id="rs-form" className="scroll-mt-24"><FormEditor key={`f-${JSON.stringify(setup.form)}-${setup.custom}-${settings.stored}`} initial={setup.form} custom={setup.custom} stored={settings.stored} busy={busy === "form"} onSave={(f) => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, f)), { title: "Review form saved", text: "Reviewers fill in this form from now on." })} onReset={() => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, null)), { title: "Standard form back", text: "Reviewers fill in the standard form." })} /></div>}
        <EmailsPanel id="rs-recruit" title="Reviewer recruitment reminders" desc="Sent automatically after reviewers are added — nobody has to click anything." items={RECRUITMENT_EMAILS} href={emails} slug={slug} conferenceName={conferenceName} acronym={acronym} backLabel={backLabel} backHref={`/chair/${e}/settings/review`} />
        <EmailsPanel id="rs-emails" title="Review period emails" desc="Reminders and alerts the system sends while reviews are due, overdue or complete." items={REVIEW_EMAILS} href={emails} slug={slug} conferenceName={conferenceName} acronym={acronym} backLabel={backLabel} backHref={`/chair/${e}/settings/review`} />
        </div>
        <SectionsRail sections={[
          { id: "rs-period", label: "Reviewing period", meta: tl.opensAt || tl.closesAt ? `${when(tl.opensAt)} – ${when(tl.closesAt)}` : "Not set" },
          { id: "rs-timeline", label: "Review timeline", meta: `${tl.reviewDays} days · reminders ${[tl.reminder1Enabled && reminderWhen(tl.reminder1Days), tl.reminder2Enabled && reminderWhen(tl.reminder2Days)].filter(Boolean).join(" and ") || "off"}` },
          { id: "rs-assignment", label: "Reviewer assignment", meta: `${lim.reviewersPerPaper} per paper · ${lim.maxPapersPerReviewer ? `max ${lim.maxPapersPerReviewer} per reviewer` : "no reviewer limit"}` },
          { id: "rs-visibility", label: "Review & Visibility", meta: [lim.reviewMode === "double_blind" ? "Double-blind" : "Authors visible", pol.unassignedAccess ? "all submissions" : "own papers only", pol.hiddenFields.length ? `${pol.hiddenFields.length} field${pol.hiddenFields.length > 1 ? "s" : ""} hidden` : null].filter(Boolean).join(" · ") },
          { id: "rs-instructions", label: "Reviewer instructions", meta: setup.instructionsMode === "pdf" ? (setup.instructionsPdf ? "PDF uploaded" : "Not set") : setup.instructions.trim() ? "Written" : "Standard text" },
          ...(withForm ? [{ id: "rs-form", label: "Review form", meta: setup.custom ? "Your own form" : "Standard form" }] : []),
          { id: "rs-recruit", label: "Reviewer recruitment reminders", meta: `${RECRUITMENT_EMAILS.length} automatic emails`, children: RECRUITMENT_EMAILS.flatMap((x) => (x.key ? [{ id: `rs-recruit-${x.key}`, label: x.name }] : [])) },
          { id: "rs-emails", label: "Review period emails", meta: `${REVIEW_EMAILS.length} automatic emails`, children: REVIEW_EMAILS.flatMap((x) => (x.key ? [{ id: `rs-emails-${x.key}`, label: x.name }] : [])) },
        ]} links={links ?? [
          { label: "Reviewers & PC", desc: "Invite reviewers, see current load", href: `/chair/${e}/peer-review/reviewers` },
          { label: "Review Form", desc: "The rubric reviewers fill out per paper", href: `/chair/${e}/peer-review/manage` },
        ]} />
        </div>
      <FlowToast toast={toast} onClose={closeToast} />
    </>
  );
}

/** The instructions and the review form editors, in place on Peer Review › Manage › Form ("Edit form"); Done goes back to the preview. */
export function ReviewFormEditors({ slug, settings, setup, reload, onDone }: Omit<Loaded, "conferenceId" | "conferenceName" | "acronym"> & { onDone: () => void }) {
  const { busy, error, toast, closeToast, run } = useReviewSave(reload);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Change what reviewers read and fill in. Each part has its own save.</p>
        <Button variant="outline" onClick={onDone}>Done</Button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <InstructionsEditor key={`i-${setup.instructions}-${settings.stored}`} initial={setup.instructions} stored={settings.stored} busy={busy === "instructions"} mode={setup.instructionsMode} pdf={setup.instructionsPdf} onSave={(t) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructions(slug, t)), { title: "Instructions saved", text: t.trim() ? "Reviewers read your text." : "Reviewers read the standard text." })} onMode={(m) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructionsMode(slug, m)), { title: "Instructions saved", text: m === "pdf" ? "Reviewers read the attached PDF." : "Reviewers read your written instructions." })} onPdf={async (file) => { let out: InstructionsPdf | undefined; await run("instructions", async () => { out = await (await getChairService()).saveReviewInstructionsPdf(slug, file); }, { title: "PDF attached", text: "Reviewers can download it from their review page." }); return out; }} />
      <FormEditor key={`f-${JSON.stringify(setup.form)}-${setup.custom}-${settings.stored}`} initial={setup.form} custom={setup.custom} stored={settings.stored} busy={busy === "form"} onSave={(f) => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, f)), { title: "Review form saved", text: "Reviewers fill in this form from now on." })} onReset={() => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, null)), { title: "Standard form back", text: "Reviewers fill in the standard form." })} />
      <FlowToast toast={toast} onClose={closeToast} />
    </div>
  );
}

export function ReviewSettingsPage({ slug }: { slug: string }) {
  const { state, retry, reload } = useConferenceSettings(slug);
  const gate = workspaceGate(state, retry, { title: "Review", loadingLabel: "Loading the review settings", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the review settings." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, data, settings, setup } = state;
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="settings/review" screening={data.screening}>
      <PageHeader title="Review" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }, { label: "Review", strong: true }]} />
      <div className="hd-page p-8 [&.hd-page]:!p-8">
        <ReviewSettingsPanel slug={slug} conferenceId={conference.id} conferenceName={conference.name} acronym={conference.acronym} settings={settings} setup={setup} reload={reload} withForm={false} />
      </div>
    </ConferenceShell>
  );
}
