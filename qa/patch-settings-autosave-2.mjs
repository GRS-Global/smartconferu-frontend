// One-off edit helper (part 2): the Review settings panel saves by itself (reviewing period, timeline, limits, visibility), as the prototype's does.
import fs from "node:fs";
const file = "../src/features/chair/components/review-settings-page.tsx";
let s = fs.readFileSync(file, "utf8");

// ---- 1. the old Timeline / Limits cards (each with its own Save button) become the period card and the reviewer-assignment card
const a = s.indexOf("function Timeline(");
const b = s.indexOf("type Which =");
if (a < 0 || b < 0) { console.log("markers missing 1"); process.exit(1); }
const cards = `/** Reviewing period: From / To. Picking a start moves the end with it when the end would fall on or before it (the prototype's rule), and a period that ends
 *  before it starts is not saved. */
function PeriodCard({ tl, onChange }: { tl: ReviewTimeline; onChange: (patch: Partial<ReviewTimeline>) => void }) {
  const bad = tl.opensAt && tl.closesAt && tl.closesAt <= tl.opensAt ? "The review period must end after it starts." : "";
  const onOpens = (value: string) => {
    if (!value || (tl.closesAt && tl.closesAt > value)) { onChange({ opensAt: value }); return; }
    const span = tl.opensAt && tl.closesAt && tl.closesAt > tl.opensAt ? new Date(tl.closesAt).getTime() - new Date(tl.opensAt).getTime() : 7 * 24 * 3600 * 1000;
    const end = new Date(new Date(value).getTime() + span);
    const pad = (x: number) => String(x).padStart(2, "0");
    onChange({ opensAt: value, closesAt: \`\${end.getFullYear()}-\${pad(end.getMonth() + 1)}-\${pad(end.getDate())}T\${pad(end.getHours())}:\${pad(end.getMinutes())}\` });
  };
  return (
    <Card id="rs-period" icon={CalendarDays} title="Reviewing period" desc="When reviewers can open and submit reviews. Also sets the &quot;Reviews due&quot; date reviewers see.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="rs-opens" className={PERIOD_LABEL}>From <span className="text-danger">*</span></label><input id="rs-opens" type="datetime-local" value={tl.opensAt} onChange={(e) => onOpens(e.target.value)} className={INPUT_CLASS} /></div>
        <div><label htmlFor="rs-closes" className={PERIOD_LABEL}>To <span className="text-danger">*</span></label><input id="rs-closes" type="datetime-local" value={tl.closesAt} min={tl.opensAt || undefined} onChange={(e) => onChange({ closesAt: e.target.value })} aria-invalid={Boolean(bad)} className={\`\${INPUT_CLASS} \${bad ? "border-danger" : ""}\`} /></div>
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
          <div><div className="flex items-center gap-1.5 text-sm font-medium text-ink">Number of reviewers per paper <span title="A paper with fewer shows under “Needs reviewers” on Peer Review." className="text-ink-faint"><Info size={13} aria-hidden="true" /></span></div><div className="mt-0.5 text-xs text-ink-faint">How many reviewers get assigned to each submission by default.</div>{bad && <p role="alert" className="mt-1 text-xs font-medium text-danger">{bad}</p>}</div>
          <input type="number" min={1} max={20} value={per} onChange={(e) => typed(e.target.value)} aria-label="Number of reviewers per paper" aria-invalid={Boolean(bad)} className="w-20 shrink-0 rounded-lg border border-line px-3 py-2 text-right text-sm text-ink outline-none focus:border-primary" />
        </div>
        <div className={row}>
          <div><div className="flex items-center gap-1.5 text-sm font-medium text-ink">Maximum papers per reviewer <span title="The most papers any one reviewer can be given." className="text-ink-faint"><Info size={13} aria-hidden="true" /></span></div><div className="mt-0.5 text-xs text-ink-faint">Caps how many submissions any single reviewer can be assigned.</div></div>
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

`;
s = s.slice(0, a) + cards + s.slice(b);

// ---- 2. the panel
const p0 = s.indexOf("/** The review settings and the form editors, with the rail on the right");
const p1 = s.indexOf("/** The instructions and the review form editors, in place");
if (p0 < 0 || p1 < 0) { console.log("markers missing 2"); process.exit(1); }
const panel = `/** The review settings and the form editors, with the rail on the right (the prototype's ReviewSettingsPanel): the Conference Settings › Review page
 *  and the Settings tab of Peer Review › Manage show the same one. Like the prototype, the period, timeline, limits and visibility save as soon as they change. */
export function ReviewSettingsPanel({ slug, conferenceId, settings, setup, reload, withForm = true, links }: Loaded & { withForm?: boolean; links?: Array<{ label: string; desc: string; href: string }> }) {
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
  const emails = \`/chair/\${e}/settings/email-templates\`;
  return (
    <>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
        {(error || problem) && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error || problem}</p>}
        <div aria-live="polite" className="-mb-3 h-4 text-right text-[11px] font-semibold text-ink-faint">{status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : ""}</div>
        <PeriodCard tl={tl} onChange={(patch) => void saveTl(patch).catch(() => undefined)} />
        <Card id="rs-timeline" icon={Clock} title="Review timeline" desc="How many days each reviewer gets, and the two automatic reminders that nudge reviewers who haven't submitted yet.">
          <ReviewTimelineEditor timeline={tl} emailsHref={emails} onSave={saveTl} />
        </Card>
        <AssignmentCard lim={lim} stored={settings.stored} onChange={(patch) => void saveLim(patch)} />
        <VisibilityCard initial={pol} mode={lim.reviewMode} fields={setup.form.flatMap((sec) => sec.fields)} onChange={(p, m) => void savePol(p, m)} />
        <div id="rs-instructions" className="scroll-mt-24 space-y-3">
          <InstructionsEditor key={\`i-\${setup.instructions}-\${settings.stored}\`} initial={setup.instructions} stored={settings.stored} busy={busy === "instructions"} onSave={(t) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructions(slug, t)), { title: "Instructions saved", text: t.trim() ? "Reviewers read your text." : "Reviewers read the standard text." })} />
          <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">How reviewers see it</div>
          <InstructionsPreview text={setup.instructions} />
        </div>
        {withForm && <div id="rs-form" className="scroll-mt-24"><FormEditor key={\`f-\${JSON.stringify(setup.form)}-\${setup.custom}-\${settings.stored}\`} initial={setup.form} custom={setup.custom} stored={settings.stored} busy={busy === "form"} onSave={(f) => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, f)), { title: "Review form saved", text: "Reviewers fill in this form from now on." })} onReset={() => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, null)), { title: "Standard form back", text: "Reviewers fill in the standard form." })} /></div>}
        <EmailsPanel id="rs-recruit" title="Reviewer recruitment reminders" desc="Sent automatically after reviewers are added — nobody has to click anything." items={RECRUITMENT_EMAILS} href={emails} />
        <EmailsPanel id="rs-emails" title="Review period emails" desc="Reminders and alerts the system sends while reviews are due, overdue or complete." items={REVIEW_EMAILS} href={emails} />
        </div>
        <SectionsRail sections={[
          { id: "rs-period", label: "Reviewing period", meta: tl.opensAt || tl.closesAt ? \`\${tl.opensAt.replace("T", " ") || "—"} – \${tl.closesAt.replace("T", " ") || "—"}\` : "Not set" },
          { id: "rs-timeline", label: "Review timeline", meta: \`\${tl.reviewDays} days · \${tl.reminder1Enabled ? \`reminder \${tl.reminder1Days} days before\` : "reminder 1 off"}\${tl.reminder2Enabled ? " and on the last day" : ""}\` },
          { id: "rs-assignment", label: "Reviewer assignment", meta: \`\${lim.reviewersPerPaper} per paper · \${lim.maxPapersPerReviewer ? \`up to \${lim.maxPapersPerReviewer} papers each\` : "no reviewer limit"}\` },
          { id: "rs-visibility", label: "Review & Visibility", meta: lim.reviewMode === "double_blind" ? "Double-blind" : lim.reviewMode === "single_blind" ? "Single-blind" : "Open" },
          { id: "rs-instructions", label: "Reviewer instructions", meta: setup.instructions.trim() ? "Written" : "Standard text" },
          ...(withForm ? [{ id: "rs-form", label: "Review form", meta: setup.custom ? "Your own form" : "Standard form" }] : []),
          { id: "rs-recruit", label: "Reviewer recruitment reminders", meta: \`\${RECRUITMENT_EMAILS.length} automatic emails\` },
          { id: "rs-emails", label: "Review period emails", meta: \`\${REVIEW_EMAILS.length} automatic emails\` },
        ]} links={links ?? [
          { label: "Reviewers & PC", desc: "Invite reviewers, see current load", href: \`/chair/\${e}/peer-review/reviewers\` },
          { label: "Email Templates", desc: "The reminder and assignment emails", href: emails },
        ]} />
        </div>
      <FlowToast toast={toast} onClose={closeToast} />
    </>
  );
}

`;
s = s.slice(0, p0) + panel + s.slice(p1);

// ---- 3. imports
const rep = (x, y) => { if (!s.includes(x)) { console.log("MISSING:", x.slice(0, 80)); return; } s = s.replace(x, () => y); };
rep('import { CalendarDays, Clock, Users } from "lucide-react";', 'import { AlertTriangle, CalendarDays, Clock, Info, Users } from "lucide-react";');
rep('import { useCallback, useState, type ReactNode } from "react";', 'import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";');
rep('import { Switch } from "@/components/ui/switch";\n', '');
rep('import type { ConferenceSettings, ReviewLimits, ReviewMode, ReviewSetup, ReviewTimeline } from "@/types/chair";', 'import type { ConferenceSettings, ReviewLimits, ReviewMode, ReviewPolicy, ReviewSetup, ReviewTimeline } from "@/types/chair";');
rep('import { SectionsRail } from "./sections-rail";', 'import { SectionsRail } from "./sections-rail";\nimport { InstructionsPreview } from "./review-form-preview";\nimport { ReviewTimelineEditor } from "./review-timeline-strip";');
fs.writeFileSync(file, s);
console.log("done");
