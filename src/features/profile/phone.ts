import { DIAL_CODE_BY_ISO } from "@/lib/dial-codes";
import { COUNTRY_CODES } from "@/lib/country-codes";

/** Countries with a calling code, for the "+91" picker. */
export const DIAL_COUNTRIES = Object.entries(COUNTRY_CODES)
  .map(([name, iso]) => ({ name, iso, dial: DIAL_CODE_BY_ISO[iso] }))
  .filter((c): c is { name: string; iso: string; dial: string } => Boolean(c.dial));

/** Splits a stored "+91 98765 43210" into a dial code and a local number. Falls back to India (the
 *  product's home market, as in the prototype) when nothing has been entered. */
export function parsePhoneValue(raw: string): { dial: string; number: string } {
  const trimmed = (raw || "").trim();
  const m = trimmed.match(/^\+(\d{1,4})\s*(.*)$/);
  if (m) return { dial: m[1], number: m[2] };
  return { dial: "91", number: trimmed };
}

export const joinPhone = (dial: string, number: string): string => (number.trim() ? `+${dial} ${number.trim()}` : "");
