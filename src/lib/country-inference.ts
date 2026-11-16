/* Works out an author's country when the paper doesn't spell it out — PDFs often give only an
   institution or a city, and the AI can't always tell. Tried in order, first hit wins:
     1. the country the AI read from the paper (normalized to our list's spelling)
     2. a country named anywhere in the affiliation ("…, New Delhi, India")
     3. the institution, from the shared institutions catalogue (IIT Delhi → India)
     4. a well-known city in the affiliation (Bengaluru → India, Cambridge MA → United States)
     5. the email's country domain (.in, .ac.uk, .de …)
   Returns { country, source } — source says how it was found, so the form can tell the author to
   double-check a guess — or { country: "", source: "" } when nothing matched.
   `worldCountries` is the app's [name, isoCode][] list, so the answer is always a valid option. */
import { INSTITUTIONS, normalizeInstitution } from "@/lib/institutions";

// Other ways papers write a country → the name in our list.
const COUNTRY_ALIASES: Record<string, string> = {
  "usa": "United States", "u.s.a.": "United States", "u.s.": "United States",
  "united states of america": "United States",
  "uk": "United Kingdom", "u.k.": "United Kingdom", "england": "United Kingdom", "scotland": "United Kingdom",
  "wales": "United Kingdom", "northern ireland": "United Kingdom", "great britain": "United Kingdom", "britain": "United Kingdom",
  "korea": "South Korea", "republic of korea": "South Korea", "korea, republic of": "South Korea",
  "pr china": "China", "p.r. china": "China", "p. r. china": "China", "people's republic of china": "China", "prc": "China",
  "uae": "United Arab Emirates", "u.a.e.": "United Arab Emirates",
  "czech republic": "Czechia", "türkiye": "Turkey", "turkiye": "Turkey", "viet nam": "Vietnam",
  "russian federation": "Russia", "the netherlands": "Netherlands", "holland": "Netherlands",
  "ksa": "Saudi Arabia", "kingdom of saudi arabia": "Saudi Arabia", "hong kong": "China", "macau": "China",
};

// Cities that show up in affiliations without a country after them.
const CITY_COUNTRY: Record<string, string> = {
  "new delhi": "India", "delhi": "India", "mumbai": "India", "bombay": "India", "bengaluru": "India", "bangalore": "India",
  "chennai": "India", "madras": "India", "hyderabad": "India", "kolkata": "India", "calcutta": "India", "pune": "India",
  "ahmedabad": "India", "gandhinagar": "India", "jaipur": "India", "lucknow": "India", "kanpur": "India", "kharagpur": "India",
  "roorkee": "India", "guwahati": "India", "bhopal": "India", "indore": "India", "noida": "India", "gurugram": "India",
  "gurgaon": "India", "chandigarh": "India", "coimbatore": "India", "vellore": "India", "trichy": "India", "tiruchirappalli": "India",
  "karachi": "Pakistan", "lahore": "Pakistan", "islamabad": "Pakistan", "dhaka": "Bangladesh", "colombo": "Sri Lanka",
  "kathmandu": "Nepal", "singapore": "Singapore", "kuala lumpur": "Malaysia", "jakarta": "Indonesia", "bangkok": "Thailand",
  "manila": "Philippines", "hanoi": "Vietnam", "ho chi minh city": "Vietnam", "beijing": "China", "shanghai": "China",
  "shenzhen": "China", "wuhan": "China", "hangzhou": "China", "nanjing": "China", "tokyo": "Japan", "osaka": "Japan",
  "kyoto": "Japan", "seoul": "South Korea", "daejeon": "South Korea", "taipei": "Taiwan", "dubai": "United Arab Emirates",
  "abu dhabi": "United Arab Emirates", "sharjah": "United Arab Emirates", "doha": "Qatar", "riyadh": "Saudi Arabia",
  "jeddah": "Saudi Arabia", "tehran": "Iran", "istanbul": "Turkey", "ankara": "Turkey", "cairo": "Egypt",
  "lagos": "Nigeria", "nairobi": "Kenya", "accra": "Ghana", "johannesburg": "South Africa", "cape town": "South Africa",
  "london": "United Kingdom", "oxford": "United Kingdom", "manchester": "United Kingdom", "edinburgh": "United Kingdom",
  "paris": "France", "berlin": "Germany", "munich": "Germany", "mannheim": "Germany", "hamburg": "Germany",
  "zurich": "Switzerland", "geneva": "Switzerland", "lausanne": "Switzerland", "amsterdam": "Netherlands", "delft": "Netherlands",
  "stockholm": "Sweden", "copenhagen": "Denmark", "oslo": "Norway", "trondheim": "Norway", "helsinki": "Finland",
  "madrid": "Spain", "barcelona": "Spain", "milan": "Italy", "milano": "Italy", "rome": "Italy", "dublin": "Ireland",
  "toronto": "Canada", "montreal": "Canada", "vancouver": "Canada", "boston": "United States", "new york": "United States",
  "stanford": "United States", "berkeley": "United States", "pittsburgh": "United States", "seattle": "United States",
  "sydney": "Australia", "melbourne": "Australia", "brisbane": "Australia", "auckland": "New Zealand",
  "sao paulo": "Brazil", "são paulo": "Brazil", "rio de janeiro": "Brazil", "buenos aires": "Argentina", "santiago": "Chile",
  "mexico city": "Mexico", "beirut": "Lebanon",
};

// Country-code domains that don't match the ISO code.
const TLD_ISO: Record<string, string> = { uk: "GB" };
// Generic US-only domains (weakest signal — used last).
const US_DOMAINS = ["edu", "gov", "mil"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, phrase: string) => new RegExp(`(^|[^a-z])${escape(phrase)}([^a-z]|$)`, "i").test(text);

export interface CountryGuess { country: string; source: "" | "paper" | "affiliation" | "institution" | "city" | "email" }

export function inferAuthorCountry({ country, affiliation, email }: { country?: string; affiliation?: string; email?: string }, worldCountries: Array<[string, string]>): CountryGuess {
  const names = worldCountries.map(([name]) => name);
  const byLower: Record<string, string> = Object.fromEntries(names.map((n) => [n.toLowerCase(), n]));
  const toListName = (raw: unknown) => {
    const k = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
    return byLower[k] || COUNTRY_ALIASES[k] || "";
  };

  // 1 · read from the paper
  const fromPaper = toListName(country);
  if (fromPaper) return { country: fromPaper, source: "paper" };

  const aff = String(affiliation || "");
  if (aff.trim()) {
    // 2 · named in the affiliation — the last mention wins ("University of Delhi, … , India");
    // where two end together the longer one wins ("Papua New Guinea", not "Guinea").
    const candidates = [...names.map((n) => [n.toLowerCase(), n]), ...Object.entries(COUNTRY_ALIASES)]
      .filter(([phrase]) => phrase.length > 2 && mentions(aff, phrase))
      .map(([phrase, n]) => ({ n, end: aff.toLowerCase().lastIndexOf(phrase) + phrase.length, len: phrase.length }))
      .sort((a, b) => b.end - a.end || b.len - a.len);
    if (candidates[0]) return { country: candidates[0].n, source: "affiliation" };

    // 3 · the institution's country in our catalogue
    const affNorm = ` ${normalizeInstitution(aff)} `;
    const inst = INSTITUTIONS.find((i) => [i.name, ...(i.aliases || [])]
      .some((form) => { const f = normalizeInstitution(form); return f.length > 3 && affNorm.includes(` ${f} `); }));
    const instCountry = toListName(inst?.country);
    if (instCountry) return { country: instCountry, source: "institution" };

    // 4 · a well-known city
    const city = Object.keys(CITY_COUNTRY).filter((c) => mentions(aff, c)).sort((a, b) => b.length - a.length)[0];
    if (city) return { country: CITY_COUNTRY[city], source: "city" };
  }

  // 5 · the email domain
  const domain = String(email || "").split("@")[1]?.toLowerCase() || "";
  const tld = domain.split(".").pop();
  if (tld && tld.length === 2) {
    const iso = (TLD_ISO[tld] || tld).toUpperCase();
    const hit = worldCountries.find(([, code]) => code === iso);
    if (hit) return { country: hit[0], source: "email" };
  }
  if (tld && US_DOMAINS.includes(tld)) return { country: "United States", source: "email" };

  return { country: "", source: "" };
}

// What to tell the author under the field when the country was worked out rather than read.
export const COUNTRY_SOURCE_HINT: Record<string, string> = {
  affiliation: "Taken from the affiliation",
  institution: "Matched from the institution",
  city: "Guessed from the city in the affiliation",
  email: "Guessed from the email address",
};
