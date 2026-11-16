// One-off edit helper: submission-period email keys, the email editor stays open after Save / Reset (as the prototype's), rail items for the submission emails.
import fs from "node:fs";
let n = 0;
function patch(f, pairs) {
  let s = fs.readFileSync(f, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING:", f.slice(-30), a.slice(0, 70)); continue; } s = s.replace(a, () => b); n += 1; }
  fs.writeFileSync(f, s);
}
patch("../src/features/chair/components/policy-cards.tsx", [
  ['{ name: "Submissions open today",', '{ key: "submissionsOpen", role: "chair", name: "Submissions open today",'],
  ['{ name: "Your paper is not submitted yet",', '{ key: "draftReminder", role: "author", name: "Your paper is not submitted yet",'],
  ['{ name: "Submission deadline approaching",', '{ key: "deadlineApproaching", role: "author", name: "Submission deadline approaching",'],
  ['{ name: "Submissions closed: summary",', '{ key: "submissionsClosedSummary", role: "chair", name: "Submissions closed: summary",'],
  ['{ name: "Possible duplicate or similarity flag",', '{ key: "similarityFlag", role: "chair", name: "Possible duplicate or similarity flag",'],
]);
patch("../src/features/chair/components/submission-settings-page.tsx", [
  ['meta: `${SUBMISSION_EMAILS.length} automatic emails` }]}', 'meta: `${SUBMISSION_EMAILS.length} automatic emails`, children: SUBMISSION_EMAILS.flatMap((x) => (x.key ? [{ id: `ss-emails-${x.key}`, label: x.name }] : [])) }]}'],
]);
patch("../src/mocks/chair.ts", [
  ['  ["chairDecisionReady", "reviewing", "chair", "Paper ready for decision", "A paper is ready for your decision"],', '  ["chairDecisionReady", "reviewing", "chair", "Paper ready for decision", "A paper is ready for your decision"],\n  ["submissionsOpen", "setup", "chair", "Submissions open today", "Submissions are open for {{conference_acronym}}"],\n  ["draftReminder", "submission", "author", "Your draft is not submitted yet", "Your draft is not submitted yet"],\n  ["deadlineApproaching", "submission", "author", "Submission deadline approaching", "The submission deadline is approaching"],\n  ["submissionsClosedSummary", "setup", "chair", "Submissions closed: summary", "Submissions closed for {{conference_acronym}}"],\n  ["similarityFlag", "setup", "chair", "Possible duplicate or similarity flag", "A paper was flagged for similarity"],'],
]);
// the editor keeps its content when it is reset: it reopens with the default text (a counter bumps the uncontrolled editor)
patch("../src/features/chair/components/email-template-editor.tsx", [
  ['export interface EditingEmail { key: string;', 'export interface EditingEmail { /** Bumped by "Reset to default" so the (uncontrolled) editor reopens with the default text. */ rev?: number; key: string;'],
  ['  }, [edit.key, editing]);', '  }, [edit.key, edit.rev, editing]);'],
]);
patch("../src/features/chair/components/email-templates-page.tsx", [
  ['interface Editing { key: string;', 'interface Editing { rev?: number; key: string;'],
  ['{ title: "Email saved", text: `${edit.label || "The email"} was saved for this conference.` })) setEdit(null);', '{ title: "Email saved", text: `${edit.label || "The email"} was saved for this conference.` })) setEdit((e) => (e ? { ...e, hasCopy: true, isNew: false } : e));'],
  ['{ title: "Back to the default", text: `${edit.label} uses the platform\'s text again.` })) setEdit(null);', '{ title: "Back to the default", text: `${edit.label} uses the platform\'s text again.` })) setEdit((e) => (e && e.def ? { ...e, subject: e.def.subject, body: e.def.body, enabled: true, hasCopy: false, rev: (e.rev ?? 0) + 1 } : null));'],
]);
console.log("applied", n);
