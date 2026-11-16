import { frameEmailHtml } from "@/lib/email-frame";
import { EMAIL_SAMPLE_VALUES } from "./email-samples";

/* The email as it will look: the template's subject and message with sample values in the merge fields (the prototype's catalog of samples), inside the
   platform's frame — shown in a sandboxed iframe (Email Templates › Preview, and "See how email looks" on the settings pages). Nothing is sent. */

const CSP = "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);

/** The merge fields' values: the fixed samples, except the conference's own name and acronym. */
const valuesFor = (conferenceName: string, conferenceAcronym: string): Record<string, string> => ({ ...EMAIL_SAMPLE_VALUES, conference_name: conferenceName, conference_acronym: conferenceAcronym });
const OWN = new Set(["conference_name", "conference_acronym"]);

/** `title` is the heading inside the email (the subject, unless given); `soft` draws that heading light, as the prototype's preview does. */
export function emailPreviewDoc(subject: string, body: string, conferenceName: string, conferenceAcronym: string, opts: { title?: string; soft?: boolean } = {}): string {
  const values = valuesFor(conferenceName, conferenceAcronym);
  // The samples are fixed, trusted HTML (<br>, <b>); the conference's own text is escaped.
  const fill = (t: string, html: boolean) => t.replace(/{{\s*(\w+)\s*}}/g, (_, k: string) => { const v = values[k] ?? ""; return html && OWN.has(k) ? esc(v) : html ? v : v.replace(/<[^>]*>/g, " "); });
  const logoUrl = typeof window === "undefined" ? "" : new URL("/smartconferu-lockup.png", window.location.origin).href;
  const framed = frameEmailHtml(fill(body, true), { conferenceName, conferenceAcronym, title: opts.title ?? fill(subject, false), logoUrl });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"><style>body{margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif}${opts.soft ? "h2{font-weight:400}" : ""}</style></head><body>${framed}</body></html>`;
}

/** The subject with the sample values filled in. */
export const emailSubject = (subject: string, conferenceName: string, conferenceAcronym: string): string => {
  const values = valuesFor(conferenceName, conferenceAcronym);
  return subject.replace(/{{\s*(\w+)\s*}}/g, (_, k: string) => (values[k] ?? "").replace(/<[^>]*>/g, " "));
};
