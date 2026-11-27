/* The screening email as a ready draft (the prototype's composeScreeningEmail, src/chair-plagiarism/ScreeningTables.jsx): the paper's ID and
   title, what to fix (or why it is not accepted), the report and the due date. The chair edits it in the dialog and the email server sends their
   words (`screening_notified` with `subject` and `body`); the greeting's first name becomes each author's own, and the server adds the link to the
   submission page. The author is told only what needs fixing — never which screening step the paper is at. */

export type EmailKind = "main" | "reminder" | "last";

/** The three emails a chair can send for one screening request: the first, then a nudge, then the final notice. */
export const EMAIL_KINDS: Array<{ key: EmailKind; label: string; hint: string }> = [
  { key: "main", label: "Main email", hint: "The first request" },
  { key: "reminder", label: "Reminder", hint: "Still waiting for the new version" },
  { key: "last", label: "Last chance", hint: "Final notice with the deadline" },
];

/** The email-log template keys of each step's emails (what the dialog's history counts first). */
export const SCREENING_EMAIL_KEYS: Record<"initial" | "plag", string[]> = {
  initial: ["screeningCorrection", "screeningCorrectionReminder", "screeningCorrectionLastChance", "screeningCoAuthor", "deskRejection"],
  plag: ["screeningRevision", "screeningRevisionReminder", "screeningRevisionLastChance", "screeningCoAuthor", "deskRejection"],
};

export interface DraftInput {
  reject: boolean;
  kind: EmailKind;
  /** The first name the email greets (the corresponding author's). */
  greet: string;
  paperId: string;
  n: number;
  title: string;
  acronym: string;
  problems: string[];
  /** The due date as people read it ("Nov 20, 2026"), or "". */
  due: string;
  /** The shared similarity report's files (a revision request only): the email says the report is linked. */
  reportFiles: string[];
}

export function composeScreeningDraft(i: DraftInput): { subject: string; body: string } {
  // A rejection is final, so only a correction / revision request has a reminder or a last chance.
  const k: EmailKind = i.reject ? "main" : i.kind;
  const many = i.problems.length > 1;
  const dueBy = i.due ? ` by ${i.due}` : "";
  const intro = i.reject
    ? `After careful review, we won't be able to include this paper in this year's programme. The main ${many ? "points" : "point"} behind this decision:`
    : k === "reminder"
      ? `Just a friendly nudge: your paper is nearly ready to move forward, and ${many ? "a few small things are" : "one small thing is"} left:`
      : k === "last"
        ? `This is a final reminder, and we really hope to keep your paper with us. ${many ? "These points are" : "This point is"} still open:`
        : `To move it forward, there ${many ? "are a few things" : "is one thing"} to take care of:`;
  const closing = i.reject
    ? "This reflects the fit with this edition's requirements, not the value of your research. We'd encourage you to keep building on it, and we'd be delighted to see a future submission from you.\n\nThank you again, and we wish you all the best with your research."
    : k === "reminder"
      ? `We're keen to see your updated version${dueBy}. You can upload it from your submission page.`
      : k === "last"
        ? `If you can upload the updated version${dueBy}, your paper can continue on its way.`
        : `You're very close. Once you upload the updated version${dueBy} from your submission page, we'll take it from there.`;
  const body = [
    `Dear ${i.greet},`,
    "",
    ...(i.reject || k === "main"
      ? [i.reject ? `Thank you for choosing ${i.acronym} to share your work. We truly appreciate the effort behind it.` : `Thank you for submitting your paper to ${i.acronym}. We appreciate the effort behind it.`, ""]
      : []),
    `Paper ID: ${i.paperId} (V${i.n})`,
    `Title: ${i.title}`,
    "",
    intro,
    "",
    ...(i.problems.length ? i.problems.map((p) => `• ${p}`) : ["• "]),
    ...(k === "main" && i.reportFiles.length ? ["", "The plagiarism report is attached to this email and is also available on your submission page."] : []),
    "",
    closing,
    "",
    "Best regards,",
    `${i.acronym} Organising Committee`,
  ].join("\n");
  const what = i.reject ? "Update on your paper" : "Next step for your paper";
  const lead = i.reject ? "" : k === "reminder" ? "Reminder: " : k === "last" ? "Final reminder: " : "";
  return { subject: `[${i.paperId} · V${i.n}] ${lead}${what}`, body };
}
