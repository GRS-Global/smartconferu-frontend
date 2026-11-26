import { frameEmailHtml } from "@/lib/email-frame";

/* The email a Super Admin's decision on a conference request sends, as the decision popup shows it: the text with its {{placeholders}} filled in,
   in the platform's email frame (logo, heading, sign-off, footer), exactly as the chair receives it. The text is plain (a blank line starts a new
   paragraph); the API turns it into the email's HTML when it sends. Backend/src/modules/conferences/conference-emails.service.ts. */

export interface DecisionEmailText { subject: string; body: string }
export interface DecisionEmails { approved: DecisionEmailText; declined: DecisionEmailText; logoUrl: string | null }

export const PLACEHOLDERS: Record<"approved" | "declined", Array<{ key: string; hint: string }>> = {
  approved: [{ key: "first_name", hint: "Chair's first name" }, { key: "conference_acronym", hint: "e.g. ICTCS 2026" }, { key: "conference_name", hint: "Full title" }, { key: "dashboard_link", hint: "Link to the conference (required)" }],
  declined: [{ key: "first_name", hint: "Chair's first name" }, { key: "conference_acronym", hint: "e.g. ICTCS 2026" }, { key: "conference_name", hint: "Full title" }, { key: "reason", hint: "The reason you typed" }],
};

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
const link = (url: string) => `<a href="${esc(url)}" style="color:#4F46E5">${esc(url)}</a>`;

/** `{{name}}` → its value (escaped; a `*_link` becomes a link). Unknown names become empty, as in the sent email. */
export function fillPlaceholders(text: string, values: Record<string, string>, html: boolean): string {
  return text.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => {
    const v = values[key] ?? "";
    if (!html) return v;
    return key.endsWith("_link") && /^https?:\/\//.test(v) ? link(v) : esc(v);
  });
}

/** Plain text → paragraphs (a blank line starts a new one). Applied to the text before its values are filled in, as the API does. */
function paragraphs(text: string, values: Record<string, string>): string {
  return text.trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${fillPlaceholders(esc(p).replace(/&quot;/g, '"'), values, true).replace(/\n/g, "<br>")}</p>`).join("");
}

const CSP = "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'";

/** The whole framed email as a document for an iframe (scripts are blocked by the policy and the sandbox). */
export function decisionEmailDoc(opts: { text: DecisionEmailText; values: Record<string, string>; label: string; conferenceName: string; conferenceAcronym: string; logoUrl: string }): string {
  const framed = frameEmailHtml(paragraphs(opts.text.body, opts.values), { conferenceName: opts.conferenceName, conferenceAcronym: opts.conferenceAcronym, title: opts.label, logoUrl: opts.logoUrl });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"><style>body{margin:0;padding:14px;background:#F8FAFC;font-family:Arial,sans-serif}</style></head><body>${framed}</body></html>`;
}
