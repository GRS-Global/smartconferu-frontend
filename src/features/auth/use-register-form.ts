"use client";

import { useState } from "react";
import { withPrimaryAffiliation, type InstitutionValue } from "@/features/profile/affiliations";
import { validateProfileForm, type FormValues } from "@/features/profile/validation";
import type { SignUpInput } from "@/services/auth";

/* The Register form's state and rules, from the prototype's RegisterPage: the identity fields are validated by the same rules as
   Complete Profile (features/profile/validation), plus the password pair and the Terms checkbox. */

export const PASSWORD_MIN = 8;

export type RegisterKey = keyof FormValues | "password" | "password2";
export type RegisterProblems = Partial<Record<RegisterKey, string>>;

/** What is still needed, named the way the prototype's hint line names it. */
export const REQUIRED_LABELS: Record<RegisterKey, string> = {
  firstName: "first name", lastName: "last name", mainEmail: "email", affiliation: "affiliation", designation: "designation",
  country: "country", state: "state / region", city: "city", gender: "gender", webPage: "a valid website (or leave it empty)", phone: "a valid mobile number (or leave it empty)",
  password: "password", password2: "retyped password",
};

const ORDER: RegisterKey[] = ["firstName", "lastName", "mainEmail", "affiliation", "designation", "country", "state", "city", "gender", "webPage", "phone", "password", "password2"];

/** A profile with nothing in it, as the base the primary affiliation is written onto. */
const NO_AFFILIATIONS = {
  affiliations: [], affiliation: "", affiliationInstitutionId: null, affiliationPending: false, affiliationDepartment: "",
  affiliationLocation: "", affiliationStartMonth: "", affiliationStartYear: "",
};

export function useRegisterForm() {
  const [values, setValues] = useState({ firstName: "", lastName: "", mainEmail: "", designation: "", country: "", state: "", city: "", gender: "", webPage: "", phone: "", notifyChannels: [] as string[] });
  const [inst, setInst] = useState<InstitutionValue>({ name: "", institutionId: null, pending: false });
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  // Consent is explicit: the Terms start unticked, and Continue stays disabled until the person ticks them.
  const [agreeTos, setAgreeTos] = useState(false);
  const [tosAttempted, setTosAttempted] = useState(false); // a submit was tried without ticking: show the Terms message
  const [touched, setTouched] = useState<Partial<Record<RegisterKey, boolean>>>({});

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));

  const identity: FormValues = { ...values, affiliation: inst.name };
  const problems: RegisterProblems = {
    ...validateProfileForm(identity),
    ...(!values.state.trim() ? { state: "Enter your state / region." } : {}),
    ...(!password ? { password: "Choose a password." } : password.length < PASSWORD_MIN ? { password: `Use at least ${PASSWORD_MIN} characters.` } : {}),
    ...(!password2 ? { password2: "Retype your password." } : password2 !== password ? { password2: "The two passwords don't match." } : {}),
  };
  const pending = ORDER.filter((k) => problems[k]);
  const checksPending = agreeTos ? [] : ["the Terms of Service"];

  const touch = (key: RegisterKey) => () => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  const touchAll = () => setTouched(Object.fromEntries(ORDER.map((k) => [k, true])));
  const errorOf = (key: RegisterKey) => (touched[key] ? problems[key] : undefined);

  /** What to send to Supabase. Only call once `pending` is empty. */
  const buildSignUp = (): SignUpInput => {
    const affiliation = withPrimaryAffiliation(NO_AFFILIATIONS, inst, department);
    return {
      email: values.mainEmail.trim(),
      password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      affiliation: affiliation.affiliation,
      designation: values.designation.trim(),
      country: values.country,
      state: values.state.trim(),
      city: values.city.trim(),
      gender: values.gender,
      phone: values.phone.trim(),
      webPage: values.webPage.trim(),
      notifyChannels: values.notifyChannels,
      affiliations: affiliation.affiliations,
      affiliationInstitutionId: affiliation.affiliationInstitutionId,
      affiliationPending: affiliation.affiliationPending,
      affiliationDepartment: affiliation.affiliationDepartment,
    };
  };

  const clearPasswords = () => { setPassword(""); setPassword2(""); };
  /** Consent belongs to one submission: coming back to the form (to fix the email) asks for it again. */
  const resetConsent = () => { setAgreeTos(false); setTosAttempted(false); };

  return {
    values, set, inst, setInst, department, setDepartment, password, setPassword, password2, setPassword2, agreeTos, setAgreeTos,
    tosAttempted, setTosAttempted, resetConsent,
    problems, pending, checksPending, touch, touchAll, errorOf, buildSignUp, clearPasswords,
  };
}

export type RegisterForm = ReturnType<typeof useRegisterForm>;
