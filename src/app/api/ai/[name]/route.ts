import { PROTOTYPE_URL } from "@/lib/config";

/* Passes the AI endpoints on to the prototype's server (src/shared/paperIngest.js, paperChat.js and the review-assist function), which
   reads the paper, checks the user reviews / chairs / authors it, calls the model and records the cost in ai_usage. Moving those
   functions into this app is still to do (PORT-PLAN, D2); until then this route is the only way the app reaches them. The browser calls it
   (same origin, so no CORS) with the user's own sign-in token, and the prototype's server checks the user again. Only the endpoints
   listed below can be reached, and only with a JSON body. */

const ENDPOINTS: Record<string, { path: string; timeout: number }> = {
  "ingest-paper": { path: "/api/ingest-paper", timeout: 30_000 },
  "paper-chat": { path: "/api/paper-chat", timeout: 90_000 },
  "enhance-review": { path: "/api/enhance-review", timeout: 90_000 },
  "suggest-topics": { path: "/api/suggest-topics", timeout: 60_000 },
  "screen-paper": { path: "/api/screen-paper", timeout: 60_000 },
  "extract-paper": { path: "/api/extract-paper", timeout: 60_000 },
};
const json = (body: unknown, status: number) => Response.json(body, { status });

export async function POST(req: Request, ctx: RouteContext<"/api/ai/[name]">) {
  const { name } = await ctx.params;
  const target = Object.prototype.hasOwnProperty.call(ENDPOINTS, name) ? ENDPOINTS[name] : null;
  if (!target) return json({ error: "That AI function isn't available here." }, 404);
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/.test(auth)) return json({ error: "You're signed out — please sign in again." }, 401);
  const raw = await req.text();
  if (raw.length > 200_000) return json({ error: "That request is too large." }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "That request isn't valid." }, 400); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return json({ error: "That request isn't valid." }, 400);
  try {
    const res = await fetch(`${PROTOTYPE_URL}${target.path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(target.timeout),
    });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
  } catch {
    return json({ error: "The AI service didn't answer." }, 502);
  }
}
