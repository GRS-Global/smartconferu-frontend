import fs from "node:fs";
let n = 0;
const S = "../src/";
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
edit(S + "services/supabase/author-submissions.ts", [
  [`const PAPERS_BUCKET = "papers";`, `const PAPERS_BUCKET = "papers";

// Which status of the author's views each decision outcome words (Settings › Decision › "Author sees").
const LABEL_KEY: Record<string, string> = { upload_pending: "draft", no_decision: "waiting", plagiarism_clear: "waiting", revise: "revise", waitlist: "waitlisted", accept: "pending", registered: "registered", reject: "rejected" };
/** The chair's own wording of the statuses for a conference ("Author sees"; migration 0039): {} when none is set or the column is not there yet. */
async function statusLabelsOf(db: SupabaseClient, conferenceId: string): Promise<Record<string, string>> {
  const { data, error } = await db.from("decision_types").select("outcome, author_label").eq("conference_id", conferenceId).order("position");
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ outcome: string; author_label: string | null }>) {
    const label = (r.author_label ?? "").trim(); const key = LABEL_KEY[r.outcome];
    if (label && key && !out[key]) out[key] = label;
  }
  return out;
}`],
  [`    const out: AuthorPaper = {
      id: \`\${paperPrefix(conf.acronym)}-\${s.paper_no}\`,`, `    const statusLabels = await statusLabelsOf(db, conf.id);
    const out: AuthorPaper = {
      statusLabels,
      id: \`\${paperPrefix(conf.acronym)}-\${s.paper_no}\`,`],
  [`      return {
        id: \`\${paperPrefix(conf[0].acronym)}-\${s.paper_no}\`,`, `      return {
        statusLabels,
        id: \`\${paperPrefix(conf[0].acronym)}-\${s.paper_no}\`,`],
  [`    const subIds = subs.map((s) => s.id);\n    const [authors, files] = await Promise.all([`, `    const subIds = subs.map((s) => s.id);\n    const statusLabels = await statusLabelsOf(db, conf[0].id);\n    const [authors, files] = await Promise.all([`],
]);
edit(S + "features/author/status.ts", [
  [`export function authorStatusOf(s: Pick<AuthorSubmission, "withdrawn" | "result" | "uploadPending" | "decision"> & { screeningRequest?: unknown }, finished: boolean): Status {`, `export function authorStatusOf(s: Pick<AuthorSubmission, "withdrawn" | "result" | "uploadPending" | "decision" | "statusLabels"> & { screeningRequest?: unknown }, finished: boolean): Status {
  const status = baseStatusOf(s, finished);
  // The chair's own wording ("Author sees" under Settings › Decision), when there is one for this status.
  const custom = s.statusLabels?.[status.key];
  return custom ? { ...status, label: custom } : status;
}

function baseStatusOf(s: Pick<AuthorSubmission, "withdrawn" | "result" | "uploadPending" | "decision"> & { screeningRequest?: unknown }, finished: boolean): Status {`],
  [`   Wording: the prototype takes a status's label from the chair's decision type ("Author sees"). The database has no such
   column (decision_types holds label / colour / outcome only), so there, as here, every label is the agreed default. */`, `   Wording: the prototype takes a status's label from the chair's decision type ("Author sees"); here that is the \`statusLabels\` of the
   submission (decision_types.author_label, migration 0039), and every status without one keeps the agreed label. */`],
]);
console.log("applied", n);
