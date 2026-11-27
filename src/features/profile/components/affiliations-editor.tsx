"use client";

import { Briefcase, Building2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Field, INPUT_CLASS } from "@/components/ui/field";
import { normalizeInstitution } from "@/lib/institutions";
import type { Affiliation, PastAffiliation } from "@/types/profile";
import {
  AFFILIATIONS_MAX, affiliationsPatch, newAffiliationId, profileAffiliations, resolveDepartment, resolveInstitutionValue, type InstitutionValue,
} from "../affiliations";
import { AFFILIATION_TYPES, entryMonthIndex, findListName, PROFILE_MONTHS, PROFILE_OTHER } from "../entries";
import { affiliationRelationshipLabel, pastAffiliationPeriod } from "../showcase/helpers";
import { useSectionSave } from "../use-section-save";
import { FieldError, ListMatch, MonthYearPicker, OtherBox, PendingNote, RadioChoice } from "./editor-parts";
import type { EditorProps } from "./editor-types";
import { DepartmentPicker, InstitutionPicker } from "./institution-fields";
import { SectionCard } from "./section-card";

type Row = Affiliation & { inst: InstitutionValue };

const blank = (primary: boolean): Row => ({
  id: newAffiliationId(), institution: "", institutionId: null, pending: false, department: "", location: "", startMonth: "", startYear: "",
  relationship: "Full-time", primary, inst: { name: "", institutionId: null, pending: false },
});

interface PastDraft { inst: InstitutionValue; relationship: string; location: string; department: string; startMonth: string; startYear: string; endMonth: string; endYear: string }
const blankPast = (): PastDraft => ({ inst: { name: "", institutionId: null, pending: false }, relationship: "Full-time", location: "", department: "", startMonth: "", startYear: "", endMonth: "", endYear: "" });

/** Relationship: the list + "Other" (used straight away, marked pending). */
function RelationshipField({ a, update }: { a: Row; update: (id: string, patch: Partial<Row>) => void }) {
  const listed = findListName(AFFILIATION_TYPES, a.relationship);
  const other = Boolean(a.relationshipOther) || (Boolean(a.relationship) && !listed);
  const pick = (v: string) => update(a.id, v === PROFILE_OTHER
    ? { relationshipOther: true, relationshipPending: true, relationship: listed ? "" : a.relationship, relationshipRejectReason: undefined }
    : { relationship: v, relationshipOther: false, relationshipPending: false, relationshipRejectReason: undefined });
  const match = other && a.relationship ? findListName(AFFILIATION_TYPES, a.relationship) : null;
  return (
    <>
      <Field label="Relationship" htmlFor={`aff-rel-${a.id}`}>
        <select id={`aff-rel-${a.id}`} value={other ? PROFILE_OTHER : listed || AFFILIATION_TYPES[0]} onChange={(e) => pick(e.target.value)} className={INPUT_CLASS}>
          {AFFILIATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          <option value={PROFILE_OTHER}>Other — not in the list</option>
        </select>
      </Field>
      {other && (
        <div className="sm:col-span-2">
          <OtherBox>
            <Field label="Relationship" htmlFor={`aff-rel-other-${a.id}`}>
              <input id={`aff-rel-other-${a.id}`} value={a.relationship} placeholder="e.g. Postdoctoral Fellow, Consultant" onChange={(e) => update(a.id, { relationship: e.target.value, relationshipPending: true })} className={INPUT_CLASS} />
            </Field>
            {match && <ListMatch match={match} onUse={() => pick(match)} />}
            <PendingNote>Our team checks new relationship types and adds them to the list. Until then it shows as “Pending review” to you.</PendingNote>
          </OtherBox>
        </div>
      )}
    </>
  );
}

/** My Profile › Edit affiliations: every current institution (exactly one primary), "I no longer work here", and past affiliations. */
export function AffiliationsEditor({ profile, save, onDone, onCancel }: EditorProps) {
  const before = profileAffiliations(profile);
  const [list, setList] = useState<Row[]>(() => (before.length ? before : [{ ...blank(true), id: "aff-1" }]).map((a) => ({ ...a, inst: { name: a.institution, institutionId: a.institutionId, pending: a.pending } })));
  const [ended, setEnded] = useState<Row[]>([]);
  const [past, setPast] = useState<PastAffiliation[]>(profile.pastAffiliations);
  const [pastDraft, setPastDraft] = useState<PastDraft | null>(null);
  const state = useSectionSave();

  const pastError = pastDraft && (!pastDraft.inst.name.trim() ? "Pick the institution."
    : !pastDraft.startYear || !pastDraft.endYear ? "Add when you started and left."
      : entryMonthIndex(pastDraft.endMonth, pastDraft.endYear) < entryMonthIndex(pastDraft.startMonth, pastDraft.startYear) ? "The end date is before the start date." : "");
  const addPast = () => {
    if (!pastDraft || pastError) return;
    const r = resolveInstitutionValue(pastDraft.inst);
    setPast((l) => [{
      id: newAffiliationId(), institution: r.name, relationship: pastDraft.relationship, location: pastDraft.location.trim(), department: pastDraft.department.trim(),
      startMonth: pastDraft.startMonth, startYear: pastDraft.startYear, endMonth: pastDraft.endMonth, endYear: pastDraft.endYear,
      ...(r.institutionId ? { institutionId: r.institutionId } : {}),
    } as PastAffiliation, ...l]);
    setPastDraft(null);
  };

  const update = (id: string, patch: Partial<Row>) => setList((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const drop = (id: string) => setList((l) => {
    const rest = l.filter((a) => a.id !== id);
    return rest.length && !rest.some((a) => a.primary) ? rest.map((a, i) => ({ ...a, primary: i === 0 })) : rest;
  });
  const makePrimary = (id: string) => setList((l) => l.map((a) => ({ ...a, primary: a.id === id })));
  const endHere = (a: Row) => { setEnded((e) => [...e, a]); drop(a.id); };

  const names = list.map((a) => normalizeInstitution(a.inst.name));
  const errorOf = (a: Row, i: number) => {
    if (!a.inst.name.trim()) return "Pick the institution, or remove this affiliation.";
    if (names.indexOf(names[i]) !== i) return "This institution is already listed.";
    if (a.relationshipOther && !a.relationship.trim()) return "Type the relationship, or pick one from the list.";
    return "";
  };
  const invalid = list.some((a, i) => errorOf(a, i));

  const submit = async () => {
    const resolved: Affiliation[] = list.map((a) => {
      const r = resolveInstitutionValue(a.inst);
      const { inst: _inst, ...rest } = a;
      void _inst;
      const listedType = findListName(AFFILIATION_TYPES, rest.relationship);
      const type = listedType ? { relationship: listedType, relationshipOther: false, relationshipPending: false } : { relationship: rest.relationship.trim() };
      return { ...rest, ...type, institution: r.name, institutionId: r.institutionId, pending: r.pending, ...resolveDepartment(r, a.department), location: a.location.trim() };
    });
    const patch = affiliationsPatch(resolved);
    const now = new Date();
    const endMonth = PROFILE_MONTHS[now.getMonth()];
    const endYear = String(now.getFullYear());
    const pastAffiliations: PastAffiliation[] = [
      ...ended.map((a) => ({ id: a.id, institution: a.institution, relationship: a.relationship || "Full-time", department: a.department || "", location: a.location || "", startMonth: a.startMonth, startYear: a.startYear, endMonth, endYear })),
      ...past,
    ];
    const oldPrimary = before[0]?.institution;
    const newPrimary = patch.affiliations[0]?.institution;
    const message = before.length && newPrimary && normalizeInstitution(oldPrimary) !== normalizeInstitution(newPrimary)
      ? `${newPrimary} is now your primary affiliation`
      : ended.length ? `Moved to past affiliations: ${ended.map((a) => a.institution).join(", ")}` : "Affiliations updated";
    if (await state.run(() => save({ ...patch, pastAffiliations }))) onDone(message);
  };

  return (
    <SectionCard inDialog id="affiliation" title="Edit affiliations" description="Institutions you currently work or research at. One is your primary." save={state} canSave={!invalid} onSave={() => void submit()} onCancel={onCancel}>
      <div className="flex flex-col gap-3.5">
        {list.map((a, i) => {
          const err = errorOf(a, i);
          const multi = list.length > 1;
          return (
            <div key={a.id} className={`rounded-xl border px-4 py-4 ${a.primary && multi ? "border-primary-soft-border bg-primary-soft/40" : "border-line bg-white"}`}>
              <div className="mb-3.5 flex items-center gap-3">
                {multi ? <RadioChoice checked={a.primary} onSelect={() => makePrimary(a.id)}>{a.primary ? "Primary affiliation" : "Make primary"}</RadioChoice>
                  : <span className="text-[13px] font-semibold text-ink-soft">Primary affiliation</span>}
                <div className="ml-auto flex items-center gap-1">
                  {before.some((b) => b.id === a.id) && (
                    <button type="button" onClick={() => endHere(a)} title="Moves this to your past affiliations, ending this month" className="h-8 rounded-lg px-2.5 text-xs font-semibold text-ink-muted hover:bg-canvas hover:text-navy">I no longer work here</button>
                  )}
                  {(multi || before.length > 0) && (
                    <button type="button" onClick={() => drop(a.id)} aria-label={`Remove ${a.inst.name || "this affiliation"}`} title="Remove" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-ink"><Trash2 size={15} aria-hidden="true" /></button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2">
                <Field className="sm:col-span-2" label="Institution / organization" htmlFor={`aff-inst-${a.id}`} required>
                  <InstitutionPicker id={`aff-inst-${a.id}`} value={a.inst} onChange={(v) => update(a.id, { inst: v })} />
                </Field>
                <RelationshipField a={a} update={update} />
                <MonthYearPicker label="Since" month={a.startMonth} year={a.startYear} onMonth={(v) => update(a.id, { startMonth: v })} onYear={(v) => update(a.id, { startYear: v })} />
                <Field label="Department (optional)" htmlFor={`aff-dept-${a.id}`}>
                  <DepartmentPicker id={`aff-dept-${a.id}`} institution={resolveInstitutionValue(a.inst)} value={a.department} onChange={(v) => update(a.id, { department: v })} />
                </Field>
                <Field label="Location" htmlFor={`aff-loc-${a.id}`}>
                  <input id={`aff-loc-${a.id}`} value={a.location} placeholder="e.g. New Delhi, India" onChange={(e) => update(a.id, { location: e.target.value })} className={INPUT_CLASS} />
                </Field>
                {err && <div className="sm:col-span-2"><FieldError text={err} /></div>}
              </div>
            </div>
          );
        })}

        {ended.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3.5 py-2.5 text-[13px] text-ink-soft">
            <Briefcase size={14} className="shrink-0" aria-hidden="true" />
            Will move to past affiliations on save: <b className="text-navy">{ended.map((a) => a.institution).join(", ")}</b>
            <button type="button" onClick={() => { setList((l) => [...l, ...ended.map((a) => ({ ...a, primary: !l.length && a === ended[0] }))]); setEnded([]); }} className="font-semibold text-primary hover:underline">Undo</button>
          </p>
        )}

        {list.length < AFFILIATIONS_MAX ? (
          <button type="button" onClick={() => setList((l) => [...l, blank(l.length === 0)])} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line-strong text-sm font-semibold text-primary hover:bg-primary-soft">
            <Plus size={15} aria-hidden="true" /> Add another affiliation <span className="font-medium text-ink-muted">({list.length} of {AFFILIATIONS_MAX})</span>
          </button>
        ) : <p className="text-[13px] text-ink-muted">You can list up to {AFFILIATIONS_MAX} current affiliations.</p>}

        <div className="mt-1 border-t border-muted pt-4">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">Past affiliations{past.length ? ` · ${past.length}` : ""}</div>
          {past.length === 0 && !pastDraft && <p className="mb-2.5 text-[13px] text-ink-muted">None yet. When you leave an institution, use “I no longer work here” — or add earlier ones below.</p>}
          {past.length > 0 && (
            <ul className="mb-2.5 flex flex-col">
              {past.map((a, i) => (
                <li key={a.id} className={`flex items-center gap-3 py-2.5 ${i ? "border-t border-muted" : ""}`}>
                  <Building2 size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-navy">{a.institution}</div>
                    <div className="text-xs text-ink-muted">{[pastAffiliationPeriod(a), affiliationRelationshipLabel(a)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <button type="button" onClick={() => setPast((l) => l.filter((x) => x.id !== a.id))} aria-label={`Remove ${a.institution}`} title="Remove" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-ink"><Trash2 size={15} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
          {pastDraft ? (
            <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 rounded-xl border border-line px-4 py-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Institution / organization" htmlFor="past-aff-inst" required>
                <InstitutionPicker id="past-aff-inst" value={pastDraft.inst} onChange={(v) => setPastDraft((d) => d && ({ ...d, inst: v }))} />
              </Field>
              <Field label="Relationship" htmlFor="past-aff-rel">
                <select id="past-aff-rel" value={pastDraft.relationship} onChange={(e) => setPastDraft((d) => d && ({ ...d, relationship: e.target.value }))} className={INPUT_CLASS}>
                  {AFFILIATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Location" htmlFor="past-aff-loc"><input id="past-aff-loc" value={pastDraft.location} placeholder="e.g. Singapore" onChange={(e) => setPastDraft((d) => d && ({ ...d, location: e.target.value }))} className={INPUT_CLASS} /></Field>
              <MonthYearPicker label="From" month={pastDraft.startMonth} year={pastDraft.startYear} onMonth={(v) => setPastDraft((d) => d && ({ ...d, startMonth: v }))} onYear={(v) => setPastDraft((d) => d && ({ ...d, startYear: v }))} />
              <MonthYearPicker label="To" month={pastDraft.endMonth} year={pastDraft.endYear} onMonth={(v) => setPastDraft((d) => d && ({ ...d, endMonth: v }))} onYear={(v) => setPastDraft((d) => d && ({ ...d, endYear: v }))} />
              <Field className="sm:col-span-2" label="Department (optional)" htmlFor="past-aff-dept"><input id="past-aff-dept" value={pastDraft.department} placeholder="e.g. School of Computing" onChange={(e) => setPastDraft((d) => d && ({ ...d, department: e.target.value }))} className={INPUT_CLASS} /></Field>
              {pastError && pastDraft.inst.name && <div className="sm:col-span-2"><FieldError text={pastError} /></div>}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={() => setPastDraft(null)} className="h-9 rounded-lg px-3.5 text-sm font-semibold text-ink-muted hover:bg-canvas">Cancel</button>
                <button type="button" onClick={addPast} disabled={Boolean(pastError)} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">Add</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setPastDraft(blankPast())} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"><Plus size={14} aria-hidden="true" /> Add a past affiliation</button>
          )}
        </div>

        <p className="text-[13px] leading-normal text-ink-muted">Your primary is shown under your name and pre-filled on new submissions and certificates. <b className="text-ink-soft">All</b> current ones are used to detect conflicts of interest during peer review.</p>
      </div>
    </SectionCard>
  );
}
