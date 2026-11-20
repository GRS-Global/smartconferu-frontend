"use client";

import { AlertTriangle, BadgeCheck, Check, Clock, ExternalLink, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import { Loader } from "@/components/ui/load-more";
import { CAN_SEARCH_IN_APP, profileSearchUrl, searchProfiles, type ProfileMatch } from "@/lib/profile-search";
import type { Profile } from "@/types/profile";
import { normalizePastedProfile, profileLinkHref, type LinkField } from "../fields";
import { BrandIcon, PENDING_AMBER, UserAvatar, VERIFIED_GREEN } from "../showcase/parts";

const fullNameOf = (p: Profile) => [p.firstName, p.lastName].filter(Boolean).join(" ");
const PRIMARY_BTN = "h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const GHOST_BTN = "h-10 rounded-lg border border-line-strong bg-white px-4 text-sm font-semibold text-ink-soft hover:bg-canvas";

/** "Find": look yourself up by name. ORCID and OpenAlex are searched right here (real results to pick from); every other platform opens its own
 *  people search in a new tab, and you paste the link you find back. */
export function FindDialog({ field, profile, onPicked, onClose }: { field: LinkField; profile: Profile; onPicked: (value: string, fromResults: boolean) => void; onClose: () => void }) {
  const fullName = fullNameOf(profile);
  const inApp = CAN_SEARCH_IN_APP.has(field.key);
  const [query, setQuery] = useState(fullName);
  const [state, setState] = useState<{ status: "idle" | "loading" | "error" } | { status: "done"; results: ProfileMatch[] }>({ status: inApp && fullName ? "loading" : "idle" });
  const [pasted, setPasted] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const siteUrl = profileSearchUrl(field.key, query.trim() || fullName);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (!inApp) { window.open(siteUrl, "_blank", "noopener,noreferrer"); return; }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ status: "loading" });
    try {
      const results = await searchProfiles(field.key, q, { signal: ctrl.signal });
      if (!ctrl.signal.aborted) setState({ status: "done", results });
    } catch {
      if (!ctrl.signal.aborted) setState({ status: "error" });
    }
  };
  // The name is already known: search straight away, once, when the dialog opens.
  const fieldKey = field.key;
  useEffect(() => {
    if (!inApp || !fullName) return undefined;
    const ctrl = new AbortController();
    searchProfiles(fieldKey, fullName, { signal: ctrl.signal })
      .then((results) => { if (!ctrl.signal.aborted) setState({ status: "done", results }); })
      .catch(() => { if (!ctrl.signal.aborted) setState({ status: "error" }); });
    return () => ctrl.abort();
  }, [inApp, fullName, fieldKey]);

  const siteLink = (text: string) => <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">{text}</a>;
  const showPaste = !inApp || state.status === "error" || (state.status === "done" && state.results.length === 0);
  return (
    <Dialog open onClose={onClose} size="md" title={`Find your ${field.label} profile`}>
      <form onSubmit={run} className="mb-4 flex items-center gap-2">
        <input value={query} onChange={(e) => { setQuery(e.target.value); if (state.status !== "loading") setState({ status: "idle" }); }} placeholder="Your name" aria-label="Name to search for" className={INPUT_CLASS} />
        <button type="submit" disabled={!query.trim() || state.status === "loading"} className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
          {inApp ? <><Search size={14} aria-hidden="true" /> Search</> : <><ExternalLink size={14} aria-hidden="true" /> Search on {field.label}</>}
        </button>
      </form>
      {!inApp && <p className="text-sm leading-relaxed text-ink-muted">{field.label} can&apos;t be searched from here. Search opens {field.label} in a new tab with your name filled in — open your profile there, copy its link and paste it below.</p>}
      {inApp && state.status === "loading" && <Loader label={`Searching ${field.label}…`} className="py-6" />}
      {inApp && state.status === "error" && <p role="alert" className="flex items-start gap-1.5 text-sm text-danger"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> We couldn&apos;t reach {field.label} just now. {siteLink(`Search on ${field.label}`)} instead and paste the link below.</p>}
      {inApp && state.status === "done" && (state.results.length === 0 ? (
        <p className="text-sm text-ink-muted">No one called “{query.trim()}” on {field.label}. Try another spelling, or {siteLink(`search on ${field.label}`)}.</p>
      ) : (
        <ul className="space-y-2">
          {state.results.map((r) => (
            <li key={r.value} className="flex items-center gap-3 rounded-lg border border-line p-3">
              <BrandIcon field={field} size={36} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{r.name}</div><div className="truncate text-xs text-ink-muted">{r.detail}</div></div>
              <button type="button" onClick={() => onPicked(r.value, true)} className="shrink-0 rounded-lg border-[1.5px] border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft">This is me</button>
            </li>
          ))}
          <li className="pt-1 text-xs text-ink-muted">Not listed? {siteLink(`Search on ${field.label}`)}, then paste the link below.</li>
        </ul>
      ))}
      {showPaste && (
        <div className="mt-4 border-t border-dashed border-line pt-4">
          <label htmlFor="find-pasted" className="mb-1.5 block text-xs font-semibold text-ink-soft">Found it? Paste the link{field.key === "scopusId" ? " or author ID" : ""} here</label>
          <div className="flex items-center gap-2">
            <input id="find-pasted" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={field.placeholder} className={INPUT_CLASS} />
            <button type="button" disabled={!pasted.trim()} onClick={() => onPicked(normalizePastedProfile(field.key, pasted), false)} className="h-10 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">Use this link</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** "Connect" / "Sign in to verify": the prototype simulates a platform sign-in and marks the link Verified. This app has no such integration,
 *  so it says so — and never marks a link verified. */
export function ConnectDialog({ field, onClose }: { field: LinkField; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} size="sm" title={`Connect ${field.label}`}>
      <div className="mb-4 flex items-center gap-3"><BrandIcon field={field} size={36} /><p className="text-sm text-ink-muted">Signing in to <span className="font-semibold">{field.signIn ?? field.label}</span> to verify this profile isn&apos;t available yet.</p></div>
      <p className="text-sm leading-relaxed text-ink-muted">Paste your profile link in the box (or use <b>Find</b>), then confirm it&apos;s yours. A link only gets the green Verified badge once a real verification exists — this app never marks one itself.</p>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className={PRIMARY_BTN}>Got it</button></div>
    </Dialog>
  );
}

/** "Is this your … profile?" — the member checks the link is theirs. The prototype shows made-up stats here; this one doesn't fetch the profile, it asks the member to open it. */
export function ConfirmDialog({ field, value, profile, onYes, onNo, onSignIn, onClose }: { field: LinkField; value: string; profile: Profile; onYes: () => void; onNo: () => void; onSignIn: () => void; onClose: () => void }) {
  const href = profileLinkHref(field, value);
  return (
    <Dialog open onClose={onClose} size="md" title={`Is this your ${field.label} profile?`} description="Check it's really you before it shows on your profile.">
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2"><BrandIcon field={field} size={22} /><span className="text-xs font-semibold text-ink-muted">Profile on {field.label}</span></div>
        <div className="flex items-center gap-3.5 p-4">
          <UserAvatar profile={profile} size={52} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-navy">{fullNameOf(profile) || "Unknown name"}</div>
            <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-medium text-primary hover:underline"><span className="truncate">{value}</span> <ExternalLink size={11} className="shrink-0" aria-hidden="true" /></a>
          </div>
        </div>
      </div>
      <p className="mt-3.5 text-[13px] leading-normal text-ink-muted">Open the link to check it. Organizers and reviewers use it to recognise your work, so only confirm a profile that belongs to you.</p>
      {field.signIn ? (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-normal text-ink-muted"><BadgeCheck size={14} style={{ color: VERIFIED_GREEN }} className="mt-0.5 shrink-0" aria-hidden="true" /> Signing in with {field.signIn} to get a <b>Verified</b> badge isn&apos;t available yet. <button type="button" onClick={onSignIn} className="font-semibold text-primary hover:underline">Learn more</button></p>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-normal text-ink-muted"><BadgeCheck size={14} style={{ color: VERIFIED_GREEN }} className="mt-0.5 shrink-0" aria-hidden="true" /> {field.label} has no sign-in. After confirming, you can ask our team to verify it.</p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onNo} className={GHOST_BTN}>No, that&apos;s not me</button>
        <button type="button" onClick={onYes} className={`${PRIMARY_BTN} inline-flex items-center gap-1.5`}><Check size={15} strokeWidth={2.5} aria-hidden="true" /> Yes, this is me</button>
      </div>
    </Dialog>
  );
}

const CHECKS = ["The name on the profile matches yours", "Your affiliation or institutional email appears on it", "Publications line up with the work you've submitted here"];

/** "Request verification" for platforms with no sign-in. The request is recorded on the profile; nothing reviews it yet, and the dialog says so. */
export function RequestDialog({ field, value, onSend, onClose }: { field: LinkField; value: string; onSend: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onClose={onClose} size="md" title={`Verify your ${field.label} profile`} description={`${field.label} has no sign-in, so our team would check it by hand.`}>
      <div className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5"><BrandIcon field={field} size={28} /><span className="truncate text-[13px] font-medium text-ink-soft">{value}</span></div>
      <div className="mt-4 text-[13px] font-semibold text-navy">What we check</div>
      <ul className="mt-2 space-y-1.5">{CHECKS.map((c) => <li key={c} className="flex items-start gap-2 text-[13px] leading-normal text-ink-soft"><Check size={14} strokeWidth={2.5} style={{ color: VERIFIED_GREEN }} className="mt-0.5 shrink-0" aria-hidden="true" /> {c}</li>)}</ul>
      <label htmlFor="verify-note" className="mt-4 block text-[13px] font-semibold text-[#334155]">Anything that helps? <span className="font-normal text-ink-muted">(optional)</span></label>
      <textarea id="verify-note" value={note} rows={3} placeholder="e.g. My university email is listed on the profile" onChange={(e) => setNote(e.target.value.slice(0, 300))} className={`${INPUT_CLASS} mt-1.5 resize-y`} />
      <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-normal text-ink-muted"><Clock size={14} style={{ color: PENDING_AMBER }} className="mt-0.5 shrink-0" aria-hidden="true" /> The request is saved on your profile as “Verification pending”. The team review that turns it into a green Verified badge isn&apos;t connected yet.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={GHOST_BTN}>Cancel</button>
        <button type="button" onClick={() => onSend(note.trim())} className={PRIMARY_BTN}>Send request</button>
      </div>
    </Dialog>
  );
}

