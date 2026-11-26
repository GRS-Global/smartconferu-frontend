import { getSupabase } from "@/lib/supabase";
import { designWithoutReference, signatureIdsIn } from "@/features/certificates/studio/images";
import type { SignatureRecord, SignatureService } from "../signatures";
import { currentUser, fail } from "./shared";

/* The conference's signature library in Supabase (migration 0048): rows in `certificate_signatures`, pictures in the `certificate-signatures`
   bucket under the signature's id. Row Level Security lets only the conference's chairs touch either. The order matters: the row is made
   BEFORE its picture is uploaded (the storage policy looks the row up), and the picture is removed BEFORE its row. */

const BUCKET = "certificate-signatures";
const COLUMNS = "id, conference_id, name, designation, institution, content_type, size_bytes, is_default, created_at";
const MAX_BYTES = 1024 * 1024;

interface Row { id: string; conference_id: string; name: string; designation: string; institution: string; content_type: string; size_bytes: number; is_default: boolean; created_at: string }
const toRecord = (r: Row): SignatureRecord => ({ id: r.id, name: r.name, designation: r.designation, institution: r.institution, contentType: r.content_type, sizeBytes: r.size_bytes, isDefault: r.is_default, createdAt: r.created_at });

/** The real type from the first bytes (a renamed file does not pass), as the backend does. */
async function imageType(file: File): Promise<"image/png" | "image/jpeg" | "image/webp"> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  throw new Error("Signatures must be a PNG (transparent works best), JPG or WebP image.");
}
function checkSize(file: File) {
  if (file.size > MAX_BYTES) throw new Error(`That image is ${Math.round(file.size / 1024)} KB: please use one under 1 MB.`);
  if (file.size === 0) throw new Error("That file is empty.");
}

export const supabaseSignatureService: SignatureService = {
  async list(conferenceDbId) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.from("certificate_signatures").select(COLUMNS).eq("conference_id", conferenceDbId).order("created_at");
    if (error) fail(error, "read the signatures");
    return ((data ?? []) as Row[]).map(toRecord);
  },

  async create(conferenceDbId, { file, name, designation, institution }) {
    const db = getSupabase();
    await currentUser(db);
    checkSize(file);
    const contentType = await imageType(file);
    const { count, error: countError } = await db.from("certificate_signatures").select("id", { count: "exact", head: true }).eq("conference_id", conferenceDbId);
    if (countError) fail(countError, "add the signature");
    const id = crypto.randomUUID();
    const { data, error } = await db.from("certificate_signatures")
      .insert({ id, conference_id: conferenceDbId, name: name.trim(), designation: designation.trim(), institution: institution.trim(), storage_path: id, content_type: contentType, size_bytes: file.size, is_default: (count ?? 0) === 0 })
      .select(COLUMNS).single();
    if (error) fail(error, "add the signature");
    const put = await db.storage.from(BUCKET).upload(id, file, { contentType, upsert: false });
    if (put.error) {
      await db.from("certificate_signatures").delete().eq("id", id); // no row without a picture
      fail(put.error, "upload the signature picture");
    }
    return toRecord(data as Row);
  },

  async update(id, patch) {
    const db = getSupabase();
    await currentUser(db);
    const fields = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.designation !== undefined ? { designation: patch.designation.trim() } : {}),
      ...(patch.institution !== undefined ? { institution: patch.institution.trim() } : {}),
    };
    if (Object.keys(fields).length) {
      const { error } = await db.from("certificate_signatures").update(fields).eq("id", id);
      if (error) fail(error, "save the signature");
    }
    if (patch.isDefault === true) {
      const { error } = await db.rpc("set_default_certificate_signature", { p_id: id });
      if (error) fail(error, "make this the default signature");
    }
    const { data, error } = await db.from("certificate_signatures").select(COLUMNS).eq("id", id).single();
    if (error) fail(error, "read the signature");
    return toRecord(data as Row);
  },

  async replaceImage(id, file) {
    const db = getSupabase();
    await currentUser(db);
    checkSize(file);
    const contentType = await imageType(file);
    const put = await db.storage.from(BUCKET).upload(id, file, { contentType, upsert: true });
    if (put.error) fail(put.error, "upload the signature picture");
    const { data, error } = await db.from("certificate_signatures").update({ content_type: contentType, size_bytes: file.size }).eq("id", id).select(COLUMNS).single();
    if (error) fail(error, "save the signature");
    return toRecord(data as Row);
  },

  async remove(id, opts) {
    const db = getSupabase();
    await currentUser(db);
    const { data: sig, error: readError } = await db.from("certificate_signatures").select("conference_id").eq("id", id).single();
    if (readError) fail(readError, "read the signature");
    // A design that still shows this picture would be left with a broken image: say which ones.
    const { data: designs, error: designsError } = await db.from("certificate_designs").select("id, name, design").eq("conference_id", (sig as { conference_id: string }).conference_id);
    if (designsError) fail(designsError, "check where the signature is used");
    const using = ((designs ?? []) as Array<{ id: string; name: string; design: unknown }>).filter((d) => signatureIdsIn(d.design).includes(id));
    if (using.length && opts?.removeFromDesigns) {
      for (const d of using) {
        const { error: stripError } = await db.from("certificate_designs").update({ design: designWithoutReference(d.design, `sig:${id}`, true) }).eq("id", d.id);
        if (stripError) fail(stripError, "take the signature off the certificates");
      }
    } else if (using.length) throw new Error(`This signature is used in ${using.length === 1 ? "the certificate" : "the certificates"} “${using.slice(0, 3).map((d) => d.name).join("”, “")}”${using.length > 3 ? ` and ${using.length - 3} more` : ""}. Remove it from there first.`);
    const gone = await db.storage.from(BUCKET).remove([id]);
    if (gone.error) fail(gone.error, "delete the signature picture");
    const { error } = await db.from("certificate_signatures").delete().eq("id", id);
    if (error) fail(error, "delete the signature");
  },
};
