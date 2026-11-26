import { getSupabase } from "@/lib/supabase";
import { assetIdsIn, designWithoutReference } from "@/features/certificates/studio/images";
import type { AssetRecord, AssetService } from "../assets";
import { ASSET_MAX_BYTES } from "../assets";
import { currentUser, fail } from "./shared";

/* The picture library in Supabase (migration 0049): rows in `certificate_assets`, pictures in the `certificate-assets` bucket under the asset's id.
   Row Level Security lets only the conference's chairs touch either. As with signatures, the row is made BEFORE its picture is uploaded (the storage
   policy looks the row up) and the picture is removed BEFORE its row. */

const BUCKET = "certificate-assets";
const COLUMNS = "id, conference_id, name, content_type, size_bytes, created_at";

interface Row { id: string; conference_id: string; name: string; content_type: string; size_bytes: number; created_at: string }
const toRecord = (r: Row): AssetRecord => ({ id: r.id, name: r.name, contentType: r.content_type, sizeBytes: r.size_bytes, createdAt: r.created_at });
const cleanName = (n: string) => n.replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/\s+/g, " ").trim().slice(0, 120);

/** The real type from the first bytes (a renamed file does not pass). */
async function imageType(file: File): Promise<"image/png" | "image/jpeg" | "image/webp"> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  throw new Error("Pictures must be PNG (transparent works), JPG or WebP.");
}
function checkSize(file: File) {
  if (file.size === 0) throw new Error("That file is empty.");
  if (file.size > ASSET_MAX_BYTES) throw new Error(`That picture is ${(file.size / 1024 / 1024).toFixed(1)} MB: please use one under 2 MB.`);
}

export const supabaseAssetService: AssetService = {
  async list(conferenceDbId) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.from("certificate_assets").select(COLUMNS).eq("conference_id", conferenceDbId).order("created_at");
    if (error) fail(error, "read the pictures");
    return ((data ?? []) as Row[]).map(toRecord);
  },

  async create(conferenceDbId, { file, name }) {
    const db = getSupabase();
    await currentUser(db);
    checkSize(file);
    const contentType = await imageType(file);
    const id = crypto.randomUUID();
    const { data, error } = await db.from("certificate_assets")
      .insert({ id, conference_id: conferenceDbId, name: cleanName(name ?? "") || cleanName(file.name) || "Picture", storage_path: id, content_type: contentType, size_bytes: file.size })
      .select(COLUMNS).single();
    if (error) fail(error, "add the picture");
    const put = await db.storage.from(BUCKET).upload(id, file, { contentType, upsert: false });
    if (put.error) {
      await db.from("certificate_assets").delete().eq("id", id); // no row without a picture
      fail(put.error, "upload the picture");
    }
    return toRecord(data as Row);
  },

  async rename(id, name) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.from("certificate_assets").update({ name: cleanName(name) || "Picture" }).eq("id", id).select(COLUMNS).single();
    if (error) fail(error, "rename the picture");
    return toRecord(data as Row);
  },

  async replaceImage(id, file) {
    const db = getSupabase();
    await currentUser(db);
    checkSize(file);
    const contentType = await imageType(file);
    const put = await db.storage.from(BUCKET).upload(id, file, { contentType, upsert: true });
    if (put.error) fail(put.error, "upload the picture");
    const { data, error } = await db.from("certificate_assets").update({ content_type: contentType, size_bytes: file.size }).eq("id", id).select(COLUMNS).single();
    if (error) fail(error, "save the picture");
    return toRecord(data as Row);
  },

  async remove(id, opts) {
    const db = getSupabase();
    await currentUser(db);
    const { data: asset, error: readError } = await db.from("certificate_assets").select("conference_id").eq("id", id).single();
    if (readError) fail(readError, "read the picture");
    // A design that still shows this picture would be left with a broken image: say which ones.
    const { data: designs, error: designsError } = await db.from("certificate_designs").select("id, name, design").eq("conference_id", (asset as { conference_id: string }).conference_id);
    if (designsError) fail(designsError, "check where the picture is used");
    const using = ((designs ?? []) as Array<{ id: string; name: string; design: unknown }>).filter((d) => assetIdsIn(d.design).includes(id));
    if (using.length && opts?.removeFromDesigns) {
      for (const d of using) {
        const { error: stripError } = await db.from("certificate_designs").update({ design: designWithoutReference(d.design, `asset:${id}`, false) }).eq("id", d.id);
        if (stripError) fail(stripError, "take the picture off the certificates");
      }
    } else if (using.length) throw new Error(`This picture is used in ${using.length === 1 ? "the certificate" : "the certificates"} “${using.slice(0, 3).map((d) => d.name).join("”, “")}”${using.length > 3 ? ` and ${using.length - 3} more` : ""}. Remove it from there first.`);
    const gone = await db.storage.from(BUCKET).remove([id]);
    if (gone.error) fail(gone.error, "delete the picture");
    const { error } = await db.from("certificate_assets").delete().eq("id", id);
    if (error) fail(error, "delete the picture");
  },
};
