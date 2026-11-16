import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `<input id="cd-venue" value={f.venue} maxLength={300} placeholder="Venue name" onChange={(ev) => set("venue", ev.target.value)} className={INPUT_CLASS} />`;
const b = `<VenueSearchInput id="cd-venue" value={f.venue} placeholder="Venue name" onChange={(v) => set("venue", v)} onPick={(p) => setF((x) => ({ ...x, venue: p.venue || x.venue, address: p.address, city: p.city || x.city, state: p.state, country: p.country || x.country, postalCode: p.postalCode, lat: p.lat ?? x.lat, lng: p.lng ?? x.lng }))} className={INPUT_CLASS} />`;
if (!s.includes(a)) throw new Error("missing");
s = s.replace(a, () => b).replace(`import { VenueMapPicker } from "@/components/ui/venue-map-picker";`, () => `import { VenueMapPicker } from "@/components/ui/venue-map-picker";\nimport { VenueSearchInput } from "@/components/ui/venue-search-input";`);
fs.writeFileSync(f, s); console.log("ok");
