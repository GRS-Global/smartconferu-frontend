import { findDepartment, findInstitution, normalizeInstitution } from "@/lib/institutions";
import type { Affiliation, Profile } from "@/types/profile";

/* Affiliation handling, ported from the prototype (profileAffiliations, affiliationsPatch,
   withPrimaryAffiliation, resolveInstitutionValue, resolveDepartment). */

export const AFFILIATIONS_MAX = 5;

export interface InstitutionValue {
  name: string;
  institutionId: string | null;
  pending: boolean;
}

/** What a typed or picked institution stands for: the approved one, or "pending" when it isn't in the list. */
export function resolveInstitutionValue(v: InstitutionValue | null | undefined): InstitutionValue {
  const name = String(v?.name || "").trim();
  if (!name) return { name: "", institutionId: null, pending: false };
  if (v && (v.institutionId || v.pending)) return { ...v, name };
  const inst = findInstitution(name);
  return inst ? { name: inst.name, institutionId: inst.id, pending: false } : { name, institutionId: null, pending: true };
}

/** The approved department a typed name stands for, else the typed name marked pending. */
export function resolveDepartment(inst: InstitutionValue, name: string): { department: string; departmentPending: boolean } {
  const typed = String(name || "").trim();
  if (!typed) return { department: "", departmentPending: false };
  const match = inst.institutionId ? findDepartment(inst.institutionId, typed) : null;
  return match ? { department: match, departmentPending: false } : { department: typed, departmentPending: true };
}

/** The profile's affiliations, primary first; a profile with only the flat fields yields one. */
export function profileAffiliations(p: Pick<Profile, "affiliations" | "affiliation" | "affiliationInstitutionId" | "affiliationPending" | "affiliationDepartment" | "affiliationLocation" | "affiliationStartMonth" | "affiliationStartYear">): Affiliation[] {
  const list = Array.isArray(p.affiliations) ? [...p.affiliations].sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary))) : [];
  if (!list.length) {
    if (!p.affiliation) return [];
    return [{
      id: "aff-1", institution: p.affiliation, institutionId: p.affiliationInstitutionId || null, pending: Boolean(p.affiliationPending),
      department: p.affiliationDepartment || "", location: p.affiliationLocation || "",
      startMonth: p.affiliationStartMonth || "", startYear: p.affiliationStartYear || "", relationship: "Full-time", primary: true,
    }];
  }
  if (p.affiliation && normalizeInstitution(list[0].institution) !== normalizeInstitution(p.affiliation)) {
    list[0] = { ...list[0], institution: p.affiliation, institutionId: p.affiliationInstitutionId || null, pending: Boolean(p.affiliationPending) };
  }
  return list;
}

type AffiliationPatch = Pick<Profile, "affiliations" | "affiliation" | "affiliationInstitutionId" | "affiliationPending" | "affiliationDepartment" | "affiliationLocation" | "affiliationStartMonth" | "affiliationStartYear">;

/** The profile patch that saves a list: exactly one primary (the first marked one), primary first, at most
 *  AFFILIATIONS_MAX, and the flat fields mirroring the primary. */
export function affiliationsPatch(list: Affiliation[]): AffiliationPatch {
  const firstPrimary = list.findIndex((a) => a.primary);
  const marked = list.slice(0, AFFILIATIONS_MAX).map((a, i) => ({ ...a, primary: i === Math.max(firstPrimary, 0) }));
  const ordered = [...marked.filter((a) => a.primary), ...marked.filter((a) => !a.primary)];
  const pr = ordered[0];
  return {
    affiliations: ordered,
    affiliation: pr?.institution || "",
    affiliationInstitutionId: pr?.institutionId || null,
    affiliationPending: Boolean(pr?.pending),
    affiliationDepartment: pr?.department || "",
    affiliationLocation: pr?.location || "",
    affiliationStartMonth: pr?.startMonth || "",
    affiliationStartYear: pr?.startYear || "",
  };
}

export const newAffiliationId = () => `aff-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Sets the primary affiliation from the institution + department picked in the form, keeping the others. */
export function withPrimaryAffiliation(profile: Parameters<typeof profileAffiliations>[0], inst: InstitutionValue, department: string): AffiliationPatch {
  const r = resolveInstitutionValue(inst);
  const list = profileAffiliations(profile);
  const key = normalizeInstitution(r.name);
  const old = list.find((a) => normalizeInstitution(a.institution) === key);
  const primary: Affiliation = {
    ...(old ?? { id: newAffiliationId(), relationship: "Full-time", location: "", startMonth: "", startYear: "" }),
    institution: r.name, institutionId: r.institutionId, pending: r.pending, ...resolveDepartment(r, department), primary: true,
  };
  const others = list.filter((a) => normalizeInstitution(a.institution) !== key).map((a) => ({ ...a, primary: false }));
  return affiliationsPatch([primary, ...others]);
}
