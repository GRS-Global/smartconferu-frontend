"use client";

import { useMasterDataVersion } from "@/lib/master-data";
import { AlertTriangle, BookOpen, Building2, Calendar, Check, ChevronDown, ChevronRight, Eraser, Globe2, History, Info, Layers, Mail, MapPin, Newspaper, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountrySelect } from "@/components/ui/country-select";
import { LoadingOverlay, Spinner } from "@/components/ui/load-more";
import { Modal } from "@/components/ui/modal";
import { countryTimezone, TimezoneSelect } from "@/components/ui/timezone-select";
import { TriggeredEmailNote } from "@/components/ui/triggered-email-note";
import { cn } from "@/lib/cn";
import { RESEARCH_AREA_GROUPS, RESEARCH_SUBAREAS } from "@/lib/research-areas";
import { SAMPLE_UI } from "@/lib/sample-mode";
import { AuthRequiredError } from "@/services/errors";
import { sendActionEmails } from "@/services/action-emails";
import { getConferenceRequestService } from "@/services/conference-requests";
import { fillConferenceFromWebsite, SMART_FILL_AVAILABLE } from "@/services/smart-fill";
import { VenueMapPicker } from "@/components/ui/venue-map-picker";
import { VenueSearchInput } from "@/components/ui/venue-search-input";
import { EMPTY_NEW_CONFERENCE, type NewConferenceInput } from "@/types/conference-request";
import { BLANK_DRAFT_FORM, clearDraft, draftAge, readDraft, writeDraft, type DraftForm, type SavedDraft } from "../create-conference-draft";
/* Create New Conference (the prototype's CreateConferencePage): the request goes to the Super Admin, who approves or declines it; the chair is
   told by email. The "Required to create" checklist, the live preview and the policy tick are the prototype's. Smart Fill (reading the website with AI
   to fill the form) works with the own backend (services/smart-fill.ts); without it the button is not shown. Not ported: the saved-draft offer and "Clear form". The venue box suggests places (Google Places) and the venue
   address is the map picker, both only when a Maps key is set; as in the prototype they show once an event format other than Virtual is chosen. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// About the conference is limited in words (how chairs and authors think about length); the character cap is only a storage backstop.
const ABOUT_MAX_WORDS = 1200;
const ABOUT_MAX_CHARS = 12000;
const words = (s: string) => (s.trim().match(/\S+/g) || []).length;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const TYPES: Array<{ id: string; label: string; Icon: LucideIcon; desc: string }> = [
  { id: "conference", label: "Conference", Icon: Building2, desc: "A standalone conference or symposium" },
  { id: "book", label: "Book", Icon: BookOpen, desc: "An edited volume or book chapter collection" },
  { id: "journal_special", label: "Journal Special Issue", Icon: Layers, desc: "A themed special issue within a journal" },
  { id: "journal", label: "Journal", Icon: Newspaper, desc: "An open, ongoing call for a journal" },
  { id: "other", label: "Other", Icon: Info, desc: "A grant, competition, or something else" },
];
const FORMATS: Array<{ id: NewConferenceInput["eventType"]; label: string; Icon: LucideIcon; desc: string }> = [
  { id: "in-person", label: "In-Person", Icon: MapPin, desc: "Attendees gather at a physical venue" },
  { id: "virtual", label: "Virtual", Icon: Globe2, desc: "Fully online, no physical venue" },
  { id: "hybrid", label: "Hybrid", Icon: Layers, desc: "Both in-person and online attendance" },
];
const ACRONYM_STOPWORDS = /^(on|of|and|the|for|in|&|a|an|to|at|with)$/i;
/** The prototype's acronym suggestion: "International Conference on Applied Intelligence" + a 2027 start -> "ICAI 2027". Offered only while the
 *  acronym is empty, and only when the title has at least two words once the small words are dropped. Letters are capped at 8. */
const suggestAcronym = (title: string, startDate: string) => {
  const parts = title.split(/\s+/).filter((w) => w && !ACRONYM_STOPWORDS.test(w));
  if (parts.length < 2) return "";
  const letters = parts.map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return startDate ? `${letters} ${startDate.slice(0, 4)}` : letters;
};
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "?");
const SECTIONS = {
  basics: { title: "Basic details of the conference", subtitle: "What it is, when it happens and what it covers — deadlines are set later in Conference Details." },
  location: { title: "Location & contact", subtitle: "How attendees join, where, and how they can reach you." },
};
/** The input look of this page (the prototype's fieldCls): border in classes so focus / error colours can override it. */
const fieldCls = (bad: boolean) => cn("field-no-outline w-full rounded-xl border-[1.5px] bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-4", bad ? "border-danger focus:ring-danger-soft" : "border-line focus:border-primary focus:ring-primary-soft");
const BTN_FX = "transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.35)] hover:scale-[1.02]";

export function CreateConferencePage() {
  useMasterDataVersion(); // render again when the Super Admin's lists arrive from the backend
  const router = useRouter();
  const [form, setForm] = useState<NewConferenceInput>(EMPTY_NEW_CONFERENCE);
  const [showErrors, setShowErrors] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Timezone follows the country until the chair picks one by hand (prototype).
  const [tzAuto, setTzAuto] = useState(false);
  // Smart Fill: reading the website takes a while (the backend opens several pages and asks the AI), so it has its own busy state and message.
  const [fill, setFill] = useState<{ status: "idle" | "loading" | "done" | "error"; message: string }>({ status: "idle", message: "" });
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const [isMac, setIsMac] = useState(false);
  useEffect(() => { setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent)); }, []);
  const set = <K extends keyof NewConferenceInput>(k: K, v: NewConferenceInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  /* Saved draft (same behaviour as the prototype). The draft is the whole form plus the policy tick, kept in this browser only.
     - A dirty form writes it on every change; returning to a blank form (after an edit in this visit) removes it, so an untouched page never
       wipes a draft that is still waiting to be offered.
     - A saved draft is offered ("Continue your draft?"), never restored silently: the person may be starting a different conference. The offer
       is shown only while the form is untouched, so restoring can never overwrite what has been typed since.
     - Leaving through Cancel or the breadcrumb asks first when the form is dirty; closing or reloading the tab raises the browser's own prompt. */
  const draftForm: DraftForm = { ...form, confirmPolicy: policy };
  const isDirty = JSON.stringify(draftForm) !== JSON.stringify(BLANK_DRAFT_FORM);
  const [draftOffer, setDraftOffer] = useState<SavedDraft | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const editedRef = useRef(false);
  // Read after mount (local storage does not exist on the server, so reading it while rendering would not match the server's HTML).
  useEffect(() => { setDraftOffer(readDraft()); }, []);
  useEffect(() => {
    if (isDirty) {
      editedRef.current = true;
      writeDraft(draftForm);
      // The stored draft now holds this newer work, so the older one is no longer on offer (it would reappear if the form went blank again).
      setDraftOffer(null);
    } else if (editedRef.current) {
      clearDraft();
    }
    // draftForm is rebuilt from form + policy every render; those two are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, policy, isDirty]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  const restoreDraft = () => {
    if (!draftOffer) return;
    const { confirmPolicy, ...saved } = draftOffer.form;
    setForm({ ...EMPTY_NEW_CONFERENCE, ...saved });
    setPolicy(confirmPolicy);
    setDraftOffer(null);
  };
  const discardDraft = () => { clearDraft(); setDraftOffer(null); };
  const leave = () => (isDirty ? setConfirmLeave(true) : router.push("/dashboard"));
  const clearForm = () => {
    setForm(EMPTY_NEW_CONFERENCE);
    setPolicy(false);
    setShowErrors(false);
    setTzAuto(false);
    setConfirmClear(false);
    setDraftOffer(null);
    clearDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setCountry = (country: string) => {
    const canAuto = !form.timezone || tzAuto;
    const tz = countryTimezone(country);
    setForm((f) => ({ ...f, country, ...(canAuto ? { timezone: tz } : {}) }));
    if (canAuto) setTzAuto(Boolean(tz));
  };
  // A place picked from the search box or the map: fills what Google knows (blank parts keep what is typed); a new country also sets the time zone.
  const pickPlace = (p: Partial<Pick<NewConferenceInput, "venue" | "address" | "city" | "state" | "country" | "postalCode">>) => {
    const next = { venue: p.venue || form.venue, address: p.address ?? form.address, city: p.city || form.city, state: p.state || form.state, postalCode: p.postalCode || form.postalCode, country: p.country || form.country };
    if (next.country !== form.country) setCountry(next.country);
    setForm((f) => ({ ...f, ...next }));
  };
  /** Reads the website and fills what is still empty (what has been typed is never overwritten). */
  const smartFill = async () => {
    const url = formRef.current.webPage.trim();
    if (!URL_RE.test(url)) { setFill({ status: "error", message: "Enter your conference website first, e.g. https://yourconference.org" }); return; }
    setFill({ status: "loading", message: "Reading the website — this can take up to a minute…" });
    try {
      const { values, source } = await fillConferenceFromWebsite(url);
      const cur = formRef.current;
      const applied: Partial<NewConferenceInput> = {};
      let filled = 0;
      for (const [k, v] of Object.entries(values) as Array<[keyof NewConferenceInput, string]>) {
        // "Conference" is the form's starting choice, so it counts as empty until the person picks something else.
        const empty = k === "type" ? cur.type === "conference" && !cur.typeInfo.trim() : k === "typeInfo" ? !cur.typeInfo.trim() : !String(cur[k] ?? "").trim();
        // A secondary area only fits the primary area it was read with.
        if (k === "secondaryArea" && (applied.primaryArea ?? cur.primaryArea) !== values.primaryArea) continue;
        if (!empty || k === "webPage") continue;
        (applied as Record<string, string>)[k] = v;
        filled += 1;
      }
      if (applied.timezone) setTzAuto(false);
      setForm((f) => ({ ...f, ...applied }));
      setFill(filled
        ? { status: "done", message: `Filled ${filled} field${filled === 1 ? "" : "s"} from ${source.replace(/^https?:\/\//, "")}. Please check them and add anything that is missing.` }
        : { status: "done", message: "Nothing new to fill — the fields it found are already filled in, or the website didn't say." });
    } catch (e) {
      setFill({ status: "error", message: e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Couldn't read that website. Please fill the form by hand." });
    }
  };

  // In the prototype a real account's request is saved and sent for approval; the sample build creates the conference straight away.
  const live = !SAMPLE_UI;

  const checks: Array<{ key: string; label: string; ok: boolean; msg: string }> = [
    { key: "webPage", label: "Website", ok: URL_RE.test(form.webPage.trim()), msg: form.webPage.trim() ? "That doesn't look like a web address, e.g. https://yourconference.org" : "Add your conference website." },
    { key: "title", label: "Conference title", ok: Boolean(form.title.trim()), msg: "Add a title for your conference." },
    { key: "acronym", label: "Acronym", ok: Boolean(form.acronym.trim()), msg: "Add a short acronym, e.g. ISBM 2026." },
    ...(form.type === "other" ? [{ key: "typeInfo", label: "Type information", ok: Boolean(form.typeInfo.trim()), msg: "Briefly describe what this is." }] : []),
    // As in the prototype only the end date is required (picking a start date fills an empty end date, so one-day events take one click).
    { key: "endDate", label: "Conference dates", ok: Boolean(form.endDate), msg: "Pick the conference dates." },
    { key: "primaryArea", label: "Primary area", ok: Boolean(form.primaryArea), msg: "Pick the main research area." },
    { key: "secondaryArea", label: "Secondary area", ok: Boolean(form.secondaryArea), msg: form.primaryArea ? "Pick a secondary area." : "Pick a primary area first." },
    { key: "eventType", label: "Event format", ok: Boolean(form.eventType), msg: "Choose how attendees will join." },
    { key: "city", label: "City", ok: Boolean(form.city.trim()), msg: "Add a city." },
    { key: "country", label: "Country", ok: Boolean(form.country), msg: "Select a country." },
    { key: "contactEmail", label: "Contact email", ok: EMAIL_RE.test(form.contactEmail.trim()), msg: form.contactEmail.trim() ? "That doesn't look like a valid email address." : "Add a contact email." },
    ...(words(form.about) > ABOUT_MAX_WORDS ? [{ key: "about", label: "About the conference", ok: false, msg: `Shorten it to ${ABOUT_MAX_WORDS.toLocaleString()} words — it's ${words(form.about).toLocaleString()}.` }] : []),
  ];
  const missing = checks.filter((c) => !c.ok);
  const done = checks.length - missing.length;
  const canCreate = missing.length === 0 && policy;
  const invalid = (k: string) => showErrors && missing.some((c) => c.key === k);
  const msg = (k: string) => invalid(k) && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {checks.find((c) => c.key === k)?.msg}</p>;
  const cls = (k: string) => fieldCls(invalid(k));
  const focus = (k: string) => { const el = document.getElementById(`cc-${k}`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); };
  const label = (text: string, k?: string, required?: boolean) => <label htmlFor={k ? `cc-${k}` : undefined} className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{text}{required && <span className="text-danger"> *</span>}</label>;
  const hint = (t: string) => <p className="mt-1.5 text-xs text-ink-faint">{t}</p>;
  const choice = (on: boolean, k?: string) => ({ border: `1.5px solid ${on ? "var(--primary)" : k && invalid(k) ? "var(--danger)" : "var(--border)"}`, background: on ? "var(--primary-soft)" : "#fff" });

  const submit = async () => {
    if (!canCreate) { setShowErrors(true); focus(missing.length ? missing[0].key : "policy"); return; }
    if (saving) return;
    setSaving(true); setError("");
    try {
      const webPage = /^https?:\/\//i.test(form.webPage.trim()) ? form.webPage.trim() : `https://${form.webPage.trim()}`;
      const { id } = await (await getConferenceRequestService()).create({ ...form, webPage });
      void sendActionEmails("conference_requested", { conferenceId: id });
      // The request exists now, so the unfinished draft has done its job (cleared only after a successful create).
      clearDraft();
      router.push("/my-requests");
    } catch (e) {
      setError(e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");
    } finally { setSaving(false); }
  };

  const section = (id: "basics" | "location", n: number, children: ReactNode) => {
    const ok = checks.filter((c) => (id === "basics" ? !["eventType", "city", "country", "contactEmail"].includes(c.key) : ["eventType", "city", "country", "contactEmail"].includes(c.key))).every((c) => c.ok);
    const meta = SECTIONS[id];
    return (
      <section id={`cc-section-${id}`} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
        <div className="flex min-w-0 items-start gap-3 text-left">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold", ok ? "bg-success-soft text-success" : "bg-primary-soft text-primary")}>{ok ? <Check size={16} aria-hidden="true" /> : n}</div>
          <div className="min-w-0"><h2 className="flex items-center gap-2 text-base font-bold leading-snug text-navy">{meta.title}</h2><p className="mt-0.5 text-xs text-ink-faint">{meta.subtitle}</p></div>
        </div>
        <div className="mt-5"><div className="space-y-4">{children}</div></div>
      </section>
    );
  };

  const typeMeta = TYPES.find((t) => t.id === form.type);
  const formatMeta = FORMATS.find((f) => f.id === form.eventType);
  const location = form.eventType === "virtual" ? ["Online", form.city, form.country].filter(Boolean).join(" · ") : [form.venue, form.city, form.country].filter(Boolean).join(", ");
  const days = form.startDate && form.endDate ? Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1 : 0;
  const PreviewIcon = typeMeta?.Icon ?? Building2;
  const aboutWords = words(form.about);
  const suggestedAcronym = suggestAcronym(form.title, form.startDate);
  const subareas = RESEARCH_SUBAREAS[form.primaryArea] || [];
  const submitLabel = live ? (saving ? "Sending…" : "Send for approval") : "Create Conference";
  const hintLine = missing.length ? `${missing.length} required field${missing.length > 1 ? "s" : ""} left` : !policy ? "Confirm the conference policy to continue" : live ? "All set — the Smartconferu team approves it, then it appears under My Conferences." : "All set — you'll land on your Conference Profile next.";

  // The emails this request sends (sample mode only; see TriggeredEmailNote). Typed values are escaped: the preview renders the body as HTML.
  const emailName = form.acronym.trim() || form.title.trim() || "your conference";
  const emailConf = { name: form.title.trim() || "your conference", acronym: form.acronym.trim() };
  const chairTo = form.contactEmail.trim() ? `Conference Chair <${form.contactEmail.trim()}>` : "You (Conference Chair)";
  const dates = form.startDate || form.endDate ? `${form.startDate ? showDate(form.startDate) : "?"} – ${form.endDate ? showDate(form.endDate) : "?"}` : "Not set";
  const details = ([
    ["Title", form.title.trim()], ["Acronym", form.acronym.trim()], ["Type", typeMeta?.label], ["Format", formatMeta?.label], ["Dates", dates],
    ["Area", [form.primaryArea, form.secondaryArea].filter(Boolean).join(" › ")], ["Location", location], ["Website", form.webPage.trim()], ["Contact email", form.contactEmail.trim()],
  ] as Array<[string, string | undefined]>).map(([k, v]) => `<b>${k}:</b> ${esc(v || "Not set")}`).join("<br>");

  return (
    <div onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (!(fill.status === "loading")) void submit(); } }}>
      {/* One centred column for the heading, the form and the right rail, so they all line up. */}
      <div className="px-4 pt-6 sm:px-8 sm:pt-8">
        <div className="mx-auto max-w-[1200px]">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 max-w-3xl">
              <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1 text-[13px] font-medium text-ink-muted">
                {/* With unsaved changes the breadcrumb asks before leaving (the prototype's `leave`); otherwise it is a normal link. */}
                <Link href="/dashboard" onClick={(e) => { if (isDirty) { e.preventDefault(); setConfirmLeave(true); } }} className="cursor-pointer underline-offset-2 transition-colors hover:text-primary hover:underline">Conferences</Link>
                <ChevronRight size={12} aria-hidden="true" className="shrink-0" />
                <span className="text-ink-soft">Create New Conference</span>
              </nav>
              <h1 style={{ letterSpacing: "-0.02em" }} className="text-[24px] font-extrabold leading-tight text-navy sm:text-[28px]">Create New Conference</h1>
              <p className="mt-1.5 text-sm text-ink-muted">Takes about 2 minutes. Only fields marked <span className="text-danger">*</span> are required — topics, committees and branding come later on your Conference Profile.</p>
            </div>
            {isDirty && (
              <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-canvas">
                <Eraser size={14} aria-hidden="true" /> Clear form
              </button>
            )}
          </header>
        </div>
      </div>
      {/* Smart Fill reads the website for a while: the shared full-screen loader covers the page, and the form behind it is inert (nothing can be typed) until the answer is in. */}
      <LoadingOverlay open={fill.status === "loading"} label="Reading your website…" hint="We're filling in the conference details from your website. This can take up to a minute — please don't close or refresh the page." />
      <div inert={fill.status === "loading"} className="px-4 pb-8 sm:px-8">
        <div className="mx-auto grid max-w-[1200px] items-start gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-8 xl:gap-8">
          <div className="min-w-0 space-y-5">
            {/* Typing into the blank form counts as "start fresh": the new work becomes the draft. */}
            {draftOffer && !isDirty && (
              <div style={{ border: "1px solid var(--primary-soft-border)" }} className="flex flex-wrap items-center gap-4 rounded-2xl bg-primary-soft px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary"><History size={17} aria-hidden="true" /></div>
                <div className="min-w-[12rem] flex-1">
                  <div className="text-sm font-bold text-navy">Continue your draft{draftOffer.form.acronym || draftOffer.form.title ? ` — ${draftOffer.form.acronym || draftOffer.form.title}` : ""}?</div>
                  <p className="mt-0.5 text-xs text-ink-muted">You started this {draftAge(draftOffer.savedAt)} and didn&apos;t finish. Pick up where you left off.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={discardDraft} className="h-9 cursor-pointer rounded-xl px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-white">Start fresh</button>
                  <button type="button" onClick={restoreDraft} className={cn("h-9 cursor-pointer rounded-xl bg-primary px-4 text-xs font-bold text-white", BTN_FX)}>Continue draft</button>
                </div>
              </div>
            )}

            {section("basics", 1, (
              <>
                <div>
                  {label("What are you creating?")}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {TYPES.map((t) => { const on = form.type === t.id; return (
                      <button key={t.id} type="button" aria-pressed={on} title={t.desc} onClick={() => set("type", t.id)} style={choice(on)} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors">
                        <t.Icon size={15} aria-hidden="true" className={cn("shrink-0", on ? "text-primary" : "text-ink-faint")} />
                        <span className={cn("text-xs font-semibold leading-tight", on ? "text-primary" : "text-ink")}>{t.label}</span>
                      </button>
                    ); })}
                  </div>
                  {typeMeta && hint(typeMeta.desc)}
                </div>
                {form.type === "other" && <div>{label("Type information", "typeInfo", true)}<input id="cc-typeInfo" value={form.typeInfo} onChange={(e) => set("typeInfo", e.target.value)} placeholder="Briefly describe what kind of installation this is" className={cls("typeInfo")} />{msg("typeInfo")}</div>}
                <div>
                  {label("Website", "webPage", true)}
                  <div className="relative">
                    <input id="cc-webPage" type="url" value={form.webPage} onChange={(e) => set("webPage", e.target.value)} placeholder="https://yourconference.org" className={cn(cls("webPage"), "pr-10")} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true"><Sparkles size={16} className={SMART_FILL_AVAILABLE ? "text-primary" : "text-line-strong"} /></span>
                  </div>
                  {msg("webPage") || hint("Your conference's own website.")}
                  {SMART_FILL_AVAILABLE && (
                    <div className="mt-2">
                      <button type="button" onClick={() => void smartFill()} disabled={fill.status === "loading"} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60">
                        {fill.status === "loading" ? <Spinner size={13} tone="current" /> : <Sparkles size={13} aria-hidden="true" />} {fill.status === "loading" ? "Reading the website…" : "Fill the form from this website"}
                      </button>
                      {fill.message && <p role={fill.status === "error" ? "alert" : "status"} className={cn("mt-1.5 text-xs", fill.status === "error" ? "font-semibold text-danger" : "text-ink-muted")}>{fill.message}</p>}
                    </div>
                  )}
                </div>
                <div>{label("Conference title", "title", true)}<input id="cc-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. International Conference on Information Systems for Business Management" className={cls("title")} />{msg("title")}</div>
                <div className="grid items-start gap-4 sm:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="min-w-0">{label("Acronym", "acronym", true)}<input id="cc-acronym" value={form.acronym} onChange={(e) => set("acronym", e.target.value)} placeholder="e.g. ISBM 2026" className={cls("acronym")} />{msg("acronym")}
                    {!form.acronym.trim() && suggestedAcronym && (
                      <button type="button" onClick={() => set("acronym", suggestedAcronym)} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary transition-opacity hover:opacity-80">
                        <Sparkles size={12} aria-hidden="true" /> Use “{suggestedAcronym}”
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                    {label("Timezone", "timezone")}
                    <TimezoneSelect id="cc-timezone" value={form.timezone} onChange={(v) => { set("timezone", v); setTzAuto(false); }} className={cls("timezone")} />
                    {tzAuto && form.timezone && <p className="mt-1.5 flex items-center gap-1 text-xs text-primary"><Sparkles size={12} aria-hidden="true" /> Set from {form.country} — change it if your sessions run on a different clock.</p>}
                  </div>
                </div>
                <div>
                  <div className="flex items-end justify-between gap-2">{label("Conference dates", "endDate", true)}{days > 0 && <span className="mb-1.5 text-xs font-semibold text-primary">{days} day{days > 1 ? "s" : ""}</span>}</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Starts</span>
                      {/* Picking a start date fills an empty (or earlier) end date, so one-day events take one click. */}
                      <input id="cc-startDate" type="date" aria-label="Start date" value={form.startDate} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, startDate: v, endDate: v && (!f.endDate || f.endDate < v) ? v : f.endDate })); }} className={cls("startDate")} />
                    </div>
                    <div>
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Ends</span>
                      <input id="cc-endDate" type="date" aria-label="End date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} className={cls("endDate")} />
                    </div>
                  </div>
                  {msg("endDate")}
                </div>
                <div>
                  {label("About the conference", "about")}
                  <textarea id="cc-about" rows={8} maxLength={ABOUT_MAX_CHARS} value={form.about} onChange={(e) => set("about", e.target.value)} placeholder="Scope, audience, what makes it worth submitting to. This appears on your public conference page." className={cn(cls("about"), "resize-y")} />
                  {msg("about")}
                  <p aria-live="polite" className={cn("mt-1.5 text-right text-xs", aboutWords > ABOUT_MAX_WORDS ? "font-semibold text-danger" : "text-ink-faint")}>
                    {aboutWords > ABOUT_MAX_WORDS && `${(aboutWords - ABOUT_MAX_WORDS).toLocaleString()} over the limit · `}
                    {aboutWords.toLocaleString()} / {ABOUT_MAX_WORDS.toLocaleString()} words
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    {label("Primary area", "primaryArea", true)}
                    <div className="relative">
                      <select id="cc-primaryArea" value={form.primaryArea} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, primaryArea: v, secondaryArea: (RESEARCH_SUBAREAS[v] || []).includes(f.secondaryArea) ? f.secondaryArea : "" })); }} style={{ color: form.primaryArea ? "var(--ink)" : "var(--ink-faint)" }} className={cn(cls("primaryArea"), "cursor-pointer appearance-none pr-9")}>
                        <option value="">Select a primary area</option>
                        {RESEARCH_AREA_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.areas.map((a) => <option key={a} value={a}>{a}</option>)}</optgroup>)}
                      </select>
                      <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                    </div>
                    {msg("primaryArea")}
                  </div>
                  <div>
                    {label("Secondary area", "secondaryArea", true)}
                    <div className="relative">
                      {/* Options follow the primary area; disabled until one is picked. */}
                      <select id="cc-secondaryArea" value={form.secondaryArea} disabled={!form.primaryArea} onChange={(e) => set("secondaryArea", e.target.value)} style={{ color: form.secondaryArea ? "var(--ink)" : "var(--ink-faint)" }} className={cn(cls("secondaryArea"), "cursor-pointer appearance-none pr-9 disabled:cursor-not-allowed disabled:bg-canvas")}>
                        <option value="">{form.primaryArea ? `Select a ${form.primaryArea} area` : "Pick a primary area first"}</option>
                        {subareas.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                    </div>
                    {msg("secondaryArea")}
                  </div>
                </div>
              </>
            ))}
            {section("location", 2, (
              <>
                <div>
                  {label("Event format", "eventType", true)}
                  <div id="cc-eventType" tabIndex={-1} className="grid grid-cols-1 gap-2 outline-none sm:grid-cols-3">
                    {FORMATS.map((f) => { const on = form.eventType === f.id; return (
                      <button key={f.id} type="button" aria-pressed={on} onClick={() => set("eventType", f.id)} style={choice(on, "eventType")} className="flex cursor-pointer items-start gap-2.5 rounded-xl p-3 text-left transition-colors">
                        <f.Icon size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", on ? "text-primary" : "text-ink-faint")} />
                        <span><span className={cn("block text-sm font-semibold", on ? "text-primary" : "text-ink")}>{f.label}</span><span className="mt-0.5 block text-xs text-ink-faint">{f.desc}</span></span>
                      </button>
                    ); })}
                  </div>
                  {msg("eventType")}
                </div>
                {/* As in the prototype: the venue controls appear only once a format other than Virtual has been chosen. */}
                {form.eventType && form.eventType !== "virtual" && (
                  <>
                    <div>{label("Venue", "venue")}<VenueSearchInput id="cc-venue" value={form.venue} onChange={(v) => set("venue", v)} onPick={(p) => pickPlace({ venue: p.venue, address: p.address, city: p.city, state: p.state, country: p.country, postalCode: p.postalCode })} placeholder="e.g. India Habitat Centre" className={cls("venue")} /></div>
                    <div>
                      {label("Venue address")}
                      <VenueMapPicker initialAddress={form.address} venue={form.venue} city={form.city} country={form.country} onLocationChange={(l) => pickPlace({ address: l.address, city: l.city, state: l.state, country: l.country, postalCode: l.postalCode })} />
                    </div>
                  </>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>{label(form.eventType === "virtual" ? "Organizer city" : "City", "city", true)}<input id="cc-city" value={form.city} onChange={(e) => set("city", e.target.value)} className={cls("city")} />{msg("city")}</div>
                  <div>
                    {label("Country / region", "country", true)}
                    {/* The wrapper carries the id so the checklist / Create button can scroll to it. */}
                    <div id="cc-country" tabIndex={-1} className="outline-none">
                      <CountrySelect value={form.country} onChange={setCountry} placeholder="Search or select a country" ariaLabel="Country / region" className={cn(cls("country"))} />
                    </div>
                    {msg("country")}
                  </div>
                  {form.eventType !== "virtual" && (
                    <>
                      <div>{label("State / province", "state")}<input id="cc-state" value={form.state} onChange={(e) => set("state", e.target.value)} className={cls("state")} /></div>
                      <div>{label("Postal / ZIP code", "postalCode")}<input id="cc-postalCode" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={cls("postalCode")} /></div>
                    </>
                  )}
                </div>
                <div>
                  {label("Contact email", "contactEmail", true)}
                  <input id="cc-contactEmail" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="info@yourconference.org" className={cls("contactEmail")} />
                  {msg("contactEmail") || hint("Shown publicly on your conference page.")}
                </div>
              </>
            ))}
            <label id="cc-policy" tabIndex={-1} style={{ border: `1px solid ${showErrors && !policy ? "var(--danger)" : "var(--border)"}` }} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-5 py-4 outline-none">
              <input type="checkbox" checked={policy} onChange={(e) => setPolicy(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--primary)]" />
              <span className="text-xs leading-relaxed text-ink-soft">I confirm that I have read and understood the Smartconferu Conference Policy, and have informed, or will inform, the relevant conference organizers about this policy.</span>
            </label>
            {SAMPLE_UI ? (
              // Email flow for a new conference: the Super Admin is notified now; the chair hears back once the Super Admin approves or declines.
              <div style={{ border: "1px solid var(--border)" }} className="rounded-2xl bg-white p-5">
                <div className="text-sm font-bold text-navy">Emails this triggers</div>
                <p className="mt-0.5 text-xs text-ink-faint">Your conference request goes to the Super Admin for approval — you&apos;re emailed with their decision.</p>
                <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">1</span>When you click Create</div>
                <TriggeredEmailNote
                  conference={emailConf} className="mt-2"
                  emails={[
                    { label: "New conference request", sendType: "auto", to: "Super Admin <admin@smartconferu.com>", subject: `New conference request: ${emailName} — review & approve`,
                      body: `<p>Hello Super Admin,</p><p>A new conference has been requested on Smartconferu and is waiting for your approval.</p><p>${details}</p><p>Review it under <b>Admin › Conference Requests</b>, then approve or decline. The chair is emailed automatically with your decision.</p><p>— Smartconferu</p>` },
                    { key: "conferenceCreated", to: chairTo },
                  ]}
                />
                <div className="mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">2</span>After the Super Admin decides — one of these goes to you</div>
                <TriggeredEmailNote compact conference={emailConf} emails={[{ label: "Conference Approved", to: chairTo, subject: `${emailName} is approved — you're all set`,
                  body: `<p>Dear {{first_name}},</p><p>Good news — your conference <b>${esc(emailName)}</b> has been approved by the Smartconferu team and is now live.</p><p>Next, finish your Conference Profile (topics, tracks, committees) and publish your Call for Papers so authors can start submitting.</p><p>Best regards,<br>The Smartconferu Team</p>` }]} />
                <TriggeredEmailNote compact conference={emailConf} emails={[{ label: "Conference Declined", to: chairTo, subject: `Update on your conference request: ${emailName}`,
                  body: `<p>Dear {{first_name}},</p><p>Thank you for requesting <b>${esc(emailName)}</b> on Smartconferu. After review, the request has not been approved.</p><p>The reason from our team is shown under <b>My Conference Requests</b>, where you can reply, update the details and resubmit.</p><p>Best regards,<br>The Smartconferu Team</p>` }]} />
              </div>
            ) : (
              <div style={{ border: "1px solid var(--border)" }} className="rounded-2xl bg-white p-5 text-xs text-ink-muted">
                <div className="text-sm font-bold text-navy">What happens next</div>
                <p className="mt-1">Your request goes to the Smartconferu team for approval. They are emailed when you click Create, and you are emailed their decision. You can follow it under <b>My Requests</b>.</p>
              </div>
            )}
          </div>
          <aside className="sticky top-24 hidden space-y-4 lg:block">
            <div style={CARD} className="ui-accent-card rounded-2xl bg-white p-5">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Live preview</div>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><PreviewIcon size={18} aria-hidden="true" /></div>
                <div className="min-w-0"><div className={cn("line-clamp-2 text-sm font-bold leading-snug", form.title ? "text-navy" : "text-line-strong")}>{form.title || "Your conference title"}</div><div className="mt-0.5 truncate text-xs text-ink-faint">{[form.acronym || "ACRONYM", typeMeta?.label, formatMeta?.label].filter(Boolean).join(" · ")}</div></div>
              </div>
              {form.about && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-ink-soft">{form.about}</p>}
              {form.primaryArea && <p className="mt-2 truncate text-xs text-ink-faint">{[form.primaryArea, form.secondaryArea].filter(Boolean).join(" › ")}</p>}
              <div className="mt-4 space-y-2 border-t border-muted pt-3">
                {([[Calendar, form.startDate || form.endDate ? `${showDate(form.startDate)} – ${showDate(form.endDate)}` : "", "Dates not set"], [form.eventType === "virtual" ? Globe2 : MapPin, location, "Location not set"], [Mail, form.contactEmail.trim(), "No contact email"]] as Array<[LucideIcon, string, string]>).map(([Icon, value, empty], i) => (
                  <div key={i} className="flex min-w-0 items-center gap-2 text-xs"><Icon size={13} className="shrink-0 text-ink-faint" aria-hidden="true" /><span className={cn("truncate", value ? "text-ink-soft" : "text-line-strong")}>{value || empty}</span></div>
                ))}
              </div>
            </div>
            <div style={CARD} className="rounded-2xl bg-white p-5">
              <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-navy">Required to create</span><span className={cn("text-xs font-bold", missing.length ? "text-ink-muted" : "text-success")}>{done}/{checks.length}</span></div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"><div style={{ width: `${(done / checks.length) * 100}%` }} className={cn("h-full rounded-full transition-all duration-300", missing.length ? "bg-primary" : "bg-success")} /></div>
              <ul className="space-y-0.5">
                {checks.map((c) => (
                  <li key={c.key}><button type="button" onClick={() => focus(c.key)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-canvas"><span style={c.ok ? undefined : { border: `1.5px solid ${invalid(c.key) ? "var(--danger)" : "var(--border-strong)"}` }} className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", c.ok && "bg-success text-white")}>{c.ok && <Check size={10} strokeWidth={3} aria-hidden="true" />}</span><span className={cn("text-xs font-medium", c.ok ? "text-ink-faint" : invalid(c.key) ? "text-danger" : "text-ink-soft")}>{c.label}</span></button></li>
                ))}
              </ul>
              <button type="button" onClick={() => void submit()} disabled={!canCreate || saving} title={canCreate ? undefined : "Fill in the required fields listed above first"} className={cn("mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition-colors enabled:hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50", canCreate && BTN_FX)}>
                {saving && <Spinner size={15} tone="current" />}{submitLabel}
                <kbd className="rounded bg-white/[0.18] px-1.5 py-0.5 font-sans text-[10px] font-semibold">{isMac ? "⌘" : "Ctrl"} ↵</kbd>
              </button>
              {error && <p role="alert" className="mt-2 text-xs font-medium text-danger">{error}</p>}
              <button type="button" onClick={leave} className="mt-2 h-9 w-full cursor-pointer rounded-xl text-xs font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-faint">{hintLine}</p>
            </div>
          </aside>
        </div>
        {/* Mobile / tablet action bar */}
        <div style={{ borderTop: "1px solid var(--border)", boxShadow: "0 -4px 16px rgba(15,23,42,0.06)" }} className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 bg-white px-4 py-3 lg:hidden">
          <div className="min-w-0 flex-1"><div className="text-xs font-bold text-ink">{done}/{checks.length} required</div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div style={{ width: `${(done / checks.length) * 100}%` }} className={cn("h-full rounded-full transition-all duration-300", missing.length ? "bg-primary" : "bg-success")} /></div></div>
          <button type="button" onClick={() => void submit()} disabled={!canCreate || saving} className="h-10 shrink-0 cursor-pointer rounded-xl bg-primary px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitLabel}</button>
          {error && <p role="alert" className="max-w-[10rem] text-[11px] font-medium text-danger">{error}</p>}
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear the form?"
          message="Everything you've entered (and the saved draft) will be removed. This can't be undone."
          confirmLabel="Clear form"
          onConfirm={clearForm}
          onClose={() => setConfirmClear(false)}
        />
      )}

      {confirmLeave && (
        <Modal
          title="Leave without creating?" subtitle="Your conference hasn't been created yet." icon={AlertTriangle} onClose={() => setConfirmLeave(false)} maxWidth="max-w-md"
          actions={(
            <>
              <button type="button" onClick={() => { clearDraft(); router.push("/dashboard"); }} className="mr-auto h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft">Discard draft</button>
              <button type="button" onClick={() => setConfirmLeave(false)} className="h-10 cursor-pointer rounded-xl border-[1.5px] border-line px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-canvas">Keep editing</button>
              <button type="button" onClick={() => router.push("/dashboard")} className={cn("h-10 cursor-pointer rounded-xl bg-primary px-4 text-sm font-bold text-white", BTN_FX)}>Leave, keep draft</button>
            </>
          )}
        >
          <p className="text-sm leading-relaxed text-ink-soft">Your progress is saved as a draft in this browser — you can pick up where you left off next time you open Create Conference.</p>
        </Modal>
      )}
    </div>
  );
}
