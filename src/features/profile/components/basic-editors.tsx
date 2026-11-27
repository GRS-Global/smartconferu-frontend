"use client";

import { useMasterDataVersion } from "@/lib/master-data";
import { Building2, ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { useState } from "react";
import { Field, INPUT_CLASS } from "@/components/ui/field";
import { COUNTRIES } from "@/lib/country-codes";
import { RESEARCH_AREA_GROUPS, RESEARCH_SUBAREAS } from "@/lib/research-areas";
import { GENDER_OPTIONS, NOTIFY_CHANNELS, PROFILE_BIO_MAX, PROFILE_INTERESTS_MAX } from "../fields";
import { VerifyStatus } from "../showcase/parts";
import { findListName, PROFILE_OTHER } from "../entries";
import { useSectionSave } from "../use-section-save";
import { validateProfileForm } from "../validation";
import { ListMatch, OtherBox, PendingNote } from "./editor-parts";
import type { EditorProps } from "./editor-types";
import { PhoneField } from "./phone-field";
import { SectionCard } from "./section-card";
import { PHONE_VERIFICATION_ENABLED, SMS_ALERTS_ENABLED } from "@/lib/config";

const ALL_AREAS = RESEARCH_AREA_GROUPS.flatMap((g) => g.areas);

/* ---------- Edit intro ---------- */
export function IntroEditor({ profile, save, onDone, onCancel, onManageAffiliation }: EditorProps & { onManageAffiliation: () => void }) {
  const [d, setD] = useState({ firstName: profile.firstName, lastName: profile.lastName, designation: profile.designation, gender: profile.gender, country: profile.country, webPage: profile.webPage, city: profile.city, state: profile.state });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const state = useSectionSave();
  const set = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }));
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const problems = validateProfileForm({ ...d, mainEmail: profile.mainEmail, affiliation: profile.affiliation || "x", phone: "" });
  const missing = (["firstName", "lastName", "designation", "gender", "country"] as const).some((k) => !d[k].trim());
  const errorOf = (k: keyof typeof problems) => (touched[k] ? problems[k] : undefined);
  const dirty = (Object.keys(d) as Array<keyof typeof d>).some((k) => d[k] !== profile[k]);
  const canSave = !missing && !problems.webPage && dirty;
  return (
    <SectionCard
      inDialog id="general" title="Edit intro" description="Your name, role and how people can reach you." save={state} canSave={canSave} onCancel={onCancel}
      onSave={() => void state.run(async () => { await save({ ...d, firstName: d.firstName.trim(), lastName: d.lastName.trim(), designation: d.designation.trim(), webPage: d.webPage.trim(), city: d.city.trim(), state: d.state.trim() }); }).then((ok) => ok && onDone())}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="profile-first" required error={errorOf("firstName")}><input id="profile-first" autoComplete="given-name" value={d.firstName} onChange={(e) => set("firstName")(e.target.value)} onBlur={touch("firstName")} aria-invalid={Boolean(errorOf("firstName")) || undefined} aria-describedby={errorOf("firstName") ? "profile-first-error" : undefined} className={INPUT_CLASS} /></Field>
        <Field label="Last name" htmlFor="profile-last" required error={errorOf("lastName")}><input id="profile-last" autoComplete="family-name" value={d.lastName} onChange={(e) => set("lastName")(e.target.value)} onBlur={touch("lastName")} aria-invalid={Boolean(errorOf("lastName")) || undefined} aria-describedby={errorOf("lastName") ? "profile-last-error" : undefined} className={INPUT_CLASS} /></Field>
        <Field className="sm:col-span-2" label="Designation" htmlFor="profile-designation" required error={errorOf("designation")}><input id="profile-designation" value={d.designation} placeholder="e.g. Associate Professor, Research Scholar" onChange={(e) => set("designation")(e.target.value)} onBlur={touch("designation")} aria-invalid={Boolean(errorOf("designation")) || undefined} aria-describedby={errorOf("designation") ? "profile-designation-error" : undefined} className={INPUT_CLASS} /></Field>
        <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3.5 py-3 sm:col-span-2">
          <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink-muted"><Building2 size={20} strokeWidth={1.8} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-navy">Affiliation: {profile.affiliation || "not set"}</div>
            <div className="mt-0.5 text-[13px] text-ink-muted">Your primary affiliation — it&apos;s what shows under your name.</div>
          </div>
          <button type="button" onClick={onManageAffiliation} className="shrink-0 px-1 py-1.5 text-[13px] font-semibold text-primary hover:underline">Manage</button>
        </div>
        <div className="pt-1.5 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted sm:col-span-2">Personal</div>
        <Field label="Gender" htmlFor="profile-gender" required error={errorOf("gender")}>
          <select id="profile-gender" value={d.gender} onChange={(e) => set("gender")(e.target.value)} onBlur={touch("gender")} className={INPUT_CLASS}>
            <option value="" disabled>Select gender</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Country" htmlFor="profile-country" required error={errorOf("country")}>
          <select id="profile-country" autoComplete="country-name" value={d.country} onChange={(e) => set("country")(e.target.value)} onBlur={touch("country")} className={INPUT_CLASS}>
            <option value="" disabled>Select a country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field className="sm:col-span-2" label="Website" htmlFor="profile-web" error={errorOf("webPage")}><input id="profile-web" type="text" inputMode="url" autoComplete="url" value={d.webPage} placeholder="https://" onChange={(e) => set("webPage")(e.target.value)} onBlur={touch("webPage")} aria-invalid={Boolean(errorOf("webPage")) || undefined} aria-describedby={errorOf("webPage") ? "profile-web-error" : undefined} className={INPUT_CLASS} /></Field>
        <Field label="City" htmlFor="profile-city"><input id="profile-city" autoComplete="address-level2" value={d.city} onChange={(e) => set("city")(e.target.value)} className={INPUT_CLASS} /></Field>
        <Field label="State / Region" htmlFor="profile-state"><input id="profile-state" autoComplete="address-level1" value={d.state} onChange={(e) => set("state")(e.target.value)} className={INPUT_CLASS} /></Field>
      </div>
      {missing && <p role="alert" className="text-[13px] font-medium text-danger-ink">Name, designation, gender and country can&apos;t be empty.</p>}
    </SectionCard>
  );
}

/* ---------- About: bio, primary / secondary subject, interests ---------- */
interface AreaState { primary: string; secondary: string[]; primaryPending: boolean; pendingSecondary: string[] }

/** One primary and one secondary area, each a dropdown; the secondary list follows the primary. "Other" is used straight away but marked pending. */
function ResearchAreaFields({ value, onChange }: { value: AreaState; onChange: (v: AreaState) => void }) {
  useMasterDataVersion(); // render again when the Super Admin's lists arrive from the backend
  const { primary, secondary, primaryPending, pendingSecondary } = value;
  const sub = secondary[0] || "";
  const primaryListed = ALL_AREAS.includes(primary);
  const primaryOther = primaryPending || (Boolean(primary) && !primaryListed);
  const subs = primaryListed ? RESEARCH_SUBAREAS[primary] ?? [] : [];
  const subListed = subs.includes(sub);
  const subOther = pendingSecondary.includes(sub) || (Boolean(sub) && !subListed) || (pendingSecondary.length > 0 && !sub);
  const emit = (p: string, s: string, extra: Partial<AreaState> = {}) => onChange({ primary: p, secondary: s ? [s] : [], primaryPending: primaryOther, pendingSecondary: s && subOther ? [s] : [], ...extra });

  const pickPrimary = (v: string) => {
    const keep = v !== PROFILE_OTHER && (RESEARCH_SUBAREAS[v] ?? []).includes(sub) ? sub : "";
    if (v === PROFILE_OTHER) emit(primaryListed ? "" : primary, "", { primaryPending: true, pendingSecondary: [] });
    else emit(v, keep, { primaryPending: false, pendingSecondary: [] });
  };
  const pickSub = (v: string) => {
    if (v === PROFILE_OTHER) onChange({ primary, secondary: subListed ? [] : secondary, primaryPending: primaryOther, pendingSecondary: [subListed ? "" : sub] });
    else emit(primary, v, { pendingSecondary: [] });
  };
  const typeSub = (v: string) => onChange({ primary, secondary: v ? [v] : [], primaryPending: primaryOther, pendingSecondary: [v] });
  const subMatch = subOther && sub ? findListName(subs, sub) : null;
  const primaryMatch = primaryOther && primary ? findListName(ALL_AREAS, primary) : null;

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Primary subject" htmlFor="profile-primary-area">
        <select id="profile-primary-area" value={primaryOther ? PROFILE_OTHER : primary} onChange={(e) => pickPrimary(e.target.value)} className={INPUT_CLASS}>
          <option value="">Pick your main field</option>
          {RESEARCH_AREA_GROUPS.map((g) => <optgroup key={g.label} label={g.label}>{g.areas.map((a) => <option key={a} value={a}>{a}</option>)}</optgroup>)}
          <option value={PROFILE_OTHER}>Other — not in the list</option>
        </select>
      </Field>
      {primaryOther && (
        <OtherBox>
          <Field label="Primary subject name" htmlFor="profile-primary-other"><input id="profile-primary-other" value={primary} placeholder="e.g. Maritime Studies" onChange={(e) => emit(e.target.value, sub, { primaryPending: true })} className={INPUT_CLASS} /></Field>
          {primaryMatch && <ListMatch match={primaryMatch} onUse={() => pickPrimary(primaryMatch)} />}
          <PendingNote>Our team checks new subjects and adds them to the list. Until then it shows as “Pending review” to you.</PendingNote>
        </OtherBox>
      )}
      <Field label={`Secondary subject${primary ? ` (within ${primary})` : ""}`} htmlFor="profile-secondary-area">
        <select id="profile-secondary-area" value={subOther ? PROFILE_OTHER : sub} onChange={(e) => pickSub(e.target.value)} disabled={!primary} className={INPUT_CLASS}>
          <option value="">{primary ? "Pick a sub-field (optional)" : "Pick a primary subject first"}</option>
          {subs.map((x) => <option key={x} value={x}>{x}</option>)}
          {primary && <option value={PROFILE_OTHER}>Other — not in the list</option>}
        </select>
      </Field>
      {primary && subOther && (
        <OtherBox>
          <Field label="Secondary subject name" htmlFor="profile-secondary-other"><input id="profile-secondary-other" value={sub} placeholder="e.g. Quantum Machine Learning" onChange={(e) => typeSub(e.target.value)} className={INPUT_CLASS} /></Field>
          {subMatch && <ListMatch match={subMatch} onUse={() => pickSub(subMatch)} />}
          <PendingNote>Our team checks new subjects and adds them to the list. Until then it shows as “Pending review” to you.</PendingNote>
        </OtherBox>
      )}
    </div>
  );
}

export function AboutEditor({ profile, save, onDone, onCancel }: EditorProps) {
  const [bio, setBio] = useState(profile.bio);
  const [areas, setAreas] = useState<AreaState>({ primary: profile.primaryArea, secondary: profile.secondaryAreas.slice(0, 1), primaryPending: profile.primaryAreaPending, pendingSecondary: profile.pendingSecondaryAreas });
  const [interests, setInterests] = useState(profile.researchInterests);
  const [draft, setDraft] = useState("");
  const [drag, setDrag] = useState<{ from: number | null; over: number | null }>({ from: null, over: null });
  const state = useSectionSave();
  const has = (t: string) => interests.some((x) => x.toLowerCase() === t.toLowerCase());
  const add = () => {
    const v = draft.trim();
    if (v && !has(v) && interests.length < PROFILE_INTERESTS_MAX) setInterests([...interests, v]);
    setDraft("");
  };
  const move = (from: number, to: number) => setInterests((list) => {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    return next;
  });
  const pending = (draft.trim() && !has(draft.trim()) && interests.length < PROFILE_INTERESTS_MAX ? [...interests, draft.trim()] : interests);
  const dirty = bio !== profile.bio || JSON.stringify(pending) !== JSON.stringify(profile.researchInterests) || areas.primary !== profile.primaryArea
    || JSON.stringify(areas.secondary) !== JSON.stringify(profile.secondaryAreas.slice(0, 1)) || areas.primaryPending !== profile.primaryAreaPending || JSON.stringify(areas.pendingSecondary) !== JSON.stringify(profile.pendingSecondaryAreas);
  const chip = "inline-flex h-6 w-[22px] items-center justify-center rounded text-ink-muted hover:bg-line disabled:cursor-default disabled:text-line-strong disabled:hover:bg-transparent";
  return (
    <SectionCard
      inDialog id="about" title="Edit about" description="Tell organizers and reviewers what you work on." save={state} canSave={dirty} onCancel={onCancel}
      onSave={() => void state.run(() => save({
        bio: bio.trim(), primaryArea: areas.primary.trim(), secondaryAreas: areas.primary ? areas.secondary : [], researchInterests: pending,
        primaryAreaPending: Boolean(areas.primary.trim()) && areas.primaryPending,
        pendingSecondaryAreas: areas.primary ? areas.pendingSecondary.filter((x) => x && areas.secondary.includes(x)) : [],
      })).then((ok) => ok && onDone())}
    >
      <Field label="About / Bio" htmlFor="profile-bio" hint={`${bio.length} / ${PROFILE_BIO_MAX} characters`}>
        <textarea id="profile-bio" rows={5} value={bio} placeholder="A few sentences about your research focus" onChange={(e) => setBio(e.target.value.slice(0, PROFILE_BIO_MAX))} className={`${INPUT_CLASS} resize-y leading-relaxed`} />
      </Field>
      <div className="my-5 border-t border-muted" />
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.04em] text-ink-muted">Primary &amp; secondary subjects</div>
      <ResearchAreaFields value={areas} onChange={setAreas} />
      <div className="mb-2 mt-5 text-[13px] font-semibold text-[#334155]">Research interests / Expertise</div>
      <ul className="flex min-h-9 flex-wrap gap-2">
        {interests.map((t, i) => (
          <li
            key={t} draggable title="Drag to reorder"
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDrag({ from: i, over: null }); }}
            onDragOver={(e) => { e.preventDefault(); if (drag.over !== i) setDrag((s) => ({ ...s, over: i })); }}
            onDrop={(e) => { e.preventDefault(); if (drag.from !== null) move(drag.from, i); setDrag({ from: null, over: null }); }}
            onDragEnd={() => setDrag({ from: null, over: null })}
            className={`inline-flex cursor-grab items-center gap-1 rounded-md border bg-white p-1 text-sm font-medium text-[#334155] ${drag.over === i && drag.from !== null && drag.from !== i ? "border-primary" : "border-line"} ${drag.from === i ? "opacity-40" : ""}`}
          >
            <GripVertical size={12} className="text-ink-muted" aria-hidden="true" />
            {t}
            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${t} earlier`} title="Move earlier" className={chip}><ChevronLeft size={13} strokeWidth={2.2} aria-hidden="true" /></button>
            <button type="button" onClick={() => move(i, i + 1)} disabled={i === interests.length - 1} aria-label={`Move ${t} later`} title="Move later" className={chip}><ChevronRight size={13} strokeWidth={2.2} aria-hidden="true" /></button>
            <button type="button" onClick={() => setInterests(interests.filter((_, j) => j !== i))} aria-label={`Remove ${t}`} className={chip}><X size={13} strokeWidth={2.2} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <label htmlFor="profile-interest" className="mt-4 block text-[13px] font-medium text-ink-soft">Add an interest</label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="profile-interest" value={draft} disabled={interests.length >= PROFILE_INTERESTS_MAX} placeholder={interests.length >= PROFILE_INTERESTS_MAX ? "Limit reached" : "e.g. Peer review, Information retrieval"}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={INPUT_CLASS}
        />
        <button type="button" onClick={add} disabled={!draft.trim()} className="h-[42px] rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50">Add</button>
      </div>
      <p className="mt-2 text-[13px] text-ink-muted">Press Enter to add. Up to {PROFILE_INTERESTS_MAX} interests. Drag a chip, or use ‹ › to move it, to change the order shown on your profile.</p>
    </SectionCard>
  );
}

/* ---------- Address ---------- */
export function AddressEditor({ profile, save, onDone, onCancel }: EditorProps) {
  const [v, setV] = useState({ addressLine1: profile.addressLine1, addressLine2: profile.addressLine2, city: profile.city, postCode: profile.postCode, state: profile.state });
  const state = useSectionSave();
  const dirty = (Object.keys(v) as Array<keyof typeof v>).some((k) => v[k] !== profile[k]);
  const bind = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value })) });
  return (
    <SectionCard
      inDialog id="contact" title="Edit address" description="Private — never shown on your public profile." save={state} canSave={dirty} onCancel={onCancel}
      onSave={() => void state.run(() => save({ addressLine1: v.addressLine1.trim(), addressLine2: v.addressLine2.trim(), city: v.city.trim(), state: v.state.trim(), postCode: v.postCode.trim() })).then((ok) => ok && onDone())}
    >
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Address line 1" htmlFor="profile-addr1"><input id="profile-addr1" autoComplete="address-line1" {...bind("addressLine1")} className={INPUT_CLASS} /></Field>
        <Field className="sm:col-span-2" label="Address line 2" htmlFor="profile-addr2"><input id="profile-addr2" autoComplete="address-line2" placeholder="Apartment, suite, etc." {...bind("addressLine2")} className={INPUT_CLASS} /></Field>
        <Field label="City" htmlFor="profile-city2"><input id="profile-city2" autoComplete="address-level2" {...bind("city")} className={INPUT_CLASS} /></Field>
        <Field label="Post code" htmlFor="profile-post"><input id="profile-post" autoComplete="postal-code" {...bind("postCode")} className={INPUT_CLASS} /></Field>
        <Field className="sm:col-span-2" label="State" htmlFor="profile-state2"><input id="profile-state2" autoComplete="address-level1" {...bind("state")} className={INPUT_CLASS} /></Field>
      </div>
    </SectionCard>
  );
}

/* ---------- Mobile number ---------- */
export function PhoneEditor({ profile, save, onDone, onCancel }: EditorProps) {
  const [phone, setPhone] = useState(profile.phone);
  const [channels, setChannels] = useState(profile.notifyChannels);
  const [touched, setTouched] = useState(false);
  const state = useSectionSave();
  const national = phone.replace(/^\+\d+\s*/, "").replace(/\D/g, "");
  const problem = national && (national.length < 6 || national.length > 14) ? "Enter a valid mobile number." : "";
  const changed = phone.trim() !== profile.phone;
  const dirty = changed || (SMS_ALERTS_ENABLED && JSON.stringify([...channels].sort()) !== JSON.stringify([...profile.notifyChannels].sort()));
  const cleared = !national;
  return (
    <SectionCard
      inDialog id="phone" title="Mobile number" description={SMS_ALERTS_ENABLED ? "Optional — used for SMS or WhatsApp alerts." : "Optional — so organizers can reach you."} save={state} canSave={dirty && !problem} onCancel={onCancel}
      onSave={() => void state.run(() => save(cleared
        ? { phone: "", phoneStatus: "", notifyChannels: [] }
        // No verification code can be sent yet (PHONE_VERIFICATION_ENABLED), so a number is saved as verified; with it on, a changed number waits
        // for its code. SMS / WhatsApp alerts stay off while there is no gateway (SMS_ALERTS_ENABLED).
        : { phone: phone.trim(), phoneStatus: !PHONE_VERIFICATION_ENABLED ? "verified" : changed ? "pending" : profile.phoneStatus, notifyChannels: SMS_ALERTS_ENABLED ? channels : [] })).then((ok) => ok && onDone(cleared && profile.phone ? "Mobile number removed" : "Mobile number updated"))}
    >
      <div className="flex flex-col gap-[18px]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="phone-number" className="text-[13px] font-semibold text-ink-soft">Mobile number</label>
            {!cleared && <VerifyStatus status={!PHONE_VERIFICATION_ENABLED ? "verified" : changed ? "new" : profile.phoneStatus || "new"} />}
          </div>
          <div className="mt-1.5">
            <PhoneField bare id="phone-number" phone={phone} onPhoneChange={setPhone} onBlur={() => setTouched(true)} invalid={touched && Boolean(problem)} describedBy={touched && problem ? "phone-number-error" : undefined} inputClassName="h-[42px] w-full rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink outline-none transition-shadow placeholder:text-slate-400 focus:border-primary focus:ring-[3px] focus:ring-primary-soft" />
          </div>
          {touched && problem && <p id="phone-number-error" role="alert" className="mt-1.5 text-xs font-medium text-danger-ink">{problem}</p>}
          {PHONE_VERIFICATION_ENABLED && <p className="mt-1.5 text-xs text-ink-faint">Verifying a number by code isn&apos;t available yet, so a new number is saved as not verified.</p>}
        </div>
        {SMS_ALERTS_ENABLED && <div>
          <div className="text-[13px] font-semibold text-ink-soft">Alerts on this number</div>
          <div className="mt-1 text-[13px] text-ink-muted">Email alerts are always on.</div>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {NOTIFY_CHANNELS.map(({ key, label }) => {
              const checked = channels.includes(key);
              return (
                <label key={key} className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold text-ink ${checked ? "border-primary-soft-border bg-[#F5F7FF]" : "border-line bg-white"} ${cleared ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={checked} disabled={cleared} onChange={() => setChannels((c) => (checked ? c.filter((x) => x !== key) : [...c, key]))} className="m-0 h-4 w-4 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed" />
                  {label}
                </label>
              );
            })}
          </div>
        </div>}
      </div>
    </SectionCard>
  );
}
