import type { ReviewValues } from "@/types/reviewer";

/* The peer-review form (the prototype's PEER_REVIEW_FORM_DEFAULT_SCHEMA, src/author-journey.jsx). A conference's chair can change the
   form in the prototype, but that choice is only kept in the browser there (nothing in the database holds it), so every conference
   uses this default here. Answers are keyed by the field's id, as the prototype keys them. */

export type FieldType = "long_text" | "score" | "single_choice";
export interface ReviewField { id: string; type: FieldType; label: string; description?: string; required: boolean; max?: number; options?: string[] }
export interface ReviewSection { id: string; name: string; fields: ReviewField[] }

export const PEER_REVIEW_FORM: ReviewSection[] = [
  {
    id: "s-review", name: "Review",
    fields: [
      { id: "f-summary", type: "long_text", label: "Review of the submission", required: true },
      { id: "f-originality", type: "score", label: "Originality", required: true, max: 5 },
      { id: "f-technical", type: "score", label: "Technical quality", required: true, max: 5 },
      { id: "f-clarity", type: "score", label: "Clarity & presentation", required: true, max: 5 },
      { id: "f-relevance", type: "score", label: "Relevance to conference scope", required: true, max: 5 },
      { id: "f-score", type: "score", label: "Overall recommendation", description: "Please give an overall rating", required: true, max: 5 },
      { id: "f-confidence", type: "single_choice", label: "Reviewer confidence", required: true, options: ["Low", "Medium", "High"] },
    ],
  },
  {
    id: "s-comments", name: "Comments",
    fields: [
      { id: "f-to-author", type: "long_text", label: "Comments to author", required: false },
      { id: "f-to-chair", type: "long_text", label: "Confidential comments to chair", required: false },
    ],
  },
];

/** A field counts as answered when it holds something other than blank text. */
export const isFieldAnswered = (v: ReviewValues[string]): boolean => {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== "";
};

/** Checks a stored review form (`conference_forms.schema`) and returns its sections, or null when it is not a usable form (the default is used then). */
export function sectionsFromStored(schema: unknown): ReviewSection[] | null {
  const raw = (schema as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(raw)) return null;
  const types = new Set(["long_text", "score", "single_choice"]);
  const out: ReviewSection[] = [];
  for (const s of raw as Array<Record<string, unknown>>) {
    if (!s || typeof s.id !== "string" || typeof s.name !== "string" || !Array.isArray(s.fields)) return null;
    const fields: ReviewField[] = [];
    for (const f of s.fields as Array<Record<string, unknown>>) {
      if (!f || typeof f.id !== "string" || typeof f.label !== "string" || typeof f.type !== "string" || !types.has(f.type)) return null;
      fields.push({
        id: f.id, type: f.type as FieldType, label: f.label, required: f.required === true,
        ...(typeof f.description === "string" && f.description ? { description: f.description } : {}),
        ...(f.type === "score" ? { max: typeof f.max === "number" && f.max >= 2 && f.max <= 10 ? Math.round(f.max) : 5 } : {}),
        ...(f.type === "single_choice" ? { options: Array.isArray(f.options) ? (f.options as unknown[]).filter((o): o is string => typeof o === "string" && o.trim() !== "") : [] } : {}),
      });
    }
    out.push({ id: s.id, name: s.name, fields });
  }
  return out.length ? out : null;
}
/** The fields the review always has (the overall score and the comments): a chair may reword them but not remove them. */
export const PROTECTED_FIELD_IDS = ["f-score", "f-to-author", "f-to-chair", "f-confidence"];
