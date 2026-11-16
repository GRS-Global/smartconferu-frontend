import { synthesizeDoc, type DocSource } from "./content";

/* "Create content from a template" (the prototype's CFP_TEMPLATE_SECTIONS and buildTemplateContentDoc): the sections the chair ticks become headed sections
   of the CFP's text, each with a line saying what to write. "Location and Venue" and "Contact Information" are not ticks: the conference already has them,
   so they are always in. */

export const TEMPLATE_SECTIONS = [
  { key: "guidelines", label: "Submission Guidelines" },
  { key: "topics", label: "Topics" },
  { key: "committees", label: "Committees/Organization" },
  { key: "speakers", label: "Invited Speakers" },
  { key: "publication", label: "Publication Information" },
  { key: "sponsors", label: "Sponsors" },
] as const;
export type TemplateKey = (typeof TEMPLATE_SECTIONS)[number]["key"];

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BODY: Record<TemplateKey, string> = {
  guidelines: "<p>Describe how to prepare and submit a paper: format, length, anonymity and the submission system.</p>",
  topics: "",
  committees: "<h3>Program Committee</h3><ul><li>Name, affiliation</li></ul><h3>Organizing Committee</h3><ul><li>Name, affiliation</li></ul>",
  speakers: "<ul><li>Name, affiliation</li></ul>",
  publication: "<p>Say where accepted papers will be published.</p>",
  sponsors: "<ul><li>Sponsor</li></ul>",
};
const TITLE: Record<TemplateKey, string> = { guidelines: "Submission Guidelines", topics: "List of Topics", committees: "Committees", speakers: "Invited Speakers", publication: "Publication", sponsors: "Sponsors" };

export function templateDoc(picked: TemplateKey[], info: DocSource, acronym: string): string {
  const about = synthesizeDoc({ ...info, topics: [], venue: "", city: "", country: "", contactEmail: "" }, acronym).split("<h2>")[0];
  const parts = [about];
  for (const s of TEMPLATE_SECTIONS) {
    if (!picked.includes(s.key)) continue;
    const topics = s.key === "topics" ? (info.topics.length ? `<ul>${info.topics.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "<ul><li>Topic</li></ul>") : BODY[s.key];
    parts.push(`<h2>${TITLE[s.key]}</h2>${topics}`);
  }
  const where = [info.venue, info.city, info.country].filter(Boolean).join(", ");
  parts.push(`<h2>Venue</h2><p>${where ? `The conference will be held at ${esc(where)}.` : "The conference will be held in ..."}</p>`);
  parts.push(`<h2>Contact</h2><p>${info.contactEmail ? `All questions about submissions should be emailed to ${esc(info.contactEmail)}.` : "All questions about submissions should be emailed to ..."}</p>`);
  return parts.join("");
}
