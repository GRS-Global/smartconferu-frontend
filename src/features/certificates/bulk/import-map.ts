import type { ManualPerson } from "../data";

/* Turning the columns of an uploaded sheet into people: which column is which field (matched by the header's name, the chair fixes the rest),
   then a check of every row. Only the fields a certificate knows about can be filled: nothing is invented. */

export type ImportFieldKey = "name" | "email" | "affiliation" | "roleLabel" | "paperId" | "paperTitle";
export interface ImportField { key: ImportFieldKey; label: string; required?: boolean; hint: string; synonyms: string[] }

export const IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "Full name", required: true, hint: "Printed on the certificate", synonyms: ["name", "full name", "fullname", "recipient", "recipient name", "participant", "participant name", "author", "author name", "attendee", "person"] },
  { key: "email", label: "Email", hint: "Needed to send it", synonyms: ["email", "e-mail", "email address", "mail", "e mail", "email id"] },
  { key: "affiliation", label: "Affiliation", hint: "University or organisation", synonyms: ["affiliation", "organisation", "organization", "institution", "university", "company", "college", "employer", "org"] },
  { key: "roleLabel", label: "Role on the certificate", hint: "e.g. Keynote Speaker", synonyms: ["role", "role label", "designation", "position", "title", "category", "type"] },
  { key: "paperId", label: "Paper ID", hint: "For presentation certificates", synonyms: ["paper id", "paperid", "submission id", "submission", "paper no", "paper number", "paper"] },
  { key: "paperTitle", label: "Paper title", hint: "For presentation certificates", synonyms: ["paper title", "papertitle", "title of paper", "submission title", "article title", "work title"] },
];

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** Column index per field, or -1. A header that matches a field exactly wins; otherwise one that contains a synonym. Each column is used once. */
export function autoMap(headers: string[]): Record<ImportFieldKey, number> {
  const taken = new Set<number>();
  const result = {} as Record<ImportFieldKey, number>;
  const cols = headers.map(norm);
  const pass = (exact: boolean) => {
    for (const f of IMPORT_FIELDS) {
      if (result[f.key] !== undefined && result[f.key] >= 0) continue;
      const i = cols.findIndex((c, idx) => !taken.has(idx) && f.synonyms.some((s) => (exact ? c === s : c.includes(s) && !(f.key === "name" && /paper|file|institution|organi[sz]ation|user ?name/.test(c)))));
      result[f.key] = i;
      if (i >= 0) taken.add(i);
    }
  };
  pass(true);
  pass(false);
  IMPORT_FIELDS.forEach((f) => { result[f.key] ??= -1; });
  return result;
}

const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e);

export type RowProblem = "no-name" | "bad-email" | "no-email" | "duplicate-in-file" | "duplicate-in-list";
export interface ImportRow { line: number; person: Omit<ManualPerson, "key">; problems: RowProblem[] }

export const PROBLEM_TEXT: Record<RowProblem, string> = {
  "no-name": "No name: skipped",
  "bad-email": "The email address looks wrong",
  "no-email": "No email address (it can't be sent until one is added)",
  "duplicate-in-file": "Appears more than once in the file",
  "duplicate-in-list": "Already on this list",
};

const keyOf = (p: { name: string; email: string }) => (p.email ? `e:${p.email.toLowerCase()}` : `n:${p.name.toLowerCase().replace(/\s+/g, " ")}`);

/** Every row of the sheet as a person, with what is wrong with it. `existing` are the people already on the list (to flag repeats). */
export function buildRows(rows: string[][], map: Record<ImportFieldKey, number>, existing: Array<{ name: string; email: string }>): ImportRow[] {
  const get = (r: string[], k: ImportFieldKey) => (map[k] >= 0 ? (r[map[k]] ?? "").trim() : "");
  const seenInList = new Set(existing.map(keyOf));
  const seenInFile = new Set<string>();
  return rows.map((r, i) => {
    const person = { name: get(r, "name"), email: get(r, "email"), affiliation: get(r, "affiliation"), roleLabel: get(r, "roleLabel"), paperId: get(r, "paperId") || undefined, paperTitle: get(r, "paperTitle") || undefined };
    const problems: RowProblem[] = [];
    if (!person.name) problems.push("no-name");
    if (person.email && !looksLikeEmail(person.email)) problems.push("bad-email");
    if (!person.email) problems.push("no-email");
    if (person.name) {
      const k = keyOf(person);
      if (seenInList.has(k)) problems.push("duplicate-in-list");
      if (seenInFile.has(k)) problems.push("duplicate-in-file");
      seenInFile.add(k);
    }
    return { line: i + 2, person, problems };
  });
}

/** A row is imported unless it has no name or (when asked) it is a repeat. */
export const importable = (row: ImportRow, skipDuplicates: boolean) =>
  !row.problems.includes("no-name") && !(skipDuplicates && (row.problems.includes("duplicate-in-file") || row.problems.includes("duplicate-in-list")));
