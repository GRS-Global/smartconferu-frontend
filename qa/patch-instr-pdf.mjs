// One-off edit helper: reviewer instructions as a PDF (types, services, editor, reviewer page).
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const S = "../src/";

fs.writeFileSync(S + "services/supabase/instructions.ts", `import type { SupabaseClient } from "@supabase/supabase-js";
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
`); n++;

edit(S + "types/chair.ts", [[`custom: boolean; instructions: string }`, `custom: boolean; instructions: string; /** What reviewers read: the written text or the attached PDF (migration 0038). */ instructionsMode: "html" | "pdf"; instructionsPdf: InstructionsPdf | null }
/** A reviewer-instructions PDF: its own file name and its address. */
export interface InstructionsPdf { name: string; url: string }`]]);
edit(S + "types/reviewer.ts", [[`  instructions: string;\n`, `  instructions: string;\n  /** Whether reviewers read the text or the attached PDF, and the PDF (migration 0038). */\n  instructionsMode: "html" | "pdf";\n  instructionsPdf: import("./chair").InstructionsPdf | null;\n`]]);

edit(S + "services/chair.ts", [[`  saveReviewInstructions(conferenceSlug: string, text: string): Promise<void>;`, `  saveReviewInstructions(conferenceSlug: string, text: string): Promise<void>;
  /** Whether reviewers read the written text or the attached PDF (migration 0038). */
  saveReviewInstructionsMode(conferenceSlug: string, mode: "html" | "pdf"): Promise<void>;
  /** Attaches the PDF reviewers read (stored in the \`public\` bucket, migration 0038). */
  saveReviewInstructionsPdf(conferenceSlug: string, file: File): Promise<import("@/types/chair").InstructionsPdf>;`]]);

edit(S + "mocks/chair.ts", [
  [`return { form: PEER_REVIEW_FORM, custom: false, instructions: "" }; },`, `return { form: PEER_REVIEW_FORM, custom: false, instructions: "", instructionsMode: "html", instructionsPdf: null }; },`],
  [`  async saveReviewInstructions() { /* mock mode keeps nothing */ },`, `  async saveReviewInstructions() { /* mock mode keeps nothing */ },
  async saveReviewInstructionsMode() { /* mock mode keeps nothing */ },
  async saveReviewInstructionsPdf(_slug, file) { return { name: file.name, url: URL.createObjectURL(file) }; },`],
]);

edit(S + "services/supabase/chair.ts", [
  [`async function upsertSettings(conferenceSlug: string, cols: Record<string, unknown>): Promise<void> {`, `async function upsertSettings(conferenceSlug: string, cols: Record<string, unknown>, migration = "0028_conference_settings.sql"): Promise<void> {`],
  [`throw new ServiceError("Run supabase/migrations/0028_conference_settings.sql to save this setting.");`, `throw new ServiceError(\`Run supabase/migrations/\${migration} to save this setting.\`);`],
  [`  const [formRow, setRow] = await Promise.all([
    db.from("conference_forms").select("schema").eq("conference_id", conferenceId).eq("kind", "peer_review").maybeSingle(),
    db.from("conference_settings").select("review_instructions").eq("conference_id", conferenceId).maybeSingle(),
  ]);
  const custom = formRow.error ? null : sectionsFromStored((formRow.data as { schema: unknown } | null)?.schema);
  return { form: custom ?? PEER_REVIEW_FORM, custom: custom !== null, instructions: setRow.error ? "" : ((setRow.data as { review_instructions: string | null } | null)?.review_instructions ?? "") };`,
   `  const [formRow, ins] = await Promise.all([
    db.from("conference_forms").select("schema").eq("conference_id", conferenceId).eq("kind", "peer_review").maybeSingle(),
    readInstructions(db, conferenceId),
  ]);
  const custom = formRow.error ? null : sectionsFromStored((formRow.data as { schema: unknown } | null)?.schema);
  return { form: custom ?? PEER_REVIEW_FORM, custom: custom !== null, instructions: ins.text, instructionsMode: ins.mode, instructionsPdf: ins.pdf };`],
  [`if (!conf[0]) return { form: PEER_REVIEW_FORM, custom: false, instructions: "" };`, `if (!conf[0]) return { form: PEER_REVIEW_FORM, custom: false, instructions: "", instructionsMode: "html", instructionsPdf: null };`],
  [`    await upsertSettings(conferenceSlug, { review_instructions: text.trim() || null });
  },`, `    await upsertSettings(conferenceSlug, { review_instructions: text.trim() || null });
  },

  async saveReviewInstructionsMode(conferenceSlug, mode) {
    await upsertSettings(conferenceSlug, { review_instructions_mode: mode }, "0038_review_instructions_pdf.sql");
  },

  async saveReviewInstructionsPdf(conferenceSlug, file) {
    if (file.type !== "application/pdf" && !/\\.pdf$/i.test(file.name)) throw new ServiceError("Choose a PDF file.");
    if (file.size > 5 * 1024 * 1024) throw new ServiceError("The PDF is over 5 MB. Choose a smaller file.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const path = \`\${conf[0].id}/review-instructions-\${Date.now()}.pdf\`;
    const { error: putError } = await db.storage.from("public").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (putError) throw new ServiceError(/mime|not supported|allowed/i.test(putError.message ?? "") ? "Run supabase/migrations/0038_review_instructions_pdf.sql to attach a PDF." : putError.message || "Couldn't upload the PDF.");
    await upsertSettings(conferenceSlug, { review_instructions_pdf_path: path, review_instructions_pdf_name: file.name.slice(0, 200) }, "0038_review_instructions_pdf.sql");
    return { name: file.name.slice(0, 200), url: db.storage.from("public").getPublicUrl(path).data.publicUrl };
  },`],
  [`import { ServiceError } from "../errors";`, `import { ServiceError } from "../errors";\nimport { readInstructions } from "./instructions";`],
]);

edit(S + "services/supabase/reviewer.ts", [
  [`    const [formRow, setRow] = cid ? await Promise.all([
      db.from("conference_forms").select("schema").eq("conference_id", cid).eq("kind", "peer_review").maybeSingle(),
      db.from("conference_settings").select("review_instructions").eq("conference_id", cid).maybeSingle(),
    ]) : [null, null];`, `    const [formRow, ins] = cid ? await Promise.all([
      db.from("conference_forms").select("schema").eq("conference_id", cid).eq("kind", "peer_review").maybeSingle(),
      readInstructions(db, cid),
    ]) : [null, null];`],
  [`    const instructions = setRow && !setRow.error ? ((setRow.data as { review_instructions: string | null } | null)?.review_instructions ?? "") : "";`, `    const instructions = ins?.text ?? "";`],
  [`      paper: found, form, instructions,`, `      paper: found, form, instructions, instructionsMode: ins?.mode ?? "html", instructionsPdf: ins?.pdf ?? null,`],
  [`import { ServiceError } from "../errors";`, `import { ServiceError } from "../errors";\nimport { readInstructions } from "./instructions";`],
]);
edit(S + "mocks/reviewer.ts", [[`form: PEER_REVIEW_FORM, instructions: "", values:`, `form: PEER_REVIEW_FORM, instructions: "", instructionsMode: "html", instructionsPdf: null, values:`]]);
console.log("applied", n);
