import { PROTOTYPE_URL } from "@/lib/config";

/* Asks the email server to send the emails of an action that has just been saved. The server that works out the recipients,
   checks the user may do it and sends through Resend is the prototype's (/api/send-email, src/shared/emailRequest.js);
   this app has none of its own yet. The browser calls this route (same origin, so no CORS) and the route passes the request on,
   with the user's own sign-in token, to that server. Nothing here chooses who gets an email or what it says: only the
   events listed below can be passed on, each one checked again by the email server against the user's session. */

const EVENTS = new Set(["submission_withdrawn", "paper_authors_updated", "paper_revised", "review_submitted", "decision_notified", "reviewer_invited", "reviews_assigned", "screening_notified", "review_edited_by_chair", "submission_received", "submission_on_behalf", "custom_email", "paper_message", "conference_requested", "review_deadline_extended", "reviewer_message", "reviewer_removed", "fix_requested", "cfp_manager_invited", "certificate_issued"]);
const json = (body: unknown, status: number) => Response.json(body, { status });

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/.test(auth)) return json({ error: "You're signed out — please sign in again." }, 401);
  const body = (await req.json().catch(() => null)) as { event?: unknown; data?: unknown } | null;
  if (!body || typeof body.event !== "string" || !EVENTS.has(body.event) || typeof body.data !== "object" || body.data === null) return json({ error: "That email can't be sent from here." }, 400);
  try {
    const res = await fetch(`${PROTOTYPE_URL}/api/send-email`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: JSON.stringify({ event: body.event, data: body.data }),
      signal: AbortSignal.timeout(30_000),
    });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
  } catch {
    return json({ error: "The email service didn't answer." }, 502);
  }
}
