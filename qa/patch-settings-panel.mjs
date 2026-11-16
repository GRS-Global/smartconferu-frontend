// One-off edit helper: split Conference Settings › Review into a reusable panel (used inline on Peer Review › Settings) and the page around it.
import fs from "node:fs";
const file = "../src/features/chair/components/review-settings-page.tsx";
let s = fs.readFileSync(file, "utf8");
const start = s.indexOf("export function ReviewSettingsPage");
const gridA = s.indexOf('        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">');
const gridB = s.indexOf("        </div>\n      </div>\n      <FlowToast toast={toast} onClose={closeToast} />");
if (start < 0 || gridA < 0 || gridB < 0) { console.log("markers missing", start, gridA, gridB); process.exit(1); }
const grid = s.slice(gridA, gridB + "        </div>\n".length);
const head = s.slice(0, start);
const panel = `type Which = "timeline" | "limits" | "instructions" | "form" | "visibility";

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

type Loaded = { slug: string; conferenceId: string; settings: ConferenceSettings; setup: ReviewSetup; reload: () => void };

/** The review settings and the form editors, with the rail on the right (the prototype's ReviewSettingsPanel): the Conference Settings › Review page
 *  and the Settings tab of Peer Review › Manage show the same one. */
export function ReviewSettingsPanel({ slug, conferenceId, settings, setup, reload }: Loaded) {
  const { busy, error, toast, closeToast, run } = useReviewSave(reload);
  const conference = { id: conferenceId };
  return (
    <>
${grid}      <FlowToast toast={toast} onClose={closeToast} />
    </>
  );
}

/** The instructions and the review form editors, in place on Peer Review › Manage › Form ("Edit form"); Done goes back to the preview. */
export function ReviewFormEditors({ slug, settings, setup, reload, onDone }: Omit<Loaded, "conferenceId"> & { onDone: () => void }) {
  const { busy, error, toast, closeToast, run } = useReviewSave(reload);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Change what reviewers read and fill in. Each part has its own save.</p>
        <Button variant="outline" onClick={onDone}>Done</Button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <InstructionsEditor key={\`i-\${setup.instructions}-\${settings.stored}\`} initial={setup.instructions} stored={settings.stored} busy={busy === "instructions"} onSave={(t) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructions(slug, t)), { title: "Instructions saved", text: t.trim() ? "Reviewers read your text." : "Reviewers read the standard text." })} />
      <FormEditor key={\`f-\${JSON.stringify(setup.form)}-\${setup.custom}-\${settings.stored}\`} initial={setup.form} custom={setup.custom} stored={settings.stored} busy={busy === "form"} onSave={(f) => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, f)), { title: "Review form saved", text: "Reviewers fill in this form from now on." })} onReset={() => void run("form", () => getChairService().then((x) => x.saveReviewForm(slug, null)), { title: "Standard form back", text: "Reviewers fill in the standard form." })} />
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
      <PageHeader title="Review" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }]} />
      <div className="hd-page p-8">
        <ReviewSettingsPanel slug={slug} conferenceId={conference.id} settings={settings} setup={setup} reload={reload} />
      </div>
    </ConferenceShell>
  );
}
`;
let out = head + panel;
out = out.replace('import type { ReviewLimits, ReviewMode, ReviewTimeline } from "@/types/chair";', 'import type { ConferenceSettings, ReviewLimits, ReviewMode, ReviewSetup, ReviewTimeline } from "@/types/chair";');
fs.writeFileSync(file, out);
console.log("ok");
