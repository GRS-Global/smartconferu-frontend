"use client";

import { Briefcase, Check, Clock, ExternalLink, GraduationCap, Link2, Search, UserCheck } from "lucide-react";
import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { LinkKey, Profile, ProfilePatch } from "@/types/profile";
import { clearLinkTrust, type LinkField, normalizePastedProfile, PROFESSIONAL_FIELDS, profileLinkHref, SCHOLAR_FIELDS } from "../fields";
import { BrandIcon, PENDING_AMBER, VERIFIED_GREEN } from "../showcase/parts";
import { useSectionSave } from "../use-section-save";
import { ConfirmDialog, ConnectDialog, FindDialog, RequestDialog } from "./link-dialogs";
import { SectionCard } from "./section-card";

type Kind = "scholar" | "professional";
type Drafts = Partial<Record<LinkKey, string>>;

interface LinksEditorProps {
  profile: Profile;
  save: (patch: ProfilePatch) => Promise<Profile>;
  onDone: () => void;
  flash: (text: string) => void;
}

const todayLabel = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const CHIP = "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold";
const ACTION = "px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border-[1.5px] disabled:cursor-not-allowed";

/** My Profile › Scholar & professional profiles: every row is a box you type or paste into, with Find (search for yourself) and Connect;
 *  one Save per card writes what you changed. A link is "Confirmed by you" after you check it; only a real verification would mark it Verified. */
export function LinksEditor({ profile, save, onDone, flash }: LinksEditorProps) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [picked, setPicked] = useState<Partial<Record<LinkKey, "confirmed">>>({});
  const [findTarget, setFindTarget] = useState<LinkField | null>(null);
  const [connectTarget, setConnectTarget] = useState<LinkField | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<LinkField | null>(null);
  const [requestTarget, setRequestTarget] = useState<LinkField | null>(null);
  const [savedFlash, setSavedFlash] = useState<Kind | null>(null);
  const cardState = { scholar: useSectionSave(), professional: useSectionSave() };
  const optStates = { scholar: useSectionSave(), professional: useSectionSave() };
  const rowState = useSectionSave();

  const stored = (k: LinkKey) => profile[k];
  const isDirty = (f: LinkField) => f.key in drafts && (drafts[f.key] ?? "").trim() !== stored(f.key).trim();

  const saveSection = async (kind: Kind) => {
    const fields = kind === "scholar" ? SCHOLAR_FIELDS : PROFESSIONAL_FIELDS;
    const changed = fields.filter(isDirty);
    if (!changed.length) return;
    const values = Object.fromEntries(changed.map((f) => [f.key, normalizePastedProfile(f.key, drafts[f.key] ?? "")])) as Partial<Record<LinkKey, string>>;
    const trust = clearLinkTrust(profile, changed.map((f) => f.key));
    // A result picked from the search ("This is me") is saved as Confirmed by you; a typed or pasted one asks "Is this your … profile?" after Save.
    changed.forEach((f) => { if (values[f.key] && picked[f.key]) trust.confirmedProfiles[f.key] = true; });
    const ok = await cardState[kind].run(() => save({ ...values, ...trust } as ProfilePatch));
    if (!ok) return;
    const fresh = changed.find((f) => values[f.key] && !picked[f.key]);
    if (fresh) setConfirmTarget(fresh);
    setDrafts((d) => { const next = { ...d }; changed.forEach((f) => delete next[f.key]); return next; });
    setPicked((p) => { const next = { ...p }; changed.forEach((f) => delete next[f.key]); return next; });
    setSavedFlash(kind);
    setTimeout(() => setSavedFlash(null), 2000);
  };

  const run = async (patch: ProfilePatch, message: string) => { if (await rowState.run(() => save(patch))) flash(message); };
  const remove = (f: LinkField) => run({ [f.key]: "", ...clearLinkTrust(profile, [f.key]) } as ProfilePatch, `${f.label} removed`);
  const withdraw = (f: LinkField) => { const r = { ...profile.verificationRequests }; delete r[f.key]; return run({ verificationRequests: r }, `${f.label} verification request withdrawn`); };

  const card = (kind: Kind) => {
    const scholar = kind === "scholar";
    const fields = scholar ? SCHOLAR_FIELDS : PROFESSIONAL_FIELDS;
    const optKey = scholar ? "scholarNone" : "professionalNone";
    const noun = scholar ? "scholar" : "professional";
    const optedOut = profile[optKey];
    const addedCount = fields.filter((f) => stored(f.key).trim()).length;
    const dirtyCount = fields.filter(isDirty).length;
    const optDisabled = !optedOut && (addedCount > 0 || dirtyCount > 0);
    const state = cardState[kind];
    const optState = { state: optStates[kind] };
    const id = `links-${kind}`;
    return (
      <div key={kind} className="rounded-2xl border border-line p-5">
        <div aria-hidden="true" className="mb-1 flex items-center gap-2.5 text-[15px] font-bold text-navy">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">{scholar ? <GraduationCap size={16} /> : <Briefcase size={16} />}</span>
          {scholar ? "Scholar Profile" : "Professional Profile"}
        </div>
      <SectionCard
        inDialog keepDescription id={id} title={scholar ? "Scholar profile" : "Professional profile"}
        description={`${scholar ? "Your research identities, so organizers and reviewers can recognise your published work." : "Where people can find you professionally outside of conferences."} Add at least one, or tick the box below if you don't have any yet.`}
        save={state} canSave={dirtyCount > 0 && !optedOut} onSave={() => void saveSection(kind)}
      >
        <label className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-3", optedOut ? "border-primary bg-primary-soft" : "border-line bg-canvas", optDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
          <input type="checkbox" checked={optedOut} disabled={optDisabled || optState.state.busy} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" onChange={(e) => void optState.state.run(() => save({ [optKey]: e.target.checked }))} />
          <span>
            <span className="block text-sm font-semibold text-ink">I don&apos;t have any {noun} profile for now</span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              {addedCount > 0 ? `Remove your ${addedCount} added profile${addedCount === 1 ? "" : "s"} to use this.` : dirtyCount > 0 ? "Save your changes first." : optedOut ? "Counted as answered. Untick this whenever you want to add a profile." : "Counts as answered for your profile completeness."}
            </span>
          </span>
        </label>
        {optState.state.error && <p role="alert" className="text-[11.5px] text-danger">{optState.state.error}</p>}
        <div className={cn("space-y-1", optedOut && "opacity-45")} aria-disabled={optedOut}>
          {fields.map((f, i) => {
            const value = stored(f.key).trim();
            const draft = drafts[f.key] ?? stored(f.key);
            const verified = Boolean(value && profile.verifiedProfiles[f.key]);
            const confirmed = Boolean(profile.confirmedProfiles[f.key]);
            const request = profile.verificationRequests[f.key];
            const dirty = isDirty(f);
            return (
              <div key={f.key} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3", i > 0 && "border-t border-muted")}>
                <BrandIcon field={f} size={32} />
                <label htmlFor={`${id}-${f.key}`} className="w-32 shrink-0 text-sm font-semibold text-ink">{f.label}</label>
                <div className="min-w-[13rem] flex-1">
                  {verified && !dirty ? (
                    <a href={profileLinkHref(f, value)} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-primary hover:underline"><span className="truncate">{value}</span><ExternalLink size={12} className="shrink-0" aria-hidden="true" /></a>
                  ) : (
                    <input
                      id={`${id}-${f.key}`} value={draft} disabled={optedOut} placeholder={f.placeholder} className={INPUT_CLASS}
                      onChange={(e) => { setDrafts((d) => ({ ...d, [f.key]: e.target.value })); setPicked((p) => { const n = { ...p }; delete n[f.key]; return n; }); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveSection(kind); } }}
                    />
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {verified && !dirty ? (
                    <>
                      <span style={{ color: VERIFIED_GREEN }} className={`${CHIP} bg-success-soft`}><Check size={11} strokeWidth={3} aria-hidden="true" /> Verified</span>
                      <button type="button" onClick={() => void remove(f)} className="text-xs font-semibold text-ink-muted hover:text-danger">{f.signIn ? "Disconnect" : "Remove"}</button>
                    </>
                  ) : dirty ? (
                    <span className="text-xs font-medium text-ink-muted">{picked[f.key] ? "Picked from search · press Save" : "Unsaved"}</span>
                  ) : value && confirmed && request?.status === "pending" ? (
                    <>
                      <span title={`Requested ${request.requestedAt}`} style={{ color: PENDING_AMBER }} className={`${CHIP} bg-[#FFFBEB]`}><Clock size={11} strokeWidth={2.6} aria-hidden="true" /> Verification pending</span>
                      <button type="button" onClick={() => void withdraw(f)} className="text-xs font-semibold text-ink-muted hover:text-danger">Withdraw</button>
                    </>
                  ) : value && confirmed ? (
                    <>
                      <span title="You confirmed this profile is yours" className={`${CHIP} bg-primary-soft text-primary`}><UserCheck size={11} strokeWidth={2.6} aria-hidden="true" /> Confirmed by you</span>
                      {f.signIn ? (
                        <button type="button" onClick={() => setConnectTarget(f)} className="text-xs font-semibold text-primary hover:underline">Sign in to verify</button>
                      ) : (
                        <button type="button" onClick={() => setRequestTarget(f)} title={request?.status === "declined" ? `Last request declined: ${request.reason ?? ""}` : undefined} className={cn("text-xs font-semibold hover:underline", request?.status === "declined" ? "text-danger" : "text-primary")}>
                          {request?.status === "declined" ? "Declined · request again" : "Request verification"}
                        </button>
                      )}
                      <button type="button" onClick={() => void remove(f)} className="text-xs font-semibold text-ink-muted hover:text-danger">Remove</button>
                    </>
                  ) : value ? (
                    <>
                      <button type="button" onClick={() => setConfirmTarget(f)} style={{ color: PENDING_AMBER, borderColor: PENDING_AMBER }} className={`${ACTION} hover:bg-[#FFFBEB]`}><UserCheck size={12} aria-hidden="true" /> Confirm it&apos;s you</button>
                      <button type="button" onClick={() => void remove(f)} className="text-xs font-semibold text-ink-muted hover:text-danger">Remove</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setFindTarget(f)} disabled={optedOut} title={`Search for your ${f.label} profile by name`} className={`${ACTION} border-primary text-primary hover:bg-primary-soft`}><Search size={12} aria-hidden="true" /> Find</button>
                      <button
                        type="button" disabled={optedOut} className={`${ACTION} border-primary text-primary hover:bg-primary-soft`}
                        title={f.signIn ? `Sign in to ${f.signIn} to add it` : `${f.label} has no sign-in — paste your link in the box, or use Find`}
                        onClick={() => (f.signIn ? setConnectTarget(f) : document.getElementById(`${id}-${f.key}`)?.focus())}
                      ><Link2 size={12} aria-hidden="true" /> Connect</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {savedFlash === kind && <p role="status" className="text-xs font-semibold text-success">Saved</p>}
      </SectionCard>
      </div>
    );
  };

  return (
    <div>
      <div className="space-y-5">{card("scholar")}{card("professional")}</div>
      {rowState.error && <p role="alert" className="mt-3 text-[11.5px] text-danger">{rowState.error}</p>}
      <div className="mt-5 flex justify-end border-t border-muted pt-4"><button type="button" onClick={onDone} className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover">Done</button></div>

      {findTarget && (
        <FindDialog
          field={findTarget} profile={profile} onClose={() => setFindTarget(null)}
          onPicked={(value, fromResults) => {
            const f = findTarget;
            // Find only fills the box — nothing is saved until the card's Save.
            setDrafts((d) => ({ ...d, [f.key]: normalizePastedProfile(f.key, value) }));
            setPicked((p) => { const n = { ...p }; if (fromResults) n[f.key] = "confirmed"; else delete n[f.key]; return n; });
            setFindTarget(null);
            flash(`${f.label} added to the box — press Save to keep it`);
          }}
        />
      )}
      {connectTarget && <ConnectDialog field={connectTarget} onClose={() => setConnectTarget(null)} />}
      {confirmTarget && (
        <ConfirmDialog
          field={confirmTarget} value={stored(confirmTarget.key)} profile={profile} onClose={() => setConfirmTarget(null)}
          onYes={() => { const f = confirmTarget; setConfirmTarget(null); void run({ confirmedProfiles: { ...profile.confirmedProfiles, [f.key]: true } }, `${f.label} confirmed as yours`); }}
          onNo={() => { const f = confirmTarget; setConfirmTarget(null); void run({ [f.key]: "", ...clearLinkTrust(profile, [f.key]) } as ProfilePatch, `${f.label} link removed — add the right one`); }}
          onSignIn={() => { setConnectTarget(confirmTarget); setConfirmTarget(null); }}
        />
      )}
      {requestTarget && (
        <RequestDialog
          field={requestTarget} value={stored(requestTarget.key)} onClose={() => setRequestTarget(null)}
          onSend={(note) => { const f = requestTarget; setRequestTarget(null); void run({ verificationRequests: { ...profile.verificationRequests, [f.key]: { status: "pending", requestedAt: todayLabel(), note } } }, `Verification requested for ${f.label}`); }}
        />
      )}
    </div>
  );
}
