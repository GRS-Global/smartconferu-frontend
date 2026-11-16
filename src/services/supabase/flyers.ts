import { getSupabase } from "@/lib/supabase";
import { normalizeFlyerDesign, type FlyerDesign, type SavedFlyer } from "@/features/flyer/data";
import type { FlyerService } from "../flyers";
import { currentUser, fail } from "./shared";

/* The speaker flyer template of a conference (migration 0048), read and written with the user's own session: Row Level Security lets only the
   conference's chairs touch it. */

interface FlyerRow { design: Partial<FlyerDesign> | null; published: boolean; downloads: number }
const COLUMNS = "design, published, downloads";
const toSaved = (r: FlyerRow): SavedFlyer => ({ design: normalizeFlyerDesign(r.design), published: r.published, downloads: r.downloads });

export const supabaseFlyerService: FlyerService = {
  async load(conferenceDbId) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.from("conference_flyers").select(COLUMNS).eq("conference_id", conferenceDbId).maybeSingle();
    if (error) fail(error, "read the speaker flyer");
    return data ? toSaved(data as FlyerRow) : null;
  },
  async save(conferenceDbId, design, published) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.from("conference_flyers").upsert({ conference_id: conferenceDbId, design, published }, { onConflict: "conference_id" }).select(COLUMNS).single();
    if (error) fail(error, "save the speaker flyer");
    return toSaved(data as FlyerRow);
  },
  async loadPublished(conferenceSlug) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.rpc("my_published_flyer", { p_slug: conferenceSlug });
    // Until migration 0049 is run the function does not exist: nothing is published as far as the author can tell.
    if (error) { if (/could not find the function|does not exist|schema cache/i.test(error.message ?? "")) return null; fail(error, "read the speaker flyer"); }
    const row = data as { design?: Partial<FlyerDesign> } | null;
    return row?.design ? normalizeFlyerDesign(row.design) : null;
  },
  async countDownload(conferenceSlug) {
    try { await getSupabase().rpc("count_flyer_download", { p_slug: conferenceSlug }); } catch { /* counting only */ }
  },
};
