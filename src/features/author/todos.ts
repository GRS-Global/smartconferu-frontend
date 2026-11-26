import { FEEDBACK_ENABLED } from "@/lib/config";
import type { AuthorSubmission } from "@/types/author-submission";
import type { Conference } from "@/types/conference";
import { conferenceDest, type Dest } from "./links";
import { conferenceOver } from "./status";

/* The author's to-do list for one conference — only things they can act on (the prototype's `authorTodos`,
   src/author-module/authorStatus.js). Each item says where its button goes. */

export interface Todo { tone: "warning" | "danger" | "primary"; title: string; sub: string; cta: string; primary?: boolean; dest: Dest | null }

interface Input { conference: Conference; papers: AuthorSubmission[]; hasPhoto: boolean; feedbackOpen: boolean }

export function authorTodos({ conference, papers, hasPhoto, feedbackOpen }: Input): Todo[] {
  const finished = conferenceOver(conference);
  const closed = conference.status === "archived"; // registration closes with the archive, even when the chair archives early
  const todos: Todo[] = [];
  papers.filter((p) => p.result === "not_registered" && !closed).forEach((p) => todos.push({ tone: "warning", title: "Accepted. Register to present it", sub: `${p.id} · "${p.title}"`, cta: "Register now", primary: true, dest: conferenceDest.registration(conference.id) }));
  papers.filter((p) => p.decision === "revise" && p.result === "no_result").forEach((p) => todos.push({ tone: "danger", title: "Revision required", sub: `${p.id} · upload a revised paper`, cta: "Upload revision", primary: true, dest: conferenceDest.paper(p.id, p.conferenceId) }));
  // Paper screening asked for a corrected file (initial check) or a revised one (plagiarism check).
  papers.filter((p) => p.result === "no_result" && p.decision !== "revise" && !p.withdrawn).forEach((p) => {
    const req = p.screeningRequest;
    if (!req) return;
    const what = req.kind === "correction" ? "Correction required" : "Revision required after the plagiarism check";
    todos.push({ tone: "danger", title: what, sub: `${p.id} · upload V${req.version + 1}${req.deadline ? ` by ${req.deadline}` : ""}`, cta: "Upload new version", primary: true, dest: conferenceDest.paper(p.id, p.conferenceId) });
  });
  // No programme data in the database, so no paper has a presentation slot yet.
  papers.filter((p) => p.result === "registered" && !finished).forEach((p) => todos.push({ tone: "primary", title: "Book your presentation slot", sub: `${p.id} · "${p.title}"`, cta: "Book slot", dest: conferenceDest.programme(conference.id) }));
  if (!finished) papers.filter((p) => p.result === "draft" && !p.withdrawn).forEach((p) => todos.push({ tone: "warning", title: "Upload your paper and submit", sub: `${p.id} · saved, not sent yet`, cta: "Continue", dest: conferenceDest.paper(p.id, p.conferenceId) }));
  if (papers.some((p) => p.result === "registered") && !hasPhoto) todos.push({ tone: "primary", title: "Add your photo for your speaker flyer", sub: "Optional · takes 10 seconds", cta: "Add photo", dest: conferenceDest.profile() });
  if (FEEDBACK_ENABLED && feedbackOpen && papers.length) todos.push({ tone: "primary", title: "Tell the organisers how it went", sub: "2-minute feedback form", cta: "Give feedback", dest: conferenceDest.feedback(conference.id) });
  return todos;
}
