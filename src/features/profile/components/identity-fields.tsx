"use client";

import { Field, INPUT_CLASS, describedBy } from "@/components/ui/field";
import { COUNTRIES } from "@/lib/country-codes";
import { GENDER_OPTIONS } from "../fields";
import type { IdentityForm } from "../use-identity-form";
import { DepartmentPicker, InstitutionPicker } from "./institution-fields";
import { PhoneField } from "./phone-field";
import { PhotoField } from "./photo-field";

/** The identity details shared by Complete Profile and My Profile › General. Fields marked * are required. */
export function IdentityFields({ form, email, emailNote, idPrefix }: { form: IdentityForm; email: string; emailNote: string; idPrefix: string }) {
  const { values, set, errorOf, touch } = form;
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="space-y-3">
      <PhotoField value={form.photo} onChange={form.setPhoto} initials={form.initials} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor={id("first")} required error={errorOf("firstName")}>
          <input id={id("first")} autoComplete="given-name" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} onBlur={touch("firstName")} aria-invalid={Boolean(errorOf("firstName")) || undefined} aria-describedby={describedBy(id("first"), errorOf("firstName"))} className={INPUT_CLASS} />
        </Field>
        <Field label="Last name" htmlFor={id("last")} required error={errorOf("lastName")}>
          <input id={id("last")} autoComplete="family-name" value={values.lastName} onChange={(e) => set("lastName", e.target.value)} onBlur={touch("lastName")} aria-invalid={Boolean(errorOf("lastName")) || undefined} aria-describedby={describedBy(id("last"), errorOf("lastName"))} className={INPUT_CLASS} />
        </Field>
      </div>
      <Field label="Email" htmlFor={id("email")} required hint={emailNote}>
        <input id={id("email")} type="email" value={email} readOnly aria-describedby={`${id("email")}-hint`} className={INPUT_CLASS} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Affiliation" htmlFor={id("institution")} required error={errorOf("affiliation")}>
          <InstitutionPicker id={id("institution")} value={form.inst} onChange={form.setInst} placeholder="Search your institution" invalid={Boolean(errorOf("affiliation"))} describedBy={describedBy(id("institution"), errorOf("affiliation"))} />
        </Field>
        <Field label="Department" htmlFor={id("department")}>
          <DepartmentPicker id={id("department")} institution={form.inst} value={form.department} onChange={form.setDepartment} />
        </Field>
      </div>
      <Field label="Designation" htmlFor={id("designation")} required error={errorOf("designation")}>
        <input id={id("designation")} value={values.designation} placeholder="e.g. Professor" onChange={(e) => set("designation", e.target.value)} onBlur={touch("designation")} aria-invalid={Boolean(errorOf("designation")) || undefined} aria-describedby={describedBy(id("designation"), errorOf("designation"))} className={INPUT_CLASS} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Country / region" htmlFor={id("country")} required error={errorOf("country")}>
          <select id={id("country")} autoComplete="country-name" value={values.country} onChange={(e) => set("country", e.target.value)} onBlur={touch("country")} aria-invalid={Boolean(errorOf("country")) || undefined} aria-describedby={describedBy(id("country"), errorOf("country"))} className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="" disabled>Select a country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Gender" htmlFor={id("gender")} required error={errorOf("gender")}>
          <select id={id("gender")} value={values.gender} onChange={(e) => set("gender", e.target.value)} onBlur={touch("gender")} aria-invalid={Boolean(errorOf("gender")) || undefined} aria-describedby={describedBy(id("gender"), errorOf("gender"))} className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="" disabled>Select</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Website" htmlFor={id("web")} error={errorOf("webPage")}>
        <input id={id("web")} type="text" inputMode="url" autoComplete="url" value={values.webPage} placeholder="Website (optional)" onChange={(e) => set("webPage", e.target.value)} onBlur={touch("webPage")} aria-invalid={Boolean(errorOf("webPage")) || undefined} aria-describedby={describedBy(id("web"), errorOf("webPage"))} className={INPUT_CLASS} />
      </Field>
      <Field label="Mobile number" htmlFor={id("phone")} error={errorOf("phone")}>
        <PhoneField id={id("phone")} phone={values.phone} onPhoneChange={(v) => set("phone", v)} onBlur={touch("phone")} channels={values.notifyChannels} onChannelsChange={(v) => set("notifyChannels", v)} invalid={Boolean(errorOf("phone"))} describedBy={describedBy(id("phone"), errorOf("phone"))} />
      </Field>
    </div>
  );
}
