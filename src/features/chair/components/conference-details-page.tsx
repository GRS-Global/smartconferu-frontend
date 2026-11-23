"use client";

import { useMasterDataVersion } from "@/lib/master-data";
import { AlertTriangle, Globe, Layers, MapPin, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { INPUT_CLASS } from "@/components/ui/field";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { VenueMapPicker } from "@/components/ui/venue-map-picker";
import { VenueSearchInput } from "@/components/ui/venue-search-input";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { cn } from "@/lib/cn";
import { PROTOTYPE_URL } from "@/lib/config";
import { COUNTRIES } from "@/lib/country-codes";
import { RESEARCH_AREA_GROUPS, RESEARCH_SUBAREAS } from "@/lib/research-areas";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import { suggestTopics } from "@/services/paper-ai";
import type { CfpFacts, ConferenceInfo } from "@/types/chair";
import { useConferenceInfo } from "../use-conference-info";
import { SectionsRail } from "./sections-rail";
import { LANGUAGES } from "../languages";
import { BrandingTab } from "./branding-tab";
import { ConferenceStatusField } from "./conference-status-field";
import { licenseEndOf, LicenseExpiryField } from "./license-expiry-field";
import { HelpLabel } from "./setting-label";

/* Conference Settings › Conference Details (the prototype's ChairSettingsPage): a "Profile completeness" bar, the tabs Basic Details / Format &
   Venue / Branding, and a Sections rail. Everything is a column of `conferences`, except the time zone, abstract deadline, summary, language,
   forwarding / SmartConf emails and topics, which live in `conferences.details`. Not ported: the venue map pin, "Suggest with AI" for topics,
   the license expiry and "Request extension", CFP managers and Publishing intent, Branding (logo, colours), archiving and the deletion request. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
// The prototype's Conference Details label: 12 px / 600, 6 px below, --text-soft; a required "*" is plain text in the label's own colour (only Topics uses a red one).
const LABEL = "mb-1.5 block text-xs font-semibold text-ink-soft";
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const MIN_TOPICS = 4;
const AI_TOPICS = 5;
// The prototype's selects: 12 px side padding, a light chevron, and the placeholder in the faint colour until a value is chosen.
const CHEVRON = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" } as const;
const selectCls = (value: string) => cn("w-full appearance-none rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-primary disabled:bg-canvas disabled:text-ink-muted", value ? "text-ink" : "text-ink-faint");

type Tab = "basic" | "venue" | "branding";

function Form({ initial, slug, types, typesSet, cfp, onLogoSaved, onSave, busy, tab, setTab }: { initial: ConferenceInfo; slug: string; types: string[]; typesSet: boolean; cfp: CfpFacts; onLogoSaved: () => void; onSave: (i: ConferenceInfo) => void; busy: boolean; tab: Tab; setTab: (t: Tab) => void }) {
  useMasterDataVersion(); // render again when the Super Admin's lists arrive from the backend
  const [f, setF] = useState(initial);
  const [topic, setTopic] = useState("");
  const set = <K extends keyof ConferenceInfo>(k: K, v: ConferenceInfo[K]) => setF((s) => ({ ...s, [k]: v }));
  const problems = {
    name: !f.name.trim() ? "Give the conference a name." : "",
    web: f.webPage.trim() && !/^https?:\/\/\S+$/i.test(f.webPage.trim()) ? "Start the address with http:// or https://." : "",
    email: f.contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(f.contactEmail.trim()) ? "Enter a valid email address." : "",
    dates: f.startDate && f.endDate && f.endDate < f.startDate ? "The conference can't end before it starts." : "",
    review: f.submissionDeadline && f.reviewDeadline && f.reviewDeadline < f.submissionDeadline ? "Reviews can't be due before the submission deadline." : "",
    about: words(f.about) > 1200 ? "Shorten it to 1,200 words." : "",
  };
  const ok = !Object.values(problems).some(Boolean);
  const needed: Array<[string, boolean]> = [["website", Boolean(f.webPage.trim())], ["title", Boolean(f.name.trim())], ["dates", Boolean(f.startDate && f.endDate)], ["primary area", Boolean(f.primaryArea)], ["secondary area", Boolean(f.secondaryArea)], ["contact email", Boolean(f.contactEmail.trim())], ["topics", f.topics.length >= MIN_TOPICS]];
  const stillNeeded = needed.filter(([, d]) => !d).map(([l]) => l);
  const profile = [Boolean(f.webPage.trim()), f.topics.length > 0, typesSet, typesSet, cfp.managers > 0, cfp.publishing, cfp.description, Boolean(initial.logoUrl)];
  const pct = Math.round((profile.filter(Boolean).length / profile.length) * 100);
  const venueMissing = [!f.mode && "event format", !f.city.trim() && "city", !f.country && "country"].filter(Boolean) as string[];
  const modeLabel = ({ in_person: "In-Person", virtual: "Virtual", hybrid: "Hybrid" } as const)[f.mode as "in_person"] ?? "";
  const bad = (m: string) => (m ? "border-danger" : "");
  const err = (m: string) => m && <p role="alert" className="mt-1 text-xs font-medium text-danger">{m}</p>;
  const addTopic = () => { const t = topic.trim(); if (t && !f.topics.some((x) => x.toLowerCase() === t.toLowerCase())) set("topics", [...f.topics, t]); setTopic(""); };
  const [ai, setAi] = useState<{ status: "idle" | "loading" | "done" | "error"; added?: number; message?: string }>({ status: "idle" });
  const suggest = async () => {
    setAi({ status: "loading" });
    try {
      const found = await suggestTopics({ title: f.name, about: f.about, primaryArea: f.primaryArea, secondaryArea: f.secondaryArea, existing: f.topics, count: Math.max(1, AI_TOPICS - f.topics.length) });
      const next = [...f.topics]; found.forEach((t) => { if (!next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t); });
      set("topics", next); setAi({ status: "done", added: next.length - f.topics.length });
    } catch (err) { setAi({ status: "error", message: err instanceof Error ? err.message : "Couldn't suggest topics." }); }
  };
  const e = encodeURIComponent(slug);
  const licenseEnd = (() => { const d = f.licenseExpiry || (f.createdAt ? licenseEndOf(f.createdAt) : ""); return d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : ""; })();
  const tabBtn = (k: Tab, l: string) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("border-b-2 px-4 py-[11px] text-sm transition-colors", tab === k ? "border-primary font-bold text-primary" : "border-transparent font-semibold text-ink-muted hover:text-navy")}>{l}</button>;

  return (
    <div className="space-y-5">
      <section style={CARD} className="rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-navy">Profile completeness</h2><b className="text-sm font-extrabold text-primary">{pct}%</b></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div style={{ width: `${pct}%` }} className="h-full rounded-full bg-primary" /></div>
        <p className="mt-2.5 text-xs text-ink-faint">{modeLabel ? `${modeLabel} · ` : ""}{pct === 100 ? "Everything's filled in." : "Complete the sections below so authors and reviewers see a finished conference."}</p>
      </section>
      <div role="tablist" aria-label="Conference details" className="mb-6 flex gap-1 border-b border-line">{tabBtn("basic", "Basic Details")}{tabBtn("venue", "Format & Venue")}{tabBtn("branding", "Branding")}</div>

      {tab === "branding" ? <BrandingTab slug={slug} acronym={f.acronym} name={f.name} logoUrl={initial.logoUrl} onSaved={onLogoSaved} /> : <div className={cn("grid items-start gap-6", tab === "basic" && "xl:grid-cols-[minmax(0,1fr)_300px]")}>
        <section style={CARD} className={cn("min-w-0 rounded-2xl bg-white p-6", tab !== "basic" && "mx-auto w-full lg:w-3/4")}>
          {tab === "basic" && (
            <div className="space-y-4">
              <div id="cd-identity" data-tour="cd-identity" className="scroll-mt-24 space-y-4">
                <div><label htmlFor="cd-web" className={LABEL}><HelpLabel help="webPage">Website</HelpLabel> *</label><input id="cd-web" value={f.webPage} placeholder="https://…" onChange={(ev) => set("webPage", ev.target.value)} aria-invalid={Boolean(problems.web)} className={cn(INPUT_CLASS, bad(problems.web))} />{err(problems.web)}</div>
                <div><label htmlFor="cd-name" className={LABEL}><HelpLabel help="name">Conference title</HelpLabel> *</label><input id="cd-name" value={f.name} maxLength={300} onChange={(ev) => set("name", ev.target.value)} aria-invalid={Boolean(problems.name)} className={cn(INPUT_CLASS, bad(problems.name))} />{err(problems.name)}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="cd-acr" className={LABEL}><HelpLabel help="acronym">Acronym</HelpLabel></label><input id="cd-acr" value={f.acronym} readOnly className={cn(INPUT_CLASS, "bg-canvas text-ink-muted")} /></div>
                  <div><label htmlFor="cd-tz" className={LABEL}><HelpLabel help="timezone">Timezone</HelpLabel></label><TimezoneSelect id="cd-tz" value={f.timezone} onChange={(v) => set("timezone", v)} className="w-full rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-primary" /></div>
                </div>
              </div>
              <div id="cd-dates" className="scroll-mt-24 space-y-4">
                <div><div className={LABEL}><HelpLabel help="dates">Conference dates</HelpLabel> *</div><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Start date" type="date" value={f.startDate} onChange={(ev) => set("startDate", ev.target.value)} className={INPUT_CLASS} /><input aria-label="End date" type="date" value={f.endDate} onChange={(ev) => set("endDate", ev.target.value)} aria-invalid={Boolean(problems.dates)} className={cn(INPUT_CLASS, bad(problems.dates))} /></div>{err(problems.dates)}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div data-tour="cd-abstract-deadline"><label htmlFor="cd-abs" className={LABEL}><HelpLabel help="abstractDeadline">Abstract deadline</HelpLabel></label><input id="cd-abs" type="date" value={f.abstractDeadline} onChange={(ev) => set("abstractDeadline", ev.target.value)} className={INPUT_CLASS} /></div>
                  <div data-tour="cd-submission-deadline"><label htmlFor="cd-sub" className={LABEL}><HelpLabel help="submissionDeadline">Submission deadline</HelpLabel></label><input id="cd-sub" type="date" value={f.submissionDeadline} onChange={(ev) => set("submissionDeadline", ev.target.value)} className={INPUT_CLASS} /></div>
                </div>
                <p className="-mt-2 text-xs text-ink-faint">This is the only place the submission deadline is set — Submission Settings, the Call for Papers and the emails all use it.</p>
              </div>
              <div id="cd-about" data-tour="cd-about" className="scroll-mt-24 space-y-4">
                <div><label htmlFor="cd-sum" className={LABEL}><HelpLabel help="summary">Summary</HelpLabel></label><input id="cd-sum" value={f.summary} maxLength={200} placeholder="One-line summary" onChange={(ev) => set("summary", ev.target.value)} className={INPUT_CLASS} /></div>
                <div><label htmlFor="cd-ab" className={LABEL}><HelpLabel help="about">About the conference</HelpLabel></label><textarea id="cd-ab" rows={7} maxLength={20000} value={f.about} onChange={(ev) => set("about", ev.target.value)} className={INPUT_CLASS} /><div className="mt-1 text-right text-xs text-ink-faint">{words(f.about)} / 1,200 words</div>{err(problems.about)}</div>
              </div>
              <div id="cd-area" className="scroll-mt-24 space-y-4">
                <div data-tour="cd-classification" className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="cd-a1" className={LABEL}><HelpLabel help="primaryArea">Primary area</HelpLabel> *</label><select id="cd-a1" value={f.primaryArea} onChange={(ev) => setF((s) => ({ ...s, primaryArea: ev.target.value, secondaryArea: "" }))} style={CHEVRON} className={selectCls(f.primaryArea)}><option value="">Select an area</option>{RESEARCH_AREA_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.areas.map((a) => <option key={a} value={a}>{a}</option>)}</optgroup>)}</select></div>
                  <div><label htmlFor="cd-a2" className={LABEL}><HelpLabel help="secondaryArea">Secondary area</HelpLabel> *</label><select id="cd-a2" value={f.secondaryArea} disabled={!f.primaryArea} onChange={(ev) => set("secondaryArea", ev.target.value)} style={CHEVRON} className={selectCls(f.secondaryArea)}><option value="">{f.primaryArea ? "Select a secondary area" : "Pick a primary area first"}</option>{(RESEARCH_SUBAREAS[f.primaryArea] ?? []).map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div data-tour="cd-language"><label htmlFor="cd-lang" className={LABEL}><HelpLabel help="language">Language</HelpLabel></label><select id="cd-lang" value={f.language} onChange={(ev) => set("language", ev.target.value)} style={CHEVRON} className={selectCls(f.language)}><option value="">Select a language</option>{LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
                  <div><label className={LABEL}><HelpLabel help="status">Status</HelpLabel></label><ConferenceStatusField slug={slug} acronym={f.acronym} status={f.status} endDate={f.endDate} onChanged={onLogoSaved} /></div>
                </div>
              </div>
              <div id="cd-contact" className="scroll-mt-24 grid gap-3 border-t border-muted pt-4 sm:grid-cols-2">
                <LicenseExpiryField slug={slug} name={f.acronym || f.name} createdAt={f.createdAt} licenseExpiry={f.licenseExpiry} />
                <div><label htmlFor="cd-mail" className={LABEL}><HelpLabel help="contactEmail">Contact email address</HelpLabel> *</label><input id="cd-mail" type="email" value={f.contactEmail} onChange={(ev) => set("contactEmail", ev.target.value)} aria-invalid={Boolean(problems.email)} className={cn(INPUT_CLASS, bad(problems.email))} />{err(problems.email)}</div>
                <div><label htmlFor="cd-reply" className={LABEL}><HelpLabel help="replyForwardingEmail">Reply &amp; forwarding email</HelpLabel></label><input id="cd-reply" type="email" value={f.replyEmail} placeholder="Where author replies get forwarded to" onChange={(ev) => set("replyEmail", ev.target.value)} className={INPUT_CLASS} /></div>
                <div><label htmlFor="cd-sc" className={LABEL}><HelpLabel help="smartConfEmail">SmartConf email</HelpLabel></label><input id="cd-sc" type="email" value={f.smartConfEmail} placeholder="notifications@smartconf.example" onChange={(ev) => set("smartConfEmail", ev.target.value)} className={INPUT_CLASS} /></div>
              </div>
              <div id="cd-topics" data-tour="cd-topics" className="scroll-mt-24 border-t border-muted pt-4">
                <div className="mb-1.5 block text-xs font-semibold text-ink-muted"><HelpLabel help="topics">Topics &amp; research areas</HelpLabel> <span className="text-danger">*</span></div>
                {f.topics.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{f.topics.map((t) => <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-soft-border)] bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => set("topics", f.topics.filter((x) => x !== t))}><X size={11} aria-hidden="true" /></button></span>)}</div>}
                <div className="flex flex-wrap items-center gap-2"><input aria-label="Add a topic" value={topic} onChange={(ev) => setTopic(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addTopic(); } }} placeholder="Add a topic and press Enter…" className={cn(INPUT_CLASS, "min-w-[12rem] flex-1 !px-3 !py-2")} /><button type="button" onClick={addTopic} className="shrink-0 cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-canvas">Add</button><button type="button" onClick={() => void suggest()} disabled={ai.status === "loading"} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--primary-soft-border)] bg-primary-soft px-3 text-xs font-bold text-primary disabled:opacity-60"><Sparkles size={13} aria-hidden="true" /> {ai.status === "loading" ? "Suggesting…" : "Suggest with AI"}</button></div>
                <p className={cn("mt-1.5 text-xs", f.topics.length >= MIN_TOPICS ? "text-success" : "text-ink-faint")}>{f.topics.length} topic{f.topics.length === 1 ? "" : "s"} · at least {MIN_TOPICS} required{ai.status === "done" && (ai.added ?? 0) > 0 && <span className="font-normal text-ink-muted"> — AI added {ai.added}; please check them.</span>}</p>
                {ai.status === "error" && <p role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger"><AlertTriangle size={12} aria-hidden="true" /> {ai.message}</p>}
                <p className="mt-1 text-xs text-ink-faint">Looking for tracks? <a href={`/chair/${e}/settings/submissions`} className="font-semibold text-primary hover:underline">Manage them in Submission Settings</a></p>
              </div>
            </div>
          )}
          {tab === "venue" && (
            <div className="space-y-4">
              <div>
                <div className={LABEL}><HelpLabel help="eventType">Event format</HelpLabel> *</div>
                <div role="radiogroup" aria-label="Event format" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {([["in_person", "In-Person", "Attendees gather at a physical venue", MapPin], ["virtual", "Virtual", "Fully online, no physical venue", Globe], ["hybrid", "Hybrid", "Both in-person and online attendance", Layers]] as const).map(([k, l, d, Icon]) => (
                    <button key={k} type="button" role="radio" aria-checked={f.mode === k} onClick={() => set("mode", k)} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition-colors", f.mode === k ? "border-primary bg-primary-soft" : "border-line bg-white")}>
                      <Icon size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", f.mode === k ? "text-primary" : "text-ink-faint")} />
                      <span><span className={cn("block text-sm font-semibold", f.mode === k ? "text-primary" : "text-ink")}>{l}</span><span className="mt-0.5 block text-xs text-ink-faint">{d}</span></span>
                    </button>
                  ))}
                </div>
              </div>
              {f.mode !== "virtual" && <>
              <div><label htmlFor="cd-venue" className={LABEL}><HelpLabel help="venue">Venue name</HelpLabel></label><VenueSearchInput id="cd-venue" value={f.venue} placeholder="Venue name" onChange={(v) => set("venue", v)} onPick={(p) => setF((x) => ({ ...x, venue: p.venue || x.venue, address: p.address, city: p.city || x.city, state: p.state, country: p.country || x.country, postalCode: p.postalCode, lat: p.lat ?? x.lat, lng: p.lng ?? x.lng }))} className={INPUT_CLASS} /></div>
              <div>
                <label className={LABEL}><HelpLabel help="venueAddress">Venue address</HelpLabel></label>
                <VenueMapPicker initialAddress={f.address} venue={f.venue} address={f.address} city={f.city} country={f.country} onLocationChange={(l) => setF((x) => ({ ...x, address: l.address, city: l.city || x.city, state: l.state || x.state, country: l.country || x.country, postalCode: l.postalCode, lat: l.lat, lng: l.lng }))} />
              </div>
              </>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="cd-city" className={LABEL}>{f.mode === "virtual" ? "Organizer city" : "City"} *</label><input id="cd-city" value={f.city} maxLength={120} onChange={(ev) => set("city", ev.target.value)} className={INPUT_CLASS} /></div>
                <div><label htmlFor="cd-country" className={LABEL}>Country / region *</label><select id="cd-country" value={f.country} onChange={(ev) => set("country", ev.target.value)} className={cn(INPUT_CLASS, "cursor-pointer bg-white", !f.country && "text-ink-faint")}><option value="">Select a country</option>{f.country && !COUNTRIES.includes(f.country) && <option value={f.country}>{f.country}</option>}{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              {f.mode !== "virtual" && <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="cd-state" className={LABEL}>State / province</label><input id="cd-state" value={f.state} maxLength={120} onChange={(ev) => set("state", ev.target.value)} className={INPUT_CLASS} /></div>
                <div><label htmlFor="cd-postal" className={LABEL}>Postal / ZIP code</label><input id="cd-postal" value={f.postalCode} maxLength={20} onChange={(ev) => set("postalCode", ev.target.value)} className={INPUT_CLASS} /></div>
              </div>}
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-4 border-t border-muted pt-5">
            {tab === "venue"
              ? <>{venueMissing.length > 0 && <span className="text-xs font-semibold text-danger">Still needed: {venueMissing.join(", ")}</span>}<Button className="disabled:!bg-slate-400 disabled:!opacity-100" disabled={!ok || busy || venueMissing.length > 0} onClick={() => onSave(f)}>{busy ? "Saving…" : "Save Venue"}</Button></>
              : tab === "basic" && <>{stillNeeded.length > 0 && <span className="text-xs font-semibold text-danger">Still needed: {stillNeeded.join(", ")}</span>}
            <span data-tour="cd-save" className="inline-flex"><Button className="disabled:!bg-slate-400 disabled:!opacity-100" disabled={!ok || stillNeeded.length > 0 || busy} onClick={() => onSave(f)}>{busy ? "Saving…" : "Update Conference"}</Button></span></>}
          </div>
        </section>

        {tab === "basic" && <SectionsRail
          sections={[
            { id: "cd-identity", label: "Title & identity", meta: f.acronym },
            { id: "cd-dates", label: "Dates & deadlines", meta: f.startDate ? `${showDate(f.startDate)}${f.endDate ? ` - ${showDate(f.endDate)}` : ""}` : "Not set" },
            { id: "cd-about", label: "Website & description", meta: f.webPage.trim() ? "Website added" : "No website" },
            { id: "cd-area", label: "Area, language & status", meta: f.primaryArea || "No area chosen", tone: f.status === "archived" ? { label: "Archived", bg: "var(--danger-soft)", color: "var(--danger)" } : { label: "Active", bg: "var(--success-soft)", color: "var(--success)" } },
            { id: "cd-contact", label: "License & contact", meta: licenseEnd ? `License until ${licenseEnd}` : f.contactEmail || "No contact email" },
            { id: "cd-topics", label: "Topics & research areas", meta: `${f.topics.length} topic${f.topics.length === 1 ? "" : "s"}` },
          ]}
          links={[{ label: "Presentation types", desc: types.join(", ") || "None yet", status: typesSet ? { label: "Done", done: true } : { label: "Incomplete" }, href: `/chair/${e}/settings/submissions` },
            { label: "CFP managers", desc: "Who else can edit or publish this CFP", status: cfp.managers > 0 ? { label: "Done", done: true } : { label: "Incomplete" }, href: `${PROTOTYPE_URL}/prototype/cfp-draft/${e}/managers` },
            { label: "Publishing intent", desc: "Where accepted papers will be published", status: cfp.publishing ? { label: "Done", done: true } : { label: "Incomplete" }, href: `${PROTOTYPE_URL}/prototype/cfp-draft/${e}/edit-content` }]}
        />}
      </div>}
    </div>
  );
}

export function ConferenceDetailsPage({ slug }: { slug: string }) {
  const [tab, setTab] = useState<Tab>("basic");
  const { state, retry, reload } = useConferenceInfo(slug);
  const [cfp, setCfp] = useState<CfpFacts>({ managers: 0, publishing: false, description: false });
  useEffect(() => { void getChairService().then((c) => c.loadCfpFacts(slug)).then(setCfp).catch(() => undefined); }, [slug]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const gate = workspaceGate(state, retry, { title: "Conference Details", loadingLabel: "Loading the conference details", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the conference details." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, screening, info } = state;
  const save = async (next: ConferenceInfo) => {
    setBusy(true); setError("");
    try { await (await getChairService()).saveInfo(slug, next); setToast({ title: "Details saved", text: `${next.name} was updated.` }); reload(); } catch (e) { setError(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  };
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="settings/details" screening={screening}>
      <PageHeader title="Conference Details" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }, { label: "Conference Details" }, { strong: true, label: ({ basic: "Basic Details", venue: "Format & Venue", branding: "Branding" } as const)[tab] }]} />
      <div className="hd-page p-8">
        {error && <p role="alert" className="mb-5 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        <Form key={JSON.stringify(info)} initial={info} slug={slug} types={state.settings.presentationTypes} typesSet={state.settings.stored} cfp={cfp} onLogoSaved={reload} busy={busy} onSave={(i) => void save(i)} tab={tab} setTab={setTab} />
      </div>
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
