// One-off edit helper: archive / restore a conference and ask for its deletion (the database already has these functions: 0012 and 0013).
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/";
edit(d + "types/chair.ts", [["/** What the Call for Papers already has,", `/** A chair's request to have an archived conference deleted, and what the Super Admin answered (\`conference_deletion_requests\`, migration 0013). */
export interface DeletionRequest { status: "pending" | "approved" | "rejected" | "cancelled"; reason: string; adminNote: string }
/** What the Call for Papers already has,`]]);
edit(d + "services/chair.ts", [
  ["  /** Uploads the logo (null removes it)", `  /** Archives the conference by hand (new submissions stop; everything stays) or puts it back to active. */
  archiveConference(conferenceSlug: string): Promise<void>;
  restoreConference(conferenceSlug: string): Promise<void>;
  /** The latest deletion request for an archived conference, if any. */
  loadDeletionRequest(conferenceSlug: string): Promise<DeletionRequest | null>;
  requestDeletion(conferenceSlug: string, reason: string): Promise<void>;
  cancelDeletion(conferenceSlug: string): Promise<void>;
  /** Uploads the logo (null removes it)`],
  ["import type { CfpFacts,", "import type { DeletionRequest, CfpFacts,"],
]);
edit(d + "mocks/chair.ts", [["  async saveLogo(_slug, file)", `  async archiveConference() { /* mock mode keeps nothing */ },
  async restoreConference() { /* mock mode keeps nothing */ },
  async loadDeletionRequest() { return null; },
  async requestDeletion() { /* mock mode keeps nothing */ },
  async cancelDeletion() { /* mock mode keeps nothing */ },
  async saveLogo(_slug, file)`]]);
edit(d + "services/supabase/chair.ts", [
  ["  // The logo lives in the public bucket", `  // Archive / restore / the deletion request: the functions of migrations 0012 and 0013.
  async archiveConference(conferenceSlug) { await confRpc(conferenceSlug, "archive_conference", {}, "archive this conference"); },
  async restoreConference(conferenceSlug) { await confRpc(conferenceSlug, "restore_conference", {}, "restore this conference"); },
  async requestDeletion(conferenceSlug, reason) { await confRpc(conferenceSlug, "request_conference_deletion", { p_reason: reason }, "ask for this conference to be deleted"); },
  async cancelDeletion(conferenceSlug) { await confRpc(conferenceSlug, "cancel_conference_deletion", {}, "take back the deletion request"); },
  async loadDeletionRequest(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return null;
    const { data, error } = await db.from("conference_deletion_requests").select("status, reason, admin_note").eq("conference_id", conf[0].id).order("created_at", { ascending: false }).limit(1);
    if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) return null; fail(error, "read the deletion request"); }
    const r = (data ?? [])[0] as { status: string; reason: string | null; admin_note: string | null } | undefined;
    return r ? { status: (["pending", "approved", "rejected", "cancelled"].includes(r.status) ? r.status : "pending") as DeletionRequest["status"], reason: r.reason ?? "", adminNote: r.admin_note ?? "" } : null;
  },

  // The logo lives in the public bucket`],
]);
// the helper the four calls share
let r = fs.readFileSync(d + "services/supabase/chair.ts", "utf8");
if (!r.includes("async function confRpc")) {
  r = r.replace(/^import type \{ DeletionRequest,/m, "import type { DeletionRequest,");
  const at = r.indexOf("export const supabaseChairService") >= 0 ? r.indexOf("export const supabaseChairService") : r.search(/^export const \w+: ChairService/m);
  r = r.slice(0, at) + `/** Calls a conference function of the database ("archive_conference" …) for the conference with this slug. */
async function confRpc(slug: string, fn: string, args: Record<string, unknown>, doing: string): Promise<void> {
  const db: SupabaseClient = getSupabase();
  await currentUser(db);
  const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", slug).limit(1), "read this conference");
  if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
  const { error } = await db.rpc(fn, { p_conference: conf[0].id, ...args });
  if (error) fail(error, doing);
}

` + r.slice(at);
  fs.writeFileSync(d + "services/supabase/chair.ts", r);
}
console.log("applied", n);
