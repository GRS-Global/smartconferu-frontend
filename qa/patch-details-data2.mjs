// One-off edit helper: the real service (venue address, logo, license request, CFP facts) and the mock's Conference Details info.
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/";

edit(d + "mocks/chair.ts", [[`topics: [], status: "active" }; },`, `topics: [], status: "active", address: "", postalCode: "", lat: null, lng: null, logoUrl: "", logoPath: "", createdAt: "2026-11-03", licenseExpiry: "" }; },`]]);

edit(d + "services/supabase/chair.ts", [
  ["submission_deadline: string | null; review_deadline: string | null; status: string; details: Record<string, unknown> | null }>(", "submission_deadline: string | null; review_deadline: string | null; status: string; details: Record<string, unknown> | null; logo_path: string | null; created_at: string }>("],
  ['review_deadline, status, details").eq("slug", conferenceSlug).limit(1), "read this conference");', 'review_deadline, status, details, logo_path, created_at").eq("slug", conferenceSlug).limit(1), "read this conference");'],
  ["      topics: Array.isArray(x.details?.topics) ?", `      address: str(x.details?.address), postalCode: str(x.details?.postalCode), lat: typeof x.details?.lat === "number" ? x.details.lat : null, lng: typeof x.details?.lng === "number" ? x.details.lng : null,
      logoPath: x.logo_path ?? "", logoUrl: x.logo_path ? db.storage.from("public").getPublicUrl(x.logo_path).data.publicUrl : "", createdAt: isoDay(x.created_at), licenseExpiry: str(x.details?.licenseExpiry),
      topics: Array.isArray(x.details?.topics) ?`],
  ["smartConfEmail: i.smartConfEmail, topics: i.topics };", "smartConfEmail: i.smartConfEmail, topics: i.topics, address: i.address, postalCode: i.postalCode, lat: i.lat, lng: i.lng };"],
  ["  async loadReviewSetup(conferenceSlug) {", `  // The logo lives in the public bucket under the conference's own folder; the column points at it. A new file each time, so a changed logo is never served from a cache.
  async saveLogo(conferenceSlug, file) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string; logo_path: string | null }>(db.from("conferences").select("id, logo_path").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    if (!file) {
      const { error } = await db.from("conferences").update({ logo_path: null }).eq("id", conf[0].id);
      if (error) fail(error, "remove the logo");
      return "";
    }
    if (!/^image\\/(png|jpeg|svg\\+xml|webp)$/.test(file.type)) throw new ServiceError("Use a PNG, JPEG, SVG or WebP image.");
    if (file.size > 2 * 1024 * 1024) throw new ServiceError("The logo is over 2 MB. Choose a smaller file.");
    const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
    const path = \`\${conf[0].id}/logo-\${Date.now()}.\${ext}\`;
    const { error: putError } = await db.storage.from("public").upload(path, file, { contentType: file.type, upsert: false });
    if (putError) throw new ServiceError(putError.message || "Couldn't upload the logo.");
    const { error } = await db.from("conferences").update({ logo_path: path }).eq("id", conf[0].id);
    if (error) fail(error, "save the logo");
    return db.storage.from("public").getPublicUrl(path).data.publicUrl;
  },

  // \`license_requests\` and its functions are migration 0035; until it is run there is simply no request.
  async loadLicenseRequest(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return null;
    const { data, error } = await db.from("license_requests").select("id, requested_date, reason, status, decision_reason, new_expiry, created_at").eq("conference_id", conf[0].id).order("created_at", { ascending: false }).limit(1);
    if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) return null; fail(error, "read the license request"); }
    const r = (data ?? [])[0] as { id: string; requested_date: string; reason: string | null; status: string; decision_reason: string | null; new_expiry: string | null; created_at: string } | undefined;
    if (!r) return null;
    return { id: r.id, requestedDate: r.requested_date, reason: r.reason ?? "", status: (["pending", "approved", "declined", "withdrawn"].includes(r.status) ? r.status : "pending") as LicenseRequest["status"], decisionReason: r.decision_reason ?? "", newExpiry: r.new_expiry ?? "", createdAt: r.created_at };
  },
  async requestLicenseExtension(conferenceSlug, requestedDate, reason) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const { error } = await db.rpc("request_license_extension", { p_conference: conf[0].id, p_date: requestedDate, p_reason: reason });
    if (error) { if (/does not exist|schema cache|Could not find the function/i.test(error.message ?? "")) throw new ServiceError("Run supabase/migrations/0035_license_requests.sql to send license requests."); fail(error, "send the request"); }
  },
  async withdrawLicenseRequest(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return;
    const { error } = await db.rpc("withdraw_license_request", { p_conference: conf[0].id });
    if (error) fail(error, "withdraw the request");
  },

  // The Call for Papers' own facts the Conference Details rail shows: who else manages it, and whether the publishing intent is written.
  async loadCfpFacts(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return { managers: 0, publishing: false };
    const [managers, cfp] = await Promise.all([
      db.from("conference_members").select("id", { count: "exact", head: true }).eq("conference_id", conf[0].id).eq("role", "cfp_manager").neq("status", "removed"),
      db.from("cfps").select("content").eq("conference_id", conf[0].id).limit(1),
    ]);
    const content = ((cfp.data ?? [])[0] as { content: Record<string, unknown> | null } | undefined)?.content;
    return { managers: managers.count ?? 0, publishing: typeof content?.publication === "string" && content.publication.trim() !== "" };
  },

  async loadReviewSetup(conferenceSlug) {`],
]);
let r = fs.readFileSync(d + "services/supabase/chair.ts", "utf8");
r = r.replace(/^import type \{ ChairActivityLog,/m, "import type { LicenseRequest, ChairActivityLog,"); fs.writeFileSync(d + "services/supabase/chair.ts", r);
console.log("applied", n);
