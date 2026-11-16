import { DATA_SOURCE } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";
import { AuthRequiredError, ServiceError } from "./errors";

/** An author's answer about a conference (Author › Feedback). `at` is when it was last sent (ISO). */
export interface ConferenceFeedback {
  overall: number; kind: "liked" | "improve"; topics: string[]; comment: string; again: string | null; anonymous: boolean; at: string;
}

// Mock mode: kept in memory for the life of the page, like the prototype.
const memory: Record<string, ConferenceFeedback> = {};

async function conferenceId(slug: string): Promise<string> {
  const db = getSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new AuthRequiredError();
  const conf = await db.from("conferences").select("id").eq("slug", slug).limit(1);
  const id = (conf.data?.[0] as { id: string } | undefined)?.id;
  if (conf.error || !id) throw new ServiceError("We couldn't find that conference.");
  return id;
}

/** The signed-in person's answer for this conference, or null. Until migration 0042 is run there is none. */
export async function loadMyFeedback(slug: string): Promise<ConferenceFeedback | null> {
  if (DATA_SOURCE === "mock") return memory[slug] ?? null;
  const id = await conferenceId(slug);
  const { data, error } = await getSupabase().from("conference_feedback").select("overall, kind, topics, comment, again, anonymous, updated_at").eq("conference_id", id).maybeSingle();
  if (error) {
    if (/does not exist|schema cache/i.test(error.message ?? "")) return null;
    throw new ServiceError("We couldn't read your feedback.");
  }
  const r = data as { overall: number; kind: string; topics: string[] | null; comment: string | null; again: string | null; anonymous: boolean; updated_at: string } | null;
  return r ? { overall: r.overall, kind: r.kind === "liked" ? "liked" : "improve", topics: r.topics ?? [], comment: r.comment ?? "", again: r.again, anonymous: r.anonymous, at: r.updated_at } : null;
}

/** Sends (or changes) the answer. Throws an Error ready to show. */
export async function saveMyFeedback(slug: string, answers: Omit<ConferenceFeedback, "at">): Promise<ConferenceFeedback> {
  if (answers.overall < 1 || answers.overall > 5) throw new ServiceError("Pick a face first.");
  if (answers.comment.length > 2000) throw new ServiceError("The comment is too long (2,000 characters at most).");
  if (DATA_SOURCE === "mock") { memory[slug] = { ...answers, at: new Date().toISOString() }; return memory[slug]; }
  const id = await conferenceId(slug);
  const row = { conference_id: id, overall: answers.overall, kind: answers.kind, topics: answers.topics, comment: answers.comment, again: answers.again, anonymous: answers.anonymous, updated_at: new Date().toISOString() };
  const { error } = await getSupabase().from("conference_feedback").upsert(row, { onConflict: "conference_id,user_id" });
  if (error) {
    if (/does not exist|schema cache/i.test(error.message ?? "")) throw new ServiceError("Run supabase/migrations/0042_conference_feedback.sql to send feedback.");
    if (/row-level security|policy/i.test(error.message ?? "")) throw new ServiceError("Feedback opens on the first day of the conference, and only for authors who have a paper in it.");
    throw new ServiceError("We couldn't send your feedback. Please try again.");
  }
  return { ...answers, at: row.updated_at };
}
