import { createClient } from "@supabase/supabase-js";

/* Deletes the signed-in person's own account. Deleting a sign-in needs Supabase's admin key, which must never reach the browser, so it
   happens here and only here:
     1. who is asking comes from their own sign-in token (never from the request body);
     2. they must have typed DELETE;
     3. an account that still owns records other people depend on is NOT deleted: it created a conference, chairs or manages one, submitted a
        paper, or wrote a review. Those belong to the conferences' own records; the person is told what is in the way instead;
     4. otherwise the sign-in is deleted (the profile, notifications, review assignments and other personal rows go with it through the
        database's own "on delete cascade"; co-author rows only lose the link to the account) and the profile photo is removed.
   It needs SUPABASE_SERVICE_ROLE_KEY in this app's server environment; without it the route says so and does nothing. */

const json = (body: unknown, status: number) => Response.json(body, { status });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return json({ error: "The account service isn't set up on this site." }, 503);
  if (!service) return json({ error: "Deleting accounts isn't switched on for this site yet. Ask the site's administrator to set SUPABASE_SERVICE_ROLE_KEY for this app." }, 501);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "You're signed out — please sign in again." }, 401);
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (typeof body?.confirm !== "string" || body.confirm.trim().toUpperCase() !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);

  const who = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  const user = who.data.user;
  if (!user) return json({ error: "You're signed out — please sign in again." }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const head = (table: string) => admin.from(table).select("id", { count: "exact", head: true });
    const [created, roles, papers, reviews] = await Promise.all([
      head("conferences").eq("created_by", user.id),
      head("conference_members").eq("user_id", user.id).in("role", ["chair", "track_chair", "cfp_manager"]),
      head("submissions").eq("submitter_id", user.id),
      head("reviews").eq("reviewer_id", user.id),
    ]);
    if (created.error || roles.error || papers.error || reviews.error) throw new Error("check failed");
    const blockers = [
      { n: created.count ?? 0, text: (n: number) => plural(n, "conference you created", "conferences you created") },
      { n: roles.count ?? 0, text: (n: number) => plural(n, "conference where you are a chair, track chair or CFP manager", "conferences where you are a chair, track chair or CFP manager") },
      { n: papers.count ?? 0, text: (n: number) => plural(n, "paper you submitted", "papers you submitted") },
      { n: reviews.count ?? 0, text: (n: number) => plural(n, "review you wrote", "reviews you wrote") },
    ].filter((b) => b.n > 0).map((b) => b.text(b.n));
    if (blockers.length) return json({ error: "This account can't be deleted yet: it still has records that belong to conferences.", blockers }, 409);

    // The profile photo lives in the public bucket under the person's own folder; a failure here must not stop the deletion.
    const files = await admin.storage.from("public").list(user.id).then((r) => r.data ?? [], () => []);
    if (files.length) await admin.storage.from("public").remove(files.map((f) => `${user.id}/${f.name}`)).catch(() => undefined);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: "Couldn't delete the account. Nothing was changed — please contact Smartconferu." }, 500);
    return json({ ok: true }, 200);
  } catch {
    return json({ error: "Couldn't check the account. Nothing was changed — please try again." }, 500);
  }
}
