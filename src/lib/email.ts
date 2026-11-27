/* One email check for every email field of the app. It follows the backend's `@IsEmail()` (validator.js isEmail with its defaults), so an
   address the form accepts is not refused by the API afterwards, and one it refuses would have been refused there too:
   - local part (before @): at most 64 characters; letters, digits and ! # $ % & ' * + / = ? ^ _ ` { | } ~ - ; dots only between characters
   - domain: two or more labels of letters / digits / hyphens (not at a label's start or end, at most 63 each), no underscore, no IP address
   - top-level domain: two or more letters (or an xn-- punycode name)
   - the whole address: at most 254 characters, no spaces, exactly one @
   Letters outside ASCII (e.g. ü, é) are allowed, as the backend allows them. */

export const EMAIL_MAX_LENGTH = 254;

const LOCAL = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+(\.[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+)*$/u;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
const TLD = /^(?:\p{L}{2,63}|xn--[a-z0-9-]{2,59})$/iu;

/** True when `value` (trimmed) is a usable email address. */
export function isValidEmail(value: string | null | undefined): boolean {
  const email = String(value ?? "").trim();
  if (!email || email.length > EMAIL_MAX_LENGTH) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@") || at === email.length - 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((l) => !LABEL.test(l))) return false;
  return TLD.test(labels[labels.length - 1]);
}

/** The message for an email field: "" when fine. `required: false` lets an empty field pass. */
export function emailProblem(value: string | null | undefined, { required = true }: { required?: boolean } = {}): string {
  const email = String(value ?? "").trim();
  if (!email) return required ? "Enter your email address." : "";
  if (email.length > EMAIL_MAX_LENGTH) return `An email address can be at most ${EMAIL_MAX_LENGTH} characters.`;
  return isValidEmail(email) ? "" : "Enter a valid email address, e.g. name@university.edu.";
}
