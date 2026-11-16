// One-off edit helper: Conference Details › Format & Venue as the prototype's: a centred card with no sections rail, "Event format" cards with their icons,
// Venue name, City / Country (both required), State / province, and its own "Save Venue" button.
import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.replace(a, () => b); n++; };

// the venue tab
const v0 = s.indexOf('          {tab === "venue" && (');
const v1 = s.indexOf('          {tab === "branding" && (');
if (v0 < 0 || v1 < 0) console.log("MISSING venue block"); else {
  s = s.slice(0, v0) + `          {tab === "venue" && (
            <div className="space-y-4">
              <div>
                <div className={LABEL}><HelpLabel help="eventType">Event format</HelpLabel> *</div>
                <div role="group" aria-label="Event format" className="grid gap-2.5 sm:grid-cols-3">
                  {([["in_person", "In-Person", "Attendees gather at a physical venue", MapPin], ["virtual", "Virtual", "Fully online, no physical venue", Globe], ["hybrid", "Hybrid", "Both in-person and online attendance", Layers]] as const).map(([k, l, d, Icon]) => (
                    <button key={k} type="button" aria-pressed={f.mode === k} onClick={() => set("mode", k)} className={cn("cursor-pointer rounded-xl border-[1.5px] p-3 text-left transition-colors", f.mode === k ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-line-strong")}>
                      <span className={cn("flex items-center gap-2 text-sm font-bold", f.mode === k ? "text-primary" : "text-navy")}><Icon size={15} aria-hidden="true" /> {l}</span>
                      <span className="mt-0.5 block text-xs text-ink-faint">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div><label htmlFor="cd-venue" className={LABEL}><HelpLabel help="venue">Venue name</HelpLabel></label><input id="cd-venue" value={f.venue} maxLength={300} placeholder="Venue name" onChange={(ev) => set("venue", ev.target.value)} className={INPUT_CLASS} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="cd-city" className={LABEL}>City *</label><input id="cd-city" value={f.city} maxLength={120} onChange={(ev) => set("city", ev.target.value)} className={INPUT_CLASS} /></div>
                <div><label htmlFor="cd-country" className={LABEL}>Country / region *</label><select id="cd-country" value={f.country} onChange={(ev) => set("country", ev.target.value)} style={CHEVRON} className={selectCls(f.country)}><option value="">Select…</option>{f.country && !COUNTRIES.includes(f.country) && <option value={f.country}>{f.country}</option>}{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label htmlFor="cd-state" className={LABEL}>State / province</label><input id="cd-state" value={f.state} maxLength={120} onChange={(ev) => set("state", ev.target.value)} className={INPUT_CLASS} /></div>
              </div>
              <p className="text-xs text-ink-faint">The venue address search and the map pin (Google Maps) are not ported yet, and the postal code has nowhere to be saved.</p>
            </div>
          )}
` + s.slice(v1); n++;
}

// layout: the card is centred and has no rail outside Basic Details
rep('<div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">\n        <section style={CARD} className="min-w-0 rounded-2xl bg-white p-6">', '<div className={cn("grid items-start gap-6", tab === "basic" && "xl:grid-cols-[minmax(0,1fr)_300px]")}>\n        <section style={CARD} className={cn("min-w-0 rounded-2xl bg-white p-6", tab !== "basic" && "mx-auto w-full max-w-[51rem]")}>');
rep('        <SectionsRail\n          sections={[', '        {tab === "basic" && <SectionsRail\n          sections={[');
rep('href: `/chair/${e}/settings/submissions` }]}\n        />\n      </div>', 'href: `/chair/${e}/settings/submissions` }]}\n        />}\n      </div>');

// the button: Update Conference on Basic Details, Save Venue on Format & Venue
rep('            {stillNeeded.length > 0 && <span className="text-xs font-semibold text-danger">Still needed: {stillNeeded.join(", ")}</span>}\n            <span data-tour="cd-save" className="inline-flex"><Button className="disabled:!bg-slate-400 disabled:!opacity-100" disabled={!ok || stillNeeded.length > 0 || busy} onClick={() => onSave(f)}>{busy ? "Saving…" : "Update Conference"}</Button></span>',
  '            {tab === "venue"\n              ? <Button disabled={!ok || busy || !f.city.trim() || !f.country} onClick={() => onSave(f)}>{busy ? "Saving…" : "Save Venue"}</Button>\n              : tab === "basic" && <>{stillNeeded.length > 0 && <span className="text-xs font-semibold text-danger">Still needed: {stillNeeded.join(", ")}</span>}\n            <span data-tour="cd-save" className="inline-flex"><Button className="disabled:!bg-slate-400 disabled:!opacity-100" disabled={!ok || stillNeeded.length > 0 || busy} onClick={() => onSave(f)}>{busy ? "Saving…" : "Update Conference"}</Button></span></>}');
rep('import { AlertTriangle, Sparkles, X } from "lucide-react";', 'import { AlertTriangle, Globe, Layers, MapPin, Sparkles, X } from "lucide-react";');
fs.writeFileSync(f, s); console.log("applied", n);
