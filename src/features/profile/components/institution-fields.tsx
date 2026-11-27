"use client";

import { useMasterDataVersion } from "@/lib/master-data";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { findDepartment, normalizeInstitution, institutionDepartments, normalizeDepartment, searchInstitutions, findInstitution } from "@/lib/institutions";
import type { InstitutionValue } from "../affiliations";

interface InstitutionPickerProps {
  id: string;
  ariaLabel?: string;
  value: InstitutionValue;
  onChange: (v: InstitutionValue) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  inputClassName?: string;
}

/** Search the approved institution list; a name that isn't in it is used as typed and saved as "pending". */
export function InstitutionPicker({ id, ariaLabel, value, onChange, placeholder = "Search your institution, e.g. IIT", invalid, describedBy, inputClassName }: InstitutionPickerProps) {
  useMasterDataVersion(); // render again when the Super Admin's lists arrive from the backend
  const typed = value.name.trim();
  // Typed by a short form ("GTU"): the list shows the full name, with the short form that matched next to the country.
  const q = normalizeInstitution(typed);
  const options: ComboOption<InstitutionValue>[] = searchInstitutions(typed).map((i) => {
    const hit = q && normalizeInstitution(i.name) !== q ? i.aliases.find((a) => normalizeInstitution(a).includes(q)) : undefined;
    return { key: i.id, label: i.name, detail: [hit, i.country].filter(Boolean).join(" · "), value: { name: i.name, institutionId: i.id, pending: false } };
  });
  const unknown = typed !== "" && !findInstitution(typed);
  return (
    <div>
      <Combobox
        id={id}
        ariaLabel={ariaLabel}
        text={value.name}
        onTextChange={(name) => onChange({ name, institutionId: null, pending: false })}
        options={options}
        onSelect={(o) => onChange(o.value)}
        placeholder={placeholder}
        invalid={invalid}
        describedBy={describedBy}
        inputClassName={inputClassName}
        emptyHint="Not in our list — it will be used as typed and checked by our team."
      />
      {unknown && options.length === 0 && <p className="mt-1 text-[11px] text-ink-muted">Not in our list — it will be used as typed and checked by our team.</p>}
    </div>
  );
}

interface DepartmentPickerProps {
  id: string;
  ariaLabel?: string;
  institution: InstitutionValue;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputClassName?: string;
}

/** The institution's approved departments, or any department typed (marked pending when saved). */
export function DepartmentPicker({ id, ariaLabel, institution, value, onChange, placeholder = "Department (optional)", inputClassName }: DepartmentPickerProps) {
  useMasterDataVersion(); // render again when the Super Admin's lists arrive from the backend
  const inst = institution.institutionId ? institution : (() => { const f = findInstitution(institution.name); return f ? { ...institution, institutionId: f.id } : institution; })();
  const typed = value.trim();
  const q = normalizeDepartment(typed);
  const options: ComboOption<string>[] = institutionDepartments(inst.institutionId)
    .filter((d) => !q || normalizeDepartment(d).includes(q) || d.toLowerCase().includes(typed.toLowerCase()))
    .map((d) => ({ key: d, label: d, value: d }));
  const exact = inst.institutionId ? findDepartment(inst.institutionId, typed) : null;
  return (
    <div>
      <Combobox id={id} ariaLabel={ariaLabel} text={value} onTextChange={onChange} options={options} onSelect={(o) => onChange(o.value)} placeholder={placeholder} inputClassName={inputClassName} />
      {typed !== "" && !exact && inst.institutionId && <p className="mt-1 text-[11px] text-ink-muted">Not one of this institution&apos;s listed departments — it will be used as typed and checked by our team.</p>}
    </div>
  );
}
