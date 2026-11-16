import fs from "node:fs";
const f = "../src/features/conferences/components/create-conference-page.tsx"; let s = fs.readFileSync(f, "utf8");
const start = s.indexOf(`                      {/* The prototype's map address picker needs a Google Maps key`);
const endMark = `to enable it.</p>\n                      </div>\n`;
const end = s.indexOf(endMark, start) + endMark.length;
if (start < 0 || end < endMark.length) throw new Error("block");
s = s.slice(0, start) + `                      <VenueMapPicker initialAddress={form.address} venue={form.venue} city={form.city} country={form.country} onLocationChange={(l) => pickPlace({ address: l.address, city: l.city, state: l.state, country: l.country, postalCode: l.postalCode })} />\n` + s.slice(end);
const a = `<input id="cc-venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. India Habitat Centre" className={cls("venue")} />`;
if (!s.includes(a)) throw new Error("venue");
s = s.replace(a, () => `<VenueSearchInput id="cc-venue" value={form.venue} onChange={(v) => set("venue", v)} onPick={(p) => pickPlace({ venue: p.venue, address: p.address, city: p.city, state: p.state, country: p.country, postalCode: p.postalCode })} placeholder="e.g. India Habitat Centre" className={cls("venue")} />`);
const b = `  // In the prototype a real account's request is saved`;
if (!s.includes(b)) throw new Error("anchor");
s = s.replace(b, () => `  // A place picked from the search box or the map: fills what Google knows (blank parts keep what is typed); a new country also sets the time zone.
  const pickPlace = (p: Partial<Pick<NewConferenceInput, "venue" | "address" | "city" | "state" | "country" | "postalCode">>) => {
    const next = { venue: p.venue || form.venue, address: p.address ?? form.address, city: p.city || form.city, state: p.state || form.state, postalCode: p.postalCode || form.postalCode, country: p.country || form.country };
    if (next.country !== form.country) setCountry(next.country);
    setForm((f) => ({ ...f, ...next }));
  };
` + b);
s = s.replace(`import { EMPTY_NEW_CONFERENCE,`, () => `import { VenueMapPicker } from "@/components/ui/venue-map-picker";\nimport { VenueSearchInput } from "@/components/ui/venue-search-input";\nimport { EMPTY_NEW_CONFERENCE,`);
fs.writeFileSync(f, s); console.log("ok");
