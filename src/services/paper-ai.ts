import { DATA_SOURCE } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";

/* The AI functions, through this app's proxy (app/api/ai/[name]/route.ts → the prototype's server; moving them into this app is
   still to do). Nothing here runs in mock mode, and a failure never blocks what the person was doing. */

async function post(name: "ingest-paper" | "paper-chat" | "enhance-review" | "suggest-topics" | "screen-paper" | "extract-paper", body: Record<string, unknown>, signal?: AbortSignal): Promise<Response | null> {
  if (DATA_SOURCE === "mock") return null;
  const { data: { session } } = await getSupabase().auth.getSession();
  if (!session) return null;
  return fetch(`/api/ai/${name}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body), signal });
}

/** After a paper or a new version is uploaded: asks the server to prepare it for the AI features (chunks, embeddings, digest).
 *  Fire and forget — the server answers 202 at once and works in the background; a failure only means it can be prepared later. */
export async function requestPaperIngest(submissionId: string, force = false): Promise<void> {
  try {
    const res = await post("ingest-paper", { submissionId, force });
    if (res && !res.ok && res.status !== 202) console.warn(`Paper not prepared for AI (error ${res.status}).`);
  } catch (e) {
    console.warn("Paper not prepared for AI:", e instanceof Error ? e.message : e);
  }
}

export interface PaperAnswer { answer: string; sources: unknown[]; usage?: Record<string, number | string> }
/** "Ask about this paper": resolves to the answer; throws an Error ready to show (`notReady` while the paper is still being prepared). */
export async function askPaper(submissionId: string, question: string, history: Array<{ role: string; content: string }> = [], signal?: AbortSignal): Promise<PaperAnswer> {
  const res = await post("paper-chat", { submissionId, question, history }, signal);
  if (!res) throw new Error("The assistant isn't available in this mode.");
  const body = (await res.json().catch(() => ({}))) as { error?: string; notReady?: boolean } & Partial<PaperAnswer>;
  if (!res.ok) throw Object.assign(new Error(body.error || `The assistant answered with an error (${res.status}).`), { notReady: Boolean(body.notReady) });
  return { answer: body.answer ?? "", sources: body.sources ?? [], usage: body.usage };
}

/** "Suggest with AI" for a conference's topics (Conference Details): new topics only; throws an Error ready to show. */
export async function suggestTopics(input: { title: string; about: string; primaryArea: string; secondaryArea: string; existing: string[]; count: number }): Promise<string[]> {
  const res = await post("suggest-topics", input);
  if (!res) throw new Error("Topic suggestions aren't available in this mode.");
  const body = (await res.json().catch(() => ({}))) as { error?: string; topics?: unknown };
  if (!res.ok) throw new Error(body.error || `Topic suggestions failed (error ${res.status}).`);
  return Array.isArray(body.topics) ? body.topics.filter((t): t is string => typeof t === "string") : [];
}

export interface ReviewEnhancement { versions: Array<{ style: string; text: string }>; improvements: string[]; suggestions: string[] }
/** "Polish with Smart Assist": better-worded versions of the reviewer's own draft. Resolves to the versions; throws an Error ready to show. */
export async function enhanceReview(input: { review: string; title: string; abstract: string; ratings: Array<{ label: string; value: number }>; submissionId?: string }, signal?: AbortSignal): Promise<ReviewEnhancement> {
  const res = await post("enhance-review", input, signal);
  if (!res) throw new Error("Smart Assist isn't available in this mode.");
  const body = (await res.json().catch(() => ({}))) as { error?: string; versions?: Array<{ style: string; text: string }>; enhancedReview?: string; improvements?: string[]; suggestions?: string[] };
  if (!res.ok) throw new Error(body.error || `Smart Assist answered with an error (${res.status}).`);
  const versions = body.versions?.length ? body.versions : [{ style: "Polished", text: body.enhancedReview ?? "" }];
  return { versions, improvements: body.improvements ?? [], suggestions: body.suggestions ?? [] };
}

export interface ScreeningVerdict { column: "single" | "double"; columnConfidence: string; english: boolean; missing: string[]; summary: string }
/** The automatic initial check's AI review: a compact digest of the PDF (never the file) in, Claude's verdict out. Throws an Error ready to show. */
export async function screenPaperDigest(input: { pages: number; layout: string; text: string; rules: { column: string | null; columnConfidence: string } }): Promise<ScreeningVerdict> {
  const res = await post("screen-paper", input);
  if (!res) throw new Error("The AI review isn't available in this mode.");
  const body = (await res.json().catch(() => ({}))) as { error?: string } & Partial<ScreeningVerdict>;
  if (!res.ok) throw new Error(body.error || `The AI review returned ${res.status}`);
  return { column: body.column === "double" ? "double" : "single", columnConfidence: body.columnConfidence ?? "low", english: Boolean(body.english), missing: Array.isArray(body.missing) ? body.missing.filter((k): k is string => typeof k === "string") : [], summary: body.summary ?? "" };
}

export interface ExtractedAuthor { name: string; affiliation: string; country: string; email: string; corresponding: boolean }
export interface ExtractedPaper { title: string; abstract: string; keywords: string[]; authors: ExtractedAuthor[] }
/** "Smart Fill" on New Submission: the first pages' text in, the paper's title, abstract, keywords and authors out (Claude reads it on the
 *  server). Resolves to null when the AI is not available (mock mode, signed out, no key on the server, service down) so the caller can fall
 *  back to the basic guess; it never throws. */
export async function extractPaperFields(text: string): Promise<ExtractedPaper | null> {
  try {
    const res = await post("extract-paper", { text: text.slice(0, 12000) });
    if (!res || !res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type: string; input?: Record<string, unknown> }> };
    const r = data.content?.find((c) => c.type === "tool_use")?.input;
    if (!r) return null;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const authors = (Array.isArray(r.authors) ? r.authors : []).map((a): ExtractedAuthor => { const o = (a ?? {}) as Record<string, unknown>; return { name: str(o.name).trim(), affiliation: str(o.affiliation), country: str(o.country), email: str(o.email), corresponding: o.corresponding === true }; }).filter((a) => a.name);
    return { title: str(r.title), abstract: str(r.abstract), keywords: (Array.isArray(r.keywords) ? r.keywords : []).filter((k): k is string => typeof k === "string"), authors };
  } catch {
    return null;
  }
}
