// One-off edit helper: "Author sees" on a decision type (types, chair service).
import fs from "node:fs";
let n = 0;
const S = "../src/";
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };

edit(S + "types/chair.ts", [[`export interface DecisionType { id: string; label: string; color: string; outcome: Outcome; description: string }`, `export interface DecisionType { id: string; label: string; color: string; outcome: Outcome; description: string; /** The status text the author sees ("" = the agreed wording for the outcome; migration 0039). */ authorLabel?: string }`]]);
edit(S + "types/author-submission.ts", [[`  uploadPending: boolean;\n`, `  uploadPending: boolean;\n  /** The chair's own wording of the statuses (Settings › Decision › "Author sees"), by status key; missing = the agreed label. */\n  statusLabels?: Record<string, string>;\n`]]);

const ROW = `{ id: string; label: string; color: string; outcome: Outcome; description: string | null; author_label: string | null }`;
edit(S + "services/supabase/chair.ts", [
  [`      rows<{ id: string; label: string; color: string; outcome: Outcome; description: string | null }>(db.from("decision_types").select("id, label, color, outcome, description").eq("conference_id", cid).order("position"), "read the decision types"),`, `      decisionTypeRows(db, cid),`],
  [`description: t.description ?? "" }));\n    // `, `description: t.description ?? "", authorLabel: t.author_label ?? "" }));\n    // `],
  [`    const mk = (t: DecisionType, i: number) => ({ conference_id: conf[0].id, label: t.label.trim(), color: t.color.toUpperCase(), outcome: t.outcome, description: t.description.trim() || null, position: i });`, `    if (types.some((t) => (t.authorLabel ?? "").length > 120)) throw new ServiceError("Couldn't save that. The text the author sees is too long.");
    // The "Author sees" column is migration 0039; until it is run the rest is saved and the text is not.
    const hasColumn = (await db.from("decision_types").select("author_label").limit(1)).error === null;
    if (!hasColumn && types.some((t) => (t.authorLabel ?? "").trim())) throw new ServiceError("Run supabase/migrations/0039_decision_author_label.sql to save the text authors see.");
    const mk = (t: DecisionType, i: number) => ({ conference_id: conf[0].id, label: t.label.trim(), color: t.color.toUpperCase(), outcome: t.outcome, description: t.description.trim() || null, position: i, ...(hasColumn ? { author_label: (t.authorLabel ?? "").trim() || null } : {}) });`],
  [`/** Calls a conference function of the database ("archive_conference" …)`, `/** The conference's decision types; the "Author sees" text (migration 0039) is read when its column exists. */
async function decisionTypeRows(db: SupabaseClient, conferenceId: string): Promise<Array<${ROW}>> {
  const full = await db.from("decision_types").select("id, label, color, outcome, description, author_label").eq("conference_id", conferenceId).order("position");
  if (!full.error) return (full.data ?? []) as Array<${ROW}>;
  const old = await rows<{ id: string; label: string; color: string; outcome: Outcome; description: string | null }>(db.from("decision_types").select("id, label, color, outcome, description").eq("conference_id", conferenceId).order("position"), "read the decision types");
  return old.map((t) => ({ ...t, author_label: null }));
}

/** Calls a conference function of the database ("archive_conference" …)`],
]);
console.log("applied", n);
