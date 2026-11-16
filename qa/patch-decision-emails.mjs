// One-off edit helper: the Decision settings page's "Decision emails" panel and rail entry (the prototype's ScheduledEmailsPanel with DECISION_EMAIL_KEYS),
// plus the prototype's tones for the email rows (role tile colour, "Chair action" / "Automatic" / "Scheduled reminder" pills).
import fs from "node:fs";
let n = 0;
const edit = (f, pairs) => { let s = fs.readFileSync(f, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", f, a.slice(0, 70)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(f, s); };
const dir = "../src/features/chair/components/";
edit(dir + "policy-cards.tsx", [
  ['kind: "Automatic" | "Scheduled reminder";', 'kind: "Automatic" | "Scheduled reminder" | "Chair action";'],
  ['role?: "reviewer" | "chair" | "author" }', 'role?: "reviewer" | "chair" | "author" | "registration" }'],
  ['const ROLE_TONE = { reviewer: { color: "var(--success)", bg: "var(--success-soft)" }, chair: { color: "var(--primary)", bg: "var(--primary-soft)" }, author: { color: "#0369A1", bg: "#E0F2FE" } } as const;',
    'const ROLE_TONE = { reviewer: { color: "var(--success)", bg: "var(--success-soft)" }, chair: { color: "var(--secondary)", bg: "var(--secondary-soft)" }, author: { color: "var(--primary)", bg: "var(--primary-soft)" }, registration: { color: "var(--warning)", bg: "var(--warning-soft)" } } as const;\nconst KIND_TONE = { Automatic: "bg-success-soft text-success", "Chair action": "bg-primary-soft text-primary", "Scheduled reminder": "bg-warning-soft text-warning" } as const;'],
  ['e.kind === "Automatic" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"', 'KIND_TONE[e.kind]'],
  ['export const RECRUITMENT_EMAILS: EmailItem[] = [', `export const DECISION_EMAILS: EmailItem[] = [
  { key: "acceptance", role: "author", name: "Paper accepted", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases an Accept decision" },
  { key: "minorRevision", role: "author", name: "Minor revision required", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Minor revision decision" },
  { key: "majorRevision", role: "author", name: "Major revision required", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Major revision decision" },
  { key: "waitlisted", role: "author", name: "Paper waitlisted", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Waitlist decision" },
  { key: "rejection", role: "author", name: "Paper not accepted", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Reject decision" },
  { key: "registrationConfirmed", role: "registration", name: "Registration confirmed", kind: "Automatic", count: 1, to: "Registrant", when: "Attendee completes registration" },
  { key: "decisionChanged", role: "author", name: "Decision changed", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair overrides a released decision" },
  { key: "finalDecisionReviewers", role: "reviewer", name: "Final decision (for reviewers)", kind: "Automatic", count: 1, to: "Reviewer", when: "Decision released" },
  { key: "cameraReadyReminder", role: "author", name: "Camera-ready reminder", kind: "Scheduled reminder", count: 1, to: "Author (submitting)", when: "Ahead of the camera-ready deadline" },
];
export const RECRUITMENT_EMAILS: EmailItem[] = [`],
]);
edit(dir + "decision-settings-page.tsx", [
  ['import { SectionsRail } from "./sections-rail";', 'import { DECISION_EMAILS, EmailsPanel } from "./policy-cards";\nimport { SectionsRail } from "./sections-rail";'],
  ['<SectionsRail sections={[{ id: "dc-types", label: "Decision types", meta: types.length ? <span className="mt-1 flex flex-wrap gap-1">{types.map((t) => <span key={t.id} style={pill(t.color)} className="rounded-full px-1.5 py-px text-[10px] font-bold">{t.label}</span>)}</span> : "None yet" }]}',
    '<SectionsRail sections={[{ id: "dc-types", label: "Decision types", meta: types.length ? <span className="mt-1 flex flex-wrap gap-1">{types.map((t) => <span key={t.id} style={pill(t.color)} className="rounded-full px-1.5 py-px text-[10px] font-bold">{t.label}</span>)}</span> : "None yet" }, { id: "dc-emails", label: "Decision emails", meta: `${DECISION_EMAILS.length} automatic emails`, children: DECISION_EMAILS.flatMap((x) => (x.key ? [{ id: `dc-emails-${x.key}`, label: x.name }] : [])) }]}'],
]);
console.log("applied", n);
