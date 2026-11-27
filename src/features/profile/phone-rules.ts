import { DIAL_COUNTRIES, parsePhoneValue } from "./phone";

/* Mobile number check by country. The number is stored as "+<dial code> <number>", so the rule is picked by the dial code.
   Each rule is the length of the national mobile number (without the country code and without a leading trunk "0") and how it starts,
   from each country's numbering plan. A country not listed here gets the international limit: the whole number (code + number) has at
   most 15 digits (ITU E.164), and the national part at least 6. No library: the table covers the countries people sign up from most. */

interface Rule {
  /** Allowed lengths of the national mobile number. */
  lengths: number[];
  /** How a mobile number starts (after any leading 0 is dropped). */
  start?: RegExp;
  /** The start in words, for the message ("6, 7, 8 or 9"). */
  startsWith?: string;
  /** Name in the message when one code is shared by several countries. */
  name?: string;
}

const r = (lengths: number | number[], start?: RegExp, startsWith?: string, name?: string): Rule => ({ lengths: Array.isArray(lengths) ? lengths : [lengths], start, startsWith, name });

const RULES: Record<string, Rule> = {
  // South Asia
  "91": r(10, /^[6-9]/, "6, 7, 8 or 9"), // India
  "92": r(10, /^3/, "3"), // Pakistan
  "880": r(10, /^1[3-9]/, "13–19"), // Bangladesh
  "94": r(9, /^7/, "7"), // Sri Lanka
  "977": r(10, /^9[678]/, "96, 97 or 98"), // Nepal
  "975": r(8, /^(1[67]|77)/, "16, 17 or 77"), // Bhutan
  "960": r(7, /^[79]/, "7 or 9"), // Maldives
  "93": r(9, /^7/, "7"), // Afghanistan
  // East and South-East Asia
  "86": r(11, /^1[3-9]/, "13–19"), // China
  "852": r(8, /^[4-9]/, "4–9"), // Hong Kong
  "853": r(8, /^6/, "6"), // Macau
  "886": r(9, /^9/, "9"), // Taiwan
  "81": r(10, /^[789]0/, "70, 80 or 90"), // Japan
  "82": r([9, 10], /^1/, "1"), // South Korea
  "65": r(8, /^[89]/, "8 or 9"), // Singapore
  "60": r([9, 10], /^1/, "1"), // Malaysia
  "62": r([9, 10, 11, 12], /^8/, "8"), // Indonesia
  "63": r(10, /^9/, "9"), // Philippines
  "66": r(9, /^[689]/, "6, 8 or 9"), // Thailand
  "84": r(9, /^[35789]/, "3, 5, 7, 8 or 9"), // Vietnam
  "855": r([8, 9], /^[1-9]/), // Cambodia
  "856": r(10, /^20/, "20"), // Laos
  "95": r([8, 9, 10], /^9/, "9"), // Myanmar
  "976": r(8, /^[5-9]/, "5–9"), // Mongolia
  // Middle East
  "971": r(9, /^5/, "5"), // United Arab Emirates
  "966": r(9, /^5/, "5"), // Saudi Arabia
  "974": r(8, /^[3-7]/, "3–7"), // Qatar
  "965": r(8, /^[569]/, "5, 6 or 9"), // Kuwait
  "968": r(8, /^[79]/, "7 or 9"), // Oman
  "973": r(8, /^[36]/, "3 or 6"), // Bahrain
  "962": r(9, /^7[789]/, "77, 78 or 79"), // Jordan
  "961": r([7, 8], /^(3|7|8)/, "3, 7 or 8"), // Lebanon
  "972": r(9, /^5/, "5"), // Israel
  "964": r(10, /^7/, "7"), // Iraq
  "98": r(10, /^9/, "9"), // Iran
  "90": r(10, /^5/, "5"), // Turkey
  // Europe
  "44": r(10, /^7/, "7"), // United Kingdom
  "353": r(9, /^8/, "8"), // Ireland
  "33": r(9, /^[67]/, "6 or 7"), // France
  "49": r([10, 11], /^1[5-7]/, "15, 16 or 17"), // Germany
  "39": r([9, 10], /^3/, "3"), // Italy
  "34": r(9, /^[67]/, "6 or 7"), // Spain
  "351": r(9, /^9/, "9"), // Portugal
  "31": r(9, /^6/, "6"), // Netherlands
  "32": r(9, /^4/, "4"), // Belgium
  "352": r(9, /^6/, "6"), // Luxembourg
  "41": r(9, /^7[5-9]/, "75–79"), // Switzerland
  "43": r([10, 11, 12, 13], /^6/, "6"), // Austria
  "45": r(8), // Denmark
  "46": r(9, /^7/, "7"), // Sweden
  "47": r(8, /^[49]/, "4 or 9"), // Norway
  "358": r([9, 10], /^(4|50)/, "4 or 50"), // Finland
  "354": r(7, /^[678]/, "6, 7 or 8"), // Iceland
  "48": r(9, /^[4-8]/, "4–8"), // Poland
  "420": r(9, /^[67]/, "6 or 7"), // Czechia
  "421": r(9, /^9/, "9"), // Slovakia
  "36": r(9, /^[237]0/, "20, 30 or 70"), // Hungary
  "40": r(9, /^7/, "7"), // Romania
  "359": r([8, 9], /^[89]/, "8 or 9"), // Bulgaria
  "30": r(10, /^69/, "69"), // Greece
  "385": r([8, 9], /^9/, "9"), // Croatia
  "381": r([8, 9], /^6/, "6"), // Serbia
  "386": r(8, /^[3-7]/, "3–7"), // Slovenia
  "380": r(9, /^[3-9]/, "3–9"), // Ukraine
  "375": r(9, /^(25|29|33|44)/, "25, 29, 33 or 44"), // Belarus
  "370": r(8, /^6/, "6"), // Lithuania
  "371": r(8, /^2/, "2"), // Latvia
  "372": r([7, 8], /^5/, "5"), // Estonia
  "7": r(10, /^[79]/, "7 or 9", "Russia / Kazakhstan"),
  // Americas
  "1": r(10, /^[2-9]\d{2}[2-9]/, "a valid area code (not 0 or 1)", "the US / Canada"),
  "52": r(10), // Mexico
  "55": r(11, /^\d{2}9/, "a 2-digit area code and 9"), // Brazil
  "54": r([10, 11], /^9?[1-9]/), // Argentina
  "56": r(9, /^9/, "9"), // Chile
  "57": r(10, /^3/, "3"), // Colombia
  "51": r(9, /^9/, "9"), // Peru
  "58": r(10, /^4/, "4"), // Venezuela
  "593": r(9, /^9/, "9"), // Ecuador
  // Africa and Oceania
  "27": r(9, /^[6-8]/, "6, 7 or 8"), // South Africa
  "234": r(10, /^[789]/, "7, 8 or 9"), // Nigeria
  "254": r(9, /^[17]/, "1 or 7"), // Kenya
  "255": r(9, /^[67]/, "6 or 7"), // Tanzania
  "256": r(9, /^7/, "7"), // Uganda
  "233": r(9, /^[25]/, "2 or 5"), // Ghana
  "251": r(9, /^[79]/, "7 or 9"), // Ethiopia
  "20": r(10, /^1[0125]/, "10, 11, 12 or 15"), // Egypt
  "212": r(9, /^[67]/, "6 or 7"), // Morocco
  "216": r(8, /^[2459]/, "2, 4, 5 or 9"), // Tunisia
  "213": r(9, /^[567]/, "5, 6 or 7"), // Algeria
  "61": r(9, /^4/, "4"), // Australia
  "64": r([8, 9, 10], /^2/, "2"), // New Zealand
};

const countryName = (dial: string) => RULES[dial]?.name ?? DIAL_COUNTRIES.find((c) => c.dial === dial)?.name ?? `+${dial}`;

/** The message for a mobile number field ("" when fine, or when empty: the number is optional). Country-wise for the countries above,
 *  the international limit for the rest. */
export function phoneProblem(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const { dial, number } = parsePhoneValue(raw);
  if (!number.trim()) return "";
  // People write numbers with spaces, hyphens, dots or brackets; anything else (letters, a second "+") is a typo.
  if (/[^\d\s\-().]/.test(number)) return "Use digits only (spaces and hyphens are fine).";
  // A leading trunk "0" (as dialled inside the country, e.g. 098765 43210) is not part of the number.
  const digits = number.replace(/\D/g, "").replace(/^0+/, "");
  const where = `${countryName(dial)} (+${dial})`;
  const rule = RULES[dial];
  if (!rule) {
    const max = 15 - dial.length;
    return digits.length < 6 || digits.length > max ? `Enter a valid mobile number for ${where}: 6 to ${max} digits.` : "";
  }
  const lengths = rule.lengths.length === 1 ? `${rule.lengths[0]} digits` : `${rule.lengths[0]} to ${rule.lengths[rule.lengths.length - 1]} digits`;
  const shape = rule.startsWith ? `${lengths} starting with ${rule.startsWith}` : lengths;
  if (!rule.lengths.includes(digits.length) || (rule.start && !rule.start.test(digits))) return `Enter a valid mobile number for ${where}: ${shape}.`;
  return "";
}
