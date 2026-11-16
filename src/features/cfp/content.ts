import { richTextToHtml } from "@/components/ui/rich-text";
import type { ConferenceInfo } from "@/types/chair";

/** What the first draft is made from (a conference's own details). */
export type DocSource = Pick<ConferenceInfo, "about" | "topics" | "venue" | "city" | "country" | "contactEmail">;

/* The CFP page's text. It is kept as HTML in `cfps.content.doc` (written with the rich-text editor). A CFP nobody has written yet shows a first draft
   made from the conference's own details (the prototype's synthesizeContentDoc): what it is, the topics, the venue and the contact. */

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function synthesizeDoc(info: DocSource | null, acronym: string): string {
  const parts: string[] = [];
  const about = info?.about?.trim();
  parts.push(about ? richTextToHtml(about) : `<p>Explain what ${esc(acronym)} is.</p>`);
  if (info?.topics?.length) parts.push(`<h2>List of Topics</h2><ul>${info.topics.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`);
  const where = [info?.venue, info?.city, info?.country].filter(Boolean).join(", ");
  parts.push(`<h2>Venue</h2><p>${where ? `The conference will be held at ${esc(where)}.` : "The conference will be held in ..."}</p>`);
  parts.push(`<h2>Contact</h2><p>${info?.contactEmail ? `All questions about submissions should be emailed to ${esc(info.contactEmail)}.` : "All questions about submissions should be emailed to ..."}</p>`);
  return parts.join("");
}

/** The HTML to show for a CFP: what was written, else the first draft. */
export const docOf = (doc: string, info: DocSource | null, acronym: string): string => (doc.trim() ? richTextToHtml(doc) : synthesizeDoc(info, acronym));
