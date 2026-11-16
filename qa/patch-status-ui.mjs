import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf('<select id="cd-status"'); const b = s.indexOf("</select>", a) + "</select>".length;
if (a < 0) throw new Error("status select not found");
s = s.slice(0, a) + '<ConferenceStatusField slug={slug} acronym={f.acronym} status={f.status} endDate={f.endDate} onChanged={onLogoSaved} />' + s.slice(b);
s = s.replace('<label htmlFor="cd-status" className={LABEL}>', '<label className={LABEL}>');
s = s.replace('import { licenseEndOf, LicenseExpiryField } from "./license-expiry-field";', 'import { ConferenceStatusField } from "./conference-status-field";\nimport { licenseEndOf, LicenseExpiryField } from "./license-expiry-field";');
fs.writeFileSync(f, s);
