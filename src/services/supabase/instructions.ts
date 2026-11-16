import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstructionsPdf } from "@/types/chair";

/** The reviewers' instructions of a conference: the written text, whether the text or the attached PDF is what reviewers read, and the PDF.
 *  The mode and the PDF are columns of migration 0038; until it is run only the text is read. */
export async function readInstructions(db: SupabaseClient, conferenceId: string): Promise<{ text: string; mode: "html" | "pdf"; pdf: InstructionsPdf | null; error: boolean }> {
  const full = await db.from("conference_settings").select("review_instructions, review_instructions_mode, review_instructions_pdf_path, review_instructions_pdf_name").eq("conference_id", conferenceId).maybeSingle();
  if (!full.error) {
    const r = full.data as { review_instructions: string | null; review_instructions_mode: string | null; review_instructions_pdf_path: string | null; review_instructions_pdf_name: string | null } | null;
    const pdf = r?.review_instructions_pdf_path ? { name: r.review_instructions_pdf_name || "Reviewer instructions.pdf", url: db.storage.from("public").getPublicUrl(r.review_instructions_pdf_path).data.publicUrl } : null;
    return { text: r?.review_instructions ?? "", mode: r?.review_instructions_mode === "pdf" ? "pdf" : "html", pdf, error: false };
  }
  const old = await db.from("conference_settings").select("review_instructions").eq("conference_id", conferenceId).maybeSingle();
  return { text: old.error ? "" : ((old.data as { review_instructions: string | null } | null)?.review_instructions ?? ""), mode: "html", pdf: null, error: Boolean(old.error) };
}
