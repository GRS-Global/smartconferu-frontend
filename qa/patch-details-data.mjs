// One-off edit helper: the data behind Conference Details' venue address, logo, license and the rail's CFP facts (types, services, the real and the mock one).
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/";

edit(d + "types/chair.ts", [
  ["smartConfEmail: string; topics: string[]; status: string;", `smartConfEmail: string; topics: string[]; status: string;
  /** The venue's address, postal code and the pin's coordinates (in \`conferences.details\`; the map picker fills them). */
  address: string; postalCode: string; lat: number | null; lng: number | null;
  /** The conference logo: its public address and its path in the \`public\` storage bucket ("" = none, the monogram is used). */
  logoUrl: string; logoPath: string;
  /** The day the conference was created, and the day its license ends when Smartconferu has set one ("" = 30 days from creation). */
  createdAt: string; licenseExpiry: string;`],
  ["export interface ConferenceInfo {", `/** A chair's request to move the license date, and what the Super Admin answered (\`license_requests\`, migration 0035). */
export interface LicenseRequest { id: string; requestedDate: string; reason: string; status: "pending" | "approved" | "declined" | "withdrawn"; decisionReason: string; newExpiry: string; createdAt: string }
/** What the Call for Papers already has, for the Conference Details rail: how many CFP managers, and whether the publishing intent is written. */
export interface CfpFacts { managers: number; publishing: boolean }

export interface ConferenceInfo {`],
]);

edit(d + "types/conference.ts", [["  acronym: string;\n  name: string;", "  acronym: string;\n  /** The conference logo (a public address), when it has one: shown instead of the monogram. */\n  logoUrl?: string;\n  name: string;"]]);

edit(d + "services/chair.ts", [
  ["  saveInfo(conferenceSlug: string, info: ConferenceInfo): Promise<void>;", `  saveInfo(conferenceSlug: string, info: ConferenceInfo): Promise<void>;
  /** Uploads the logo (null removes it) and returns its public address ("" once removed). */
  saveLogo(conferenceSlug: string, file: File | null): Promise<string>;
  /** The conference's latest license-extension request, if any. */
  loadLicenseRequest(conferenceSlug: string): Promise<LicenseRequest | null>;
  requestLicenseExtension(conferenceSlug: string, requestedDate: string, reason: string): Promise<void>;
  withdrawLicenseRequest(conferenceSlug: string): Promise<void>;
  loadCfpFacts(conferenceSlug: string): Promise<CfpFacts>;`],
  ["import type { ChairActivityLog,", "import type { CfpFacts, LicenseRequest, ChairActivityLog,"],
]);

edit(d + "mocks/chair.ts", [
  ["  async loadActivityLogs()", `  async saveLogo(_slug, file) { return file ? URL.createObjectURL(file) : ""; },
  async loadLicenseRequest() { return null; },
  async requestLicenseExtension() { /* mock mode keeps nothing */ },
  async withdrawLicenseRequest() { /* mock mode keeps nothing */ },
  async loadCfpFacts() { return PARITY ? { managers: 1, publishing: true } : { managers: 0, publishing: false }; },
  async loadActivityLogs()`],
]);
console.log("applied", n);
