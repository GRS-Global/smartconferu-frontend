import { getProfileCompleteness } from "./completeness";
import { isValidEmail } from "@/lib/email";

/* Validation rules and messages, taken from the prototype: the required-field list of Complete Profile
   (getProfileCompleteness) and the Register form's per-field messages for the same fields. */

const WEB_RX = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i;

export const isEmail = (v: string) => isValidEmail(v);

export interface FormValues {
  firstName: string;
  lastName: string;
  mainEmail: string;
  affiliation: string;
  designation: string;
  country: string;
  gender: string;
  webPage: string;
  phone: string;
}

export type FieldProblems = Partial<Record<keyof FormValues, string>>;

/** Every field's problem (absent when fine). Required ones are those Complete Profile insists on. */
export function validateProfileForm(v: FormValues): FieldProblems {
  const nationalPhone = String(v.phone || "").replace(/^\+\d+\s*/, "").replace(/\D/g, "");
  const problems: FieldProblems = {
    firstName: !v.firstName.trim() ? "Enter your first name." : undefined,
    lastName: !v.lastName.trim() ? "Enter your last name." : undefined,
    mainEmail: !v.mainEmail.trim() ? "Enter your email." : !isValidEmail(v.mainEmail) ? "Enter a valid email, e.g. name@university.edu." : undefined,
    affiliation: !v.affiliation.trim() ? "Search for your institution, or type its name." : undefined,
    designation: !v.designation.trim() ? "Enter your designation, e.g. Professor." : undefined,
    country: !v.country ? "Choose your country / region." : undefined,
    gender: !v.gender ? "Choose a gender option." : undefined,
    webPage: v.webPage.trim() && !WEB_RX.test(v.webPage.trim()) ? "Enter a valid web address, e.g. https://example.org." : undefined,
    phone: nationalPhone && (nationalPhone.length < 6 || nationalPhone.length > 14) ? "Enter a valid mobile number." : undefined,
  };
  return Object.fromEntries(Object.entries(problems).filter(([, m]) => m)) as FieldProblems;
}

/** How many required details are still missing (plus an invalid email), for the Continue button's label. */
export function remainingRequired(values: Record<string, unknown>): { missing: string[]; emailInvalid: boolean } {
  const missing = getProfileCompleteness(values).missingRequired.map((f) => f.label);
  const email = String(values.mainEmail ?? "").trim();
  return { missing, emailInvalid: email !== "" && !isValidEmail(email) };
}
