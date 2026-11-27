import type { ConferenceInfo } from "@/types/chair";
import type { TourStep } from "./spotlight-tour";

/* The guided tour's steps (the prototype's buildSetupTourSteps). Field steps only appear for details that are still missing, so the tour follows what is
   really saved instead of a fixed list; the menu steps are the settings pages worth knowing (skipping a page's menu step skips the whole page).
   The steps that wait for a field are read from the page itself (gateOpen), and the Activity Logs steps point at its filters. */

const TOPICS_MIN = 4;
const required = "Required before you can publish your Call for Papers.";

/** What a required field step says while its field is still empty (the step's "Next" waits for it). */
export const GATE_HINTS: Record<string, string> = {
  webPage: "Enter a valid website address to continue.",
  abstractDeadline: "Pick the abstract deadline to continue.",
  submissionDeadline: "Pick the submission deadline (on or after the abstract deadline) to continue.",
  about: "Write a short description to continue.",
  areas: "Choose both a primary and a secondary area to continue.",
  language: "Choose a language to continue.",
  topics: `Add at least ${TOPICS_MIN} topics to continue.`,
  tracks: "Add at least one track to continue.",
};

/** Whether the conference's tracks need nothing more: tracks are switched off (Settings › Submissions, not shown to authors), or there is
 *  at least one track of the chair's own (the default "General Track" alone does not count). */
export function tracksReady(settings: { tracks: Array<{ name: string }>; submission?: { tracksOn?: boolean } }): boolean {
  if (settings.submission?.tracksOn === false) return true;
  return settings.tracks.length > 0 && !(settings.tracks.length === 1 && settings.tracks[0].name === "General Track");
}

/** The required details that are still missing in what is saved (the field steps and the recap are built from this). */
export function missingDetails(info: ConferenceInfo | null, hasTracks: boolean): string[] {
  const empty = (v: string | undefined) => !v || !v.trim();
  const out: string[] = [];
  if (!info || empty(info.webPage)) out.push("webPage");
  if (!info || empty(info.abstractDeadline)) out.push("abstractDeadline");
  if (!info || empty(info.submissionDeadline)) out.push("submissionDeadline");
  if (!info || empty(info.about)) out.push("about");
  if (!info || empty(info.primaryArea) || empty(info.secondaryArea)) out.push("areas");
  if (!info || empty(info.language)) out.push("language");
  if (!info || info.topics.length < TOPICS_MIN) out.push("topics");
  if (!hasTracks) out.push("tracks");
  return out;
}
export const DETAIL_LABELS: Record<string, string> = { webPage: "website", abstractDeadline: "abstract deadline", submissionDeadline: "submission deadline", about: "description", areas: "research areas", language: "language", topics: "topics", tracks: "tracks" };

/** Whether a gated step's field currently holds a good value, read from the page itself (saved or not), so the chair can go on before pressing Update Conference. */
export function gateOpen(key: string): boolean {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)?.value.trim() ?? "";
  switch (key) {
    case "webPage": return /^https?:\/\/\S+\.\S+/i.test(val("cd-web"));
    case "abstractDeadline": return val("cd-abs") !== "";
    case "submissionDeadline": return val("cd-sub") !== "" && (val("cd-abs") === "" || val("cd-sub") >= val("cd-abs"));
    case "about": return val("cd-ab") !== "";
    case "areas": return val("cd-a1") !== "" && val("cd-a2") !== "";
    case "language": return val("cd-lang") !== "";
    case "tracks": return document.querySelector("[data-track-ready]")?.getAttribute("data-track-ready") === "1";
    case "topics": return document.querySelectorAll('[data-tour="cd-topics"] button[aria-label^="Remove "]').length >= TOPICS_MIN;
    default: return true;
  }
}

/** `open` is what was missing when the tour started (see missingDetails): kept for the whole tour so the steps do not shift as the chair fills things in. */
export function buildTourSteps(open: string[]): TourStep[] {
  const has = (k: string) => open.includes(k);
  const missing = {
    webPage: has("webPage"), abstractDeadline: has("abstractDeadline"), submissionDeadline: has("submissionDeadline"),
    about: has("about"), areas: has("areas"), language: has("language"),
    topics: has("topics"), tracks: has("tracks"),
  };
  const anyDetails = missing.webPage || missing.abstractDeadline || missing.submissionDeadline || missing.about || missing.areas || missing.language || missing.topics;
  // A field step: opens its page, scrolls the field into view, highlights it and puts the cursor in it.
  const field = (key: string, target: string, title: string, text: string, path = "settings", focus = true): TourStep => ({ key, path, targets: [target], focus, badge: "required", title, text, note: required, gate: GATE_HINTS[key] ? key : undefined, gateHint: GATE_HINTS[key] });
  // A settings page worth knowing: a step on its menu item (with an "Open …" button), then, once opened, one step per important field on the page itself.
  const optional = (key: string, rec: string, nav: string, title: string, text: string, open: { label: string; path: string }, skip = "Skip for now"): TourStep => ({ key, group: key, rec, targets: [nav], openGroup: "settings", badge: "recommended", title, text, open, skip });
  const onPage = (group: string, key: string, path: string, target: string, title: string, text: string, badge: TourStep["badge"] = "recommended"): TourStep => ({ key, group, path, targets: [target], badge, title, text, skip: "Skip this section" });
  return [
    { key: "settings", path: "settings", targets: ["nav-settings"], openGroup: "settings", badge: "info", title: "Conference Settings", text: "Manage your conference configuration from here. We'll guide you through the essential settings first." },
    { key: "details", targets: ["nav-settings-details"], openGroup: "settings", badge: anyDetails ? "required" : "info", title: "Conference Details", text: "Set your conference identity, website, dates, language, research areas, and other relevant details.", open: { label: "Open Conference Details", path: "settings" } },
    ...(missing.webPage ? [field("webPage", "cd-identity", "Website", "Where authors can read more about the conference.")] : []),
    ...(missing.abstractDeadline ? [field("abstractDeadline", "cd-abstract-deadline", "Abstract deadline", "When authors must send their abstract. It must be on or before the submission deadline.")] : []),
    ...(missing.submissionDeadline ? [field("submissionDeadline", "cd-submission-deadline", "Submission deadline", "The last day authors can submit a paper. It must be on or after the abstract deadline.")] : []),
    ...(missing.about ? [field("about", "cd-about", "Describe the conference", "The scope and audience, shown on your Call for Papers.")] : []),
    ...(missing.areas ? [field("areas", "cd-classification", "Research areas", "Choose a primary and a secondary research area.")] : []),
    ...(missing.language ? [field("language", "cd-language", "Language", "The language papers are written and reviewed in.")] : []),
    ...(missing.topics ? [field("topics", "cd-topics", "Topics", `Add at least ${TOPICS_MIN} topics — the suggestions here can help.`)] : []),
    ...(anyDetails ? [{ key: "save", path: "settings", targets: ["cd-save"], badge: "required", title: "Click “Update Conference”", text: "This is the button that stores your answers — nothing above is saved until you click it.", note: required, gate: "saved", gateHint: "Fill what the button lists as still needed, then click Update Conference." } satisfies TourStep] : []),
    ...(missing.tracks ? [field("tracks", "ss-tracks", "Tracks", "Add at least one track: authors pick one when they submit. Use Add track below.", "settings/submissions", false)] : []),
    // Submissions
    optional("submissions", "submissionRules", "nav-settings-submissions", "Submissions", "How authors submit: paper screening, the submission period, presentation types and author guidelines. Open the page and we'll go through them.", { label: "Open Submission Settings", path: "settings/submissions" }),
    onPage("submissions", "sub-screening", "settings/submissions", "ss-screening", "Paper screening", "Switch on an Initial check and a Plagiarism check if you want papers screened before they reach reviewers. Each one adds its own page to your menu."),
    onPage("submissions", "sub-window", "settings/submissions", "ss-window", "Submission period", "When the submission form opens, and whether authors can still edit their paper until the deadline you set in Conference Details."),
    onPage("submissions", "sub-types", "settings/submissions", "ss-types", "Presentation types", "The kinds of presentation an author can choose, such as oral or poster. Add the ones your conference uses."),
    onPage("submissions", "sub-guidelines", "settings/submissions", "ss-guidelines", "Author guidelines", "What authors read before they submit: format, length, anonymity and anything else you expect."),
    // Review
    optional("review", "reviewDeadline", "nav-settings-review", "Review", "How peer review runs: the reviewing period, reviewers per paper, reminders, visibility and instructions. Open the page and we'll go through them.", { label: "Open Review Settings", path: "settings/review" }),
    onPage("review", "rev-window", "settings/review", "rv-window", "Reviewing period", "The dates reviewers can open and submit reviews. Both dates are needed, and the end must be after the start."),
    onPage("review", "rev-assignment", "settings/review", "rv-assignment", "Reviewer assignment", "How many reviewers each paper should get, and the most papers one reviewer can take. These drive the Peer Review list."),
    onPage("review", "rev-timeline", "settings/review", "rv-timeline", "Review timeline", "How many days each reviewer gets, and the two automatic reminders sent to reviewers who haven't submitted."),
    onPage("review", "rev-visibility", "settings/review", "rv-visibility", "Double-blind and visibility", "Hide author names from reviewers, and choose what reviewers can see and what authors are asked to provide."),
    onPage("review", "rev-instructions", "settings/review", "rv-instructions", "Reviewer instructions", "Shown at the top of every review form. Write them here, or attach a PDF."),
    // Decision
    optional("decision", "decisions", "nav-settings-decision", "Decision", "The outcomes you can give a paper and what each one tells the author. Open the page and we'll go through it.", { label: "Open Decision Settings", path: "settings/decision" }),
    onPage("decision", "dec-types", "settings/decision", "dc-types", "Decision types", "Accept, Reject, Revision and the rest. “Chair decision” is the name you see, “Author sees” is what the author is told. These are the options in the Decision menu on Peer Review."),
    onPage("decision", "dec-add", "settings/decision", "dc-add", "Add your own decision", "Need another outcome, such as “Accept as poster”? Add it here and it appears in the Decision menu straight away."),
    // Email templates
    optional("emails", "emails", "nav-settings-email-templates", "Email Templates", "The emails authors and reviewers get from this conference — confirmations, decisions and reminders. Open the page and we'll show you around.", { label: "Open Email Templates", path: "settings/email-templates" }, "Do this later"),
    onPage("emails", "em-tabs", "settings/email-templates", "et-tabs", "Find a template", "Emails are grouped by who receives them, such as authors or reviewers. Pick a group to see only its emails."),
    onPage("emails", "em-card", "settings/email-templates", "et-first-card", "Every email is a template", "Each card says when the email is sent and to whom. Use the switch to turn it on or off, and the pencil to change its subject and message."),
    onPage("emails", "em-create", "settings/email-templates", "et-create", "Write your own", "Need something we don't send automatically? Create a custom email and send it to the people you choose."),
    // Logs: nothing to set up, so these say what they are for
    { key: "activityLogs", group: "activity", targets: ["nav-settings-activity-logs"], openGroup: "settings", badge: "info", title: "Activity Logs", text: "A record of who did what in your conference: settings changed, decisions recorded, reviewers assigned. Use it to answer “who changed this?” and to keep your team accountable.", open: { label: "Open Activity Logs", path: "settings/activity-logs" }, skip: "Skip" },
    onPage("activity", "act-page", "settings/activity-logs", "al-filters", "Find any change", "Filter by module, action, person or date, or search by keyword. Open a row for the full detail. Nothing here needs setting up — it fills in as you and your team work.", "info"),
    { key: "emailLogs", group: "emaillogs", targets: ["nav-settings-email-logs"], openGroup: "settings", badge: "info", title: "Email Logs", text: "Every email this conference has sent, with its delivery status. Use it to check that an author or reviewer really received their email.", open: { label: "Open Email Logs", path: "settings/email-logs" }, skip: "Skip" },
    onPage("emaillogs", "el-page", "settings/email-logs", "el-filters", "Check what was sent", "Filter by status, recipient type or template, or search by subject or person. To change what an email says, go to Email Templates — this is the delivery record only.", "info"),
  ];
}
