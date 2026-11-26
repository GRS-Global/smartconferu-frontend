import { MERGE_FIELDS, mergeValues, type Design } from "../data";
import { fittedSize, isPlaceholderName, resolveText, studioFromDesign, tokensIn } from "../studio/model";
import { extrasOf } from "../merge-extras";

/* Before a batch is issued: what is wrong with each row for THIS certificate? These are warnings, not blockers: the chair decides. A row that is
   not ready to send (no address, already issued) is handled by the recipients page itself. */

export type WarningKind = "missing" | "long-name" | "duplicate";
export interface Warning { kind: WarningKind; text: string }
export interface CheckRow { key?: string; serial?: string; issuedAt?: number; name: string; email?: string; affiliation?: string; roleLabel?: string; paperId?: string; paperTitle?: string }

const LABELS = new Map(MERGE_FIELDS.flatMap((g) => g.fields.map((f) => [f.token, f.label.toLowerCase()] as const)));
/** The merge fields that come from the person (the conference's own fields are the same for everyone). */
const PERSON_TOKENS = ["recipientName", "affiliation", "roleLabel", "paperTitle", "paperId"];

/** The merge fields the certificate's text actually uses. */
export function tokensUsed(design: Design): string[] {
  const doc = design.studio ?? studioFromDesign(design);
  return [...new Set(doc.elements.filter((e) => e.type === "text" && !e.hidden).flatMap((e) => tokensIn(e.text ?? "")))];
}

const dupKey = (r: CheckRow) => (r.email ? `e:${r.email.trim().toLowerCase()}` : `n:${r.name.trim().toLowerCase().replace(/\s+/g, " ")}:${(r.paperId ?? "").toLowerCase()}`);

export function checkRows(design: Design, rows: CheckRow[], conference: Parameters<typeof mergeValues>[1]): Map<string, Warning[]> {
  const doc = design.studio ?? studioFromDesign(design);
  const used = tokensUsed(design).filter((t) => PERSON_TOKENS.includes(t));
  const texts = doc.elements.filter((e) => e.type === "text" && !e.hidden && tokensIn(e.text ?? "").includes("recipientName"));
  const extras = extrasOf(design);
  const seen = new Map<string, string>();
  const out = new Map<string, Warning[]>();
  rows.forEach((r, i) => {
    const id = r.key ?? r.serial ?? String(i);
    const w: Warning[] = [];
    const values = mergeValues(r, conference, extras);
    const missing = used.filter((t) => !values[t]);
    if (missing.length) w.push({ kind: "missing", text: `Missing: ${missing.map((t) => LABELS.get(t) ?? t).join(", ")}` });
    for (const el of texts) {
      const shown = resolveText(el.text ?? "", values);
      const size = fittedSize(el, shown);
      const nominal = el.size ?? 21;
      if (el.autoFit && size < nominal * 0.7) { w.push({ kind: "long-name", text: `Long name: shrinks to ${Math.round((size / nominal) * 100)}% to fit` }); break; }
      if (!el.autoFit && shown.length * nominal * 0.5 > el.w * 1.1) { w.push({ kind: "long-name", text: "Long name: may not fit on one line" }); break; }
    }
    const k = dupKey(r);
    const first = seen.get(k);
    if (first !== undefined) w.push({ kind: "duplicate", text: `Same as ${first}` });
    else seen.set(k, r.name);
    if (w.length) out.set(id, w);
  });
  return out;
}

/** Fields the certificate prints that have nothing behind them for EVERYONE (the conference has no venue yet, no signature block on the page) or that do not exist at all. */
export function designGaps(design: Design, conference: Parameters<typeof mergeValues>[1]): { empty: string[]; unknown: string[]; unsigned: boolean } {
  const values = mergeValues({ name: "x", serial: "X-000" }, conference, extrasOf(design));
  const used = tokensUsed(design);
  return {
    empty: used.filter((t) => !PERSON_TOKENS.includes(t) && t in values && !values[t]).map((t) => LABELS.get(t) ?? t),
    unknown: used.filter((t) => !(t in values)),
    // A signature block whose name is empty or still says the template's placeholder.
    unsigned: (design.studio ?? studioFromDesign(design)).elements.some((e) => e.name === "Signatory name" && !e.hidden && isPlaceholderName(e.text)),
  };
}

export function summarize(warnings: Map<string, Warning[]>): { rows: number; missing: number; longNames: number; duplicates: number } {
  let missing = 0, longNames = 0, duplicates = 0;
  warnings.forEach((list) => { if (list.some((w) => w.kind === "missing")) missing++; if (list.some((w) => w.kind === "long-name")) longNames++; if (list.some((w) => w.kind === "duplicate")) duplicates++; });
  return { rows: warnings.size, missing, longNames, duplicates };
}
