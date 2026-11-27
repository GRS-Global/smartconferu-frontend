import { DATA_SOURCE } from "@/lib/config";
import { api } from "@/lib/api-client";
import { supabase } from "@/lib/supabase-lazy";

/* The real emails of an action that has just been saved (the prototype's src/data/email.js › sendActionEmails). The browser only
   says which action happened; the email server works out who gets what, checks the signed-in user may do it, sends it and records
   it in Email Logs. This never throws: the action itself worked, so a sending problem comes back as a notice to show next to it. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionEmail = "submission_withdrawn" | "paper_authors_updated" | "paper_revised" | "review_submitted" | "decision_notified" | "reviewer_invited" | "reviewer_reminder" | "reviews_assigned" | "screening_notified" | "review_edited_by_chair" | "submission_received" | "submission_on_behalf" | "custom_email" | "paper_message" | "conference_requested" | "review_deadline_extended" | "reviewer_message" | "reviewer_removed" | "fix_requested" | "cfp_manager_invited" | "certificate_issued";

/** `null` when nothing went wrong (or nothing is sent: mock mode has no emails); otherwise a sentence ready to show. */
export async function sendActionEmails(event: ActionEmail, data: Record<string, unknown>): Promise<string | null> {
  if (DATA_SOURCE === "mock") return null;
  // Own backend: it sends most of these emails itself when the action is saved (invitations, decisions, assignments, new review deadlines, "fix this", …).
  // The ones it does not send by itself are asked for here: a screening decision, and a reminder or a message to a reviewer.
  if (DATA_SOURCE === "api") {
    if (event === "screening_notified") {
      const { submissionId, version, stage, coAuthors, kind } = data as { submissionId: string; version: number; stage: "correction" | "revision" | "reject"; coAuthors?: boolean; kind?: "main" | "reminder" | "last" };
      try { await api(`/submissions/${submissionId}/screening/${version}/notify`, { method: "POST", body: { stage, kind: kind ?? "main", coAuthors: Boolean(coAuthors) } }); return null; }
      catch (e) { return `Saved, but the email to the authors wasn't sent: ${e instanceof Error ? e.message : "something went wrong"}`; }
    }
    if (event === "reviewer_reminder" || event === "reviewer_message") {
      const { assignmentId, note, message } = data as { assignmentId: string; note?: string; message?: string };
      // A reviewer who has not accepted the committee invitation has no paper assignment yet, so there is nobody to remind about it.
      if (!UUID.test(assignmentId)) return "This reviewer hasn't accepted the invitation to the committee yet, so there is nothing to remind them of. Use the invitation instead.";
      try {
        if (event === "reviewer_reminder") await api(`/assignments/${assignmentId}/remind`, { method: "POST", body: note?.trim() ? { note: note.trim() } : {} });
        else await api(`/assignments/${assignmentId}/message`, { method: "POST", body: { message: String(message ?? "").trim() } });
        return null;
      } catch (e) { return e instanceof Error ? e.message : "The email couldn't be sent."; }
    }
    return null;
  }
  try {
    const { data: { session } } = await (await supabase()).auth.getSession();
    if (!session) return "Saved, but the emails weren't sent: you're signed out — please sign in again.";
    const ask = () => fetch("/api/send-email", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ event, data }),
    });
    // One retry when the email service didn't answer or wasn't reachable (it hasn't sent anything then).
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        res = await ask();
        if (![502, 503, 504].includes(res.status) || attempt === 2) break;
      } catch {
        if (attempt === 2) return "Saved, but the emails couldn't be sent — the email service didn't answer.";
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!res) return "Saved, but the emails couldn't be sent — the email service didn't answer.";
    const body = (await res.json().catch(() => ({}))) as { error?: string; failed?: Array<{ to: string; error: string }> };
    if (!res.ok) return `Saved, but the emails weren't sent: ${body.error || `error ${res.status}`}`;
    if (body.failed?.length) return `Saved, but ${body.failed.length} email${body.failed.length === 1 ? "" : "s"} couldn't be sent (${body.failed[0].to}: ${body.failed[0].error}).`;
    return null;
  } catch (e) {
    return `Saved, but the emails couldn't be sent: ${e instanceof Error ? e.message : "something went wrong"}.`;
  }
}


/** One email event whose answer matters to the caller (Email Communication › Send Email): how many went out, or why nothing did. Never throws. */
export async function sendEmailEvent(event: ActionEmail, data: Record<string, unknown>): Promise<{ sent: number; failed: number; error: string | null }> {
  if (DATA_SOURCE === "mock") return { sent: 0, failed: 0, error: "Emails are not sent in mock mode." };
  if (DATA_SOURCE === "api") {
    try {
      if (event === "custom_email") {
        const { conferenceId, audiences, subject, body, templateLabel } = data as { conferenceId: string; audiences: string[]; subject: string; body: string; templateLabel?: string };
        const r = await api<{ queued: number; skipped: number }>(`/conferences/${conferenceId}/emails`, { method: "POST", body: { audiences, subject, body, ...(templateLabel ? { templateLabel } : {}) } });
        return { sent: r.queued, failed: 0, error: null };
      }
      if (event === "paper_message") {
        const { submissionId, to, subject, body } = data as { submissionId: string; to: string[]; subject: string; body: string };
        const r = await api<{ queued: number; skipped: number }>(`/submissions/${submissionId}/email`, { method: "POST", body: { to, subject, body } });
        return { sent: r.queued, failed: 0, error: null };
      }
      return { sent: 0, failed: 0, error: "This email isn't available with the own backend." };
    } catch (e) { return { sent: 0, failed: 0, error: e instanceof Error ? e.message : "The email couldn't be sent." }; }
  }
  try {
    const { data: { session } } = await (await supabase()).auth.getSession();
    if (!session) return { sent: 0, failed: 0, error: "You're signed out — please sign in again." };
    const res = await fetch("/api/send-email", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ event, data }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; failed?: unknown[] };
    if (!res.ok) return { sent: 0, failed: 0, error: body.error || `The email couldn't be sent (error ${res.status}).` };
    return { sent: Number(body.sent ?? 0), failed: Array.isArray(body.failed) ? body.failed.length : 0, error: null };
  } catch (e) {
    return { sent: 0, failed: 0, error: e instanceof Error ? e.message : "The email service didn't answer." };
  }
}
