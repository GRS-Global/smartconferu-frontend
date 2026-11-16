// One-off edit helper: Conference Details gets the license expiry, the venue address + Google map, the Branding tab and the CFP rail links.
import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.replace(a, () => b); n++; };

// 1. contact row: License expiry beside the contact email (the prototype's layout), 12 px gap
rep('<div id="cd-contact" className="scroll-mt-24 grid gap-4 border-t border-muted pt-4 sm:grid-cols-2">\n                <div><label htmlFor="cd-mail"', '<div id="cd-contact" className="scroll-mt-24 grid gap-3 border-t border-muted pt-4 sm:grid-cols-2">\n                <LicenseExpiryField slug={slug} name={f.acronym || f.name} createdAt={f.createdAt} licenseExpiry={f.licenseExpiry} />\n                <div><label htmlFor="cd-mail"');
rep('{err(problems.email)}</div>\n                <div />\n', '{err(problems.email)}</div>\n');

// 2. the venue tab: format cards, venue name, the address search + map, city / country, state / postal code
const v0 = s.indexOf('          {tab === "venue" && ('); const v1 = s.indexOf('          {tab === "branding" && (');
if (v0 < 0 || v1 < 0) console.log("MISSING venue block"); else {
  const old = s.slice(v0, v1);
  const fmt0 = old.indexOf("              <div>\n                <div className={LABEL}><HelpLabel help=\"eventType\">"); const fmt1 = old.indexOf("              <div><label htmlFor=\"cd-venue\"");
  const formatBlock = old.slice(fmt0, fmt1);
  s = s.slice(0, v0) + `          {tab === "venue" && (
            <div className="space-y-4">
${formatBlock}              <div><label htmlFor="cd-venue" className={LABEL}><HelpLabel help="venue">Venue name</HelpLabel></label><input id="cd-venue" value={f.venue} maxLength={300} placeholder="Venue name" onChange={(ev) => set("venue", ev.target.value)} className={INPUT_CLASS} /></div>
              <div>
                <label className={LABEL}><HelpLabel help="venueAddress">Venue address</HelpLabel></label>
                <VenueMapPicker initialAddress={f.address} venue={f.venue} address={f.address} city={f.city} country={f.country} onLocationChange={(l) => setF((x) => ({ ...x, address: l.address, city: l.city || x.city, state: l.state || x.state, country: l.country || x.country, postalCode: l.postalCode, lat: l.lat, lng: l.lng }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="cd-city" className={LABEL}>City *</label><input id="cd-city" value={f.city} maxLength={120} onChange={(ev) => set("city", ev.target.value)} className={INPUT_CLASS} /></div>
                <div><label htmlFor="cd-country" className={LABEL}>Country / region *</label><select id="cd-country" value={f.country} onChange={(ev) => set("country", ev.target.value)} style={CHEVRON} className={selectCls(f.country)}><option value="">Select…</option>{f.country && !COUNTRIES.includes(f.country) && <option value={f.country}>{f.country}</option>}{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label htmlFor="cd-state" className={LABEL}>State / province</label><input id="cd-state" value={f.state} maxLength={120} onChange={(ev) => set("state", ev.target.value)} className={INPUT_CLASS} /></div>
                <div><label htmlFor="cd-postal" className={LABEL}>Postal / ZIP code</label><input id="cd-postal" value={f.postalCode} maxLength={20} onChange={(ev) => set("postalCode", ev.target.value)} className={INPUT_CLASS} /></div>
              </div>
            </div>
          )}
` + s.slice(v1); n++;
}

// 3. Branding is its own page-wide editor (no white card, no Update button)
rep('      <div className={cn("grid items-start gap-6", tab === "basic" && "xl:grid-cols-[minmax(0,1fr)_300px]")}>', '      {tab === "branding" ? <BrandingTab slug={slug} acronym={f.acronym} name={f.name} logoUrl={initial.logoUrl} onSaved={onLogoSaved} /> : <div className={cn("grid items-start gap-6", tab === "basic" && "xl:grid-cols-[minmax(0,1fr)_300px]")}>');
rep('        />}\n      </div>\n    </div>\n  );\n}', '        />}\n      </div>}\n    </div>\n  );\n}');

// 4. the rail: License & contact shows the license end, and the CFP links (statuses from the database)
rep('{ id: "cd-contact", label: "License & contact", meta: f.contactEmail || "No contact email" }', '{ id: "cd-contact", label: "License & contact", meta: licenseEnd ? `License until ${licenseEnd}` : f.contactEmail || "No contact email" }');
rep('status: typesSet ? { label: "Done", done: true } : { label: "Incomplete" }, href: `/chair/${e}/settings/submissions` }]}', `status: typesSet ? { label: "Done", done: true } : { label: "Incomplete" }, href: \`/chair/\${e}/settings/submissions\` },
            { label: "CFP managers", desc: "Who else can edit or publish this CFP", status: cfp.managers > 0 ? { label: "Done", done: true } : { label: "Incomplete" }, href: \`\${PROTOTYPE_URL}/prototype/cfp-draft/\${e}/managers\` },
            { label: "Publishing intent", desc: "Where accepted papers will be published", status: cfp.publishing ? { label: "Done", done: true } : { label: "Incomplete" }, href: \`\${PROTOTYPE_URL}/prototype/cfp-draft/\${e}/edit-content\` }]}`);

// 5. props and state
rep('function Form({ initial, slug, types, typesSet, onSave, busy, tab, setTab }: { initial: ConferenceInfo; slug: string; types: string[]; typesSet: boolean;', 'function Form({ initial, slug, types, typesSet, cfp, onLogoSaved, onSave, busy, tab, setTab }: { initial: ConferenceInfo; slug: string; types: string[]; typesSet: boolean; cfp: CfpFacts; onLogoSaved: () => void;');
rep('  const e = encodeURIComponent(slug);\n  const tabBtn', '  const e = encodeURIComponent(slug);\n  const licenseEnd = (() => { const d = f.licenseExpiry || (f.createdAt ? licenseEndOf(f.createdAt) : ""); return d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""; })();\n  const tabBtn');
rep('types={state.settings.presentationTypes} typesSet={state.settings.stored} busy={busy}', 'types={state.settings.presentationTypes} typesSet={state.settings.stored} cfp={cfp} onLogoSaved={reload} busy={busy}');
rep('  const [tab, setTab] = useState<Tab>("basic");\n  const { state, retry, reload } = useConferenceInfo(slug);', '  const [tab, setTab] = useState<Tab>("basic");\n  const { state, retry, reload } = useConferenceInfo(slug);\n  const [cfp, setCfp] = useState<CfpFacts>({ managers: 0, publishing: false });\n  useEffect(() => { void getChairService().then((c) => c.loadCfpFacts(slug)).then(setCfp).catch(() => undefined); }, [slug]);');
rep('import { useCallback, useState } from "react";', 'import { useCallback, useEffect, useState } from "react";');
rep('import type { ConferenceInfo } from "@/types/chair";', 'import type { CfpFacts, ConferenceInfo } from "@/types/chair";');
rep('import { TimezoneSelect } from "@/components/ui/timezone-select";', 'import { TimezoneSelect } from "@/components/ui/timezone-select";\nimport { VenueMapPicker } from "@/components/ui/venue-map-picker";');
rep('import { HelpLabel } from "./setting-label";', 'import { BrandingTab } from "./branding-tab";\nimport { licenseEndOf, LicenseExpiryField } from "./license-expiry-field";\nimport { HelpLabel } from "./setting-label";');
fs.writeFileSync(f, s); console.log("applied", n);

// license-expiry-field exports the end-of-license helper
const g = "../src/features/chair/components/license-expiry-field.tsx"; let t = fs.readFileSync(g, "utf8");
if (!t.includes("export const licenseEndOf")) { t = t.replace("const show = (s: string)", "/** The day a license ends when Smartconferu has set none: 30 days from the day the conference was created. */\nexport const licenseEndOf = (createdAt: string) => addDays(createdAt, TRIAL_DAYS);\nconst show = (s: string)"); fs.writeFileSync(g, t); }
