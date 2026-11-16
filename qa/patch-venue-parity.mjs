// One-off edit helper: Conference Details › Format & Venue as the prototype's (hidden venue fields for Virtual, "Organizer city", width, cards, "Still needed", completeness card).
import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.replace(a, () => b); n++; };

// completeness: the prototype's eight equal items
rep(`  const pct = Math.round((needed.filter(([, d]) => d).length / needed.length) * 100);`,
`  const profile = [Boolean(f.webPage.trim()), f.topics.length > 0, typesSet, typesSet, cfp.managers > 0, cfp.publishing, cfp.description, Boolean(initial.logoUrl)];
  const pct = Math.round((profile.filter(Boolean).length / profile.length) * 100);
  const venueMissing = [!f.mode && "event format", !f.city.trim() && "city", !f.country && "country"].filter(Boolean) as string[];
  const modeLabel = ({ in_person: "In-Person", virtual: "Virtual", hybrid: "Hybrid" } as const)[f.mode as "in_person"] ?? "";`);
rep(`<p className="mt-2.5 text-xs text-ink-faint">Complete the sections below so authors and reviewers see a finished conference.</p>`,
`<p className="mt-2.5 text-xs text-ink-faint">{modeLabel ? \`\${modeLabel} · \` : ""}{pct === 100 ? "Everything's filled in." : "Complete the sections below so authors and reviewers see a finished conference."}</p>`);

// width: venue tab is 3/4 on large screens
rep(`tab !== "basic" && "mx-auto w-full max-w-[51rem]")}>`, `tab !== "basic" && "mx-auto w-full lg:w-3/4")}>`);

// format cards
rep(`<div role="group" aria-label="Event format" className="grid gap-2.5 sm:grid-cols-3">`, `<div role="radiogroup" aria-label="Event format" className="grid grid-cols-1 gap-2 sm:grid-cols-3">`);
rep(`<button key={k} type="button" aria-pressed={f.mode === k} onClick={() => set("mode", k)} className={cn("cursor-pointer rounded-xl border-[1.5px] p-3 text-left transition-colors", f.mode === k ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-line-strong")}>
                      <span className="flex items-start gap-2.5">
                        <Icon size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", f.mode === k ? "text-primary" : "text-ink-faint")} />
                        <span className="min-w-0"><span className={cn("block text-sm font-bold", f.mode === k ? "text-primary" : "text-navy")}>{l}</span><span className="mt-0.5 block text-xs text-ink-faint">{d}</span></span>
                      </span>
                    </button>`,
`<button key={k} type="button" role="radio" aria-checked={f.mode === k} onClick={() => set("mode", k)} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition-colors", f.mode === k ? "border-primary bg-primary-soft" : "border-line bg-white")}>
                      <Icon size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", f.mode === k ? "text-primary" : "text-ink-faint")} />
                      <span><span className={cn("block text-sm font-semibold", f.mode === k ? "text-primary" : "text-ink")}>{l}</span><span className="mt-0.5 block text-xs text-ink-faint">{d}</span></span>
                    </button>`);

// hide venue name + map for Virtual
rep(`              <div><label htmlFor="cd-venue" className={LABEL}>`, `              {f.mode !== "virtual" && <>
              <div><label htmlFor="cd-venue" className={LABEL}>`);
rep(`lat: l.lat, lng: l.lng }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="cd-city" className={LABEL}>City *</label>`, `lat: l.lat, lng: l.lng }))} />
              </div>
              </>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="cd-city" className={LABEL}>{f.mode === "virtual" ? "Organizer city" : "City"} *</label>`);
rep(`<option value="">Select…</option>{f.country`, `<option value="">Select a country</option>{f.country`);
rep(`                <div><label htmlFor="cd-state" className={LABEL}>State / province</label>`, `              </div>
              {f.mode !== "virtual" && <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="cd-state" className={LABEL}>State / province</label>`);
rep(`onChange={(ev) => set("postalCode", ev.target.value)} className={INPUT_CLASS} /></div>
              </div>`, `onChange={(ev) => set("postalCode", ev.target.value)} className={INPUT_CLASS} /></div>
              </div>}`);

// footer
rep(`? <Button disabled={!ok || busy || !f.city.trim() || !f.country} onClick={() => onSave(f)}>{busy ? "Saving…" : "Save Venue"}</Button>`,
`? <>{venueMissing.length > 0 && <span className="text-xs font-semibold text-danger">Still needed: {venueMissing.join(", ")}</span>}<Button className="disabled:!bg-slate-400 disabled:!opacity-100" disabled={!ok || busy || venueMissing.length > 0} onClick={() => onSave(f)}>{busy ? "Saving…" : "Save Venue"}</Button></>`);
fs.writeFileSync(f, s); console.log("applied", n);
