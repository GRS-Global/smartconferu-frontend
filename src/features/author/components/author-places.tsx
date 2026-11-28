"use client";

import { Plus, Star, Trash2 } from "lucide-react";
import { INPUT_CLASS } from "@/components/ui/field";
import { COUNTRIES } from "@/lib/country-codes";
import type { AuthorPlace } from "@/types/author-submission";

const LABEL = "mb-1 block text-xs font-bold text-ink-soft";
const MAX_OTHERS = 5;

export const EMPTY_PLACE: AuthorPlace = { affiliation: "", department: "", city: "", country: "" };

/** The affiliations of one author. The ordinary fields above hold the primary one; here sit the others (an author who belongs to several institutions is one
 *  author with several affiliations, never two entries). "Make primary" swaps an affiliation with the primary one. */
export function AuthorPlaces({ idPrefix, primary, others, onChange }: {
  idPrefix: string;
  primary: AuthorPlace;
  others: AuthorPlace[];
  onChange: (next: { primary: AuthorPlace; others: AuthorPlace[] }) => void;
}) {
  const setOther = (i: number, patch: Partial<AuthorPlace>) => onChange({ primary, others: others.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const makePrimary = (i: number) => onChange({ primary: others[i], others: others.map((p, j) => (j === i ? primary : p)) });
  const remove = (i: number) => onChange({ primary, others: others.filter((_, j) => j !== i) });
  return (
    <div className="mt-3">
      {others.length > 0 && (
        <div className="rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-ink-soft">Affiliations ({others.length + 1})</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary"><Star size={11} aria-hidden="true" /> Primary: {primary.affiliation.trim() || "not filled in yet"}</span>
            <span className="text-ink-muted">The fields above are the primary affiliation.</span>
          </div>
          {others.map((p, i) => (
            <fieldset key={i} className="mt-3 border-t border-muted pt-3">
              <legend className="sr-only">Affiliation {i + 2}</legend>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Affiliation {i + 2}</span>
                <span className="inline-flex items-center gap-3">
                  <button type="button" onClick={() => makePrimary(i)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Star size={12} aria-hidden="true" /> Make primary</button>
                  <button type="button" onClick={() => remove(i)} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-danger-ink"><Trash2 size={12} aria-hidden="true" /> Remove</button>
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor={`${idPrefix}-dept-${i}`} className={LABEL}>Department</label><input id={`${idPrefix}-dept-${i}`} value={p.department} maxLength={300} onChange={(e) => setOther(i, { department: e.target.value })} className={INPUT_CLASS} /></div>
                <div><label htmlFor={`${idPrefix}-aff-${i}`} className={LABEL}>Affiliation</label><input id={`${idPrefix}-aff-${i}`} value={p.affiliation} maxLength={300} placeholder="Institution only, e.g. MIT" onChange={(e) => setOther(i, { affiliation: e.target.value })} className={INPUT_CLASS} /></div>
                <div><label htmlFor={`${idPrefix}-city-${i}`} className={LABEL}>City</label><input id={`${idPrefix}-city-${i}`} value={p.city} maxLength={120} onChange={(e) => setOther(i, { city: e.target.value })} className={INPUT_CLASS} /></div>
                <div><label htmlFor={`${idPrefix}-country-${i}`} className={LABEL}>Country</label><select id={`${idPrefix}-country-${i}`} value={p.country} onChange={(e) => setOther(i, { country: e.target.value })} className={`${INPUT_CLASS} cursor-pointer`}><option value="">Select…</option>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
            </fieldset>
          ))}
        </div>
      )}
      {others.length < MAX_OTHERS && (
        <button type="button" onClick={() => onChange({ primary, others: [...others, { ...EMPTY_PLACE }] })} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline">
          <Plus size={13} aria-hidden="true" /> Add another affiliation
        </button>
      )}
    </div>
  );
}
