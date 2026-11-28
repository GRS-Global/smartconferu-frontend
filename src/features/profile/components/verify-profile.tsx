"use client";

import { BadgeCheck, Check, ChevronRight, Clock } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import { getProfileService } from "@/services/profile";
import { PROFESSIONAL_LINK_KEYS, SCHOLAR_LINK_KEYS, type Profile, type ProfileVerification } from "@/types/profile";
import { useProfile } from "../profile-context";
import type { ShowcaseEdit } from "../showcase/profile-showcase";
import { PENDING_AMBER } from "../showcase/parts";

const PRIMARY_BTN = "h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const GHOST_BTN = "h-10 rounded-lg border border-line-strong bg-white px-4 text-sm font-semibold text-ink-soft hover:bg-canvas";

/** What is missing before a profile can be sent for verification (the server checks the same). */
/** Profile links counted for verification ("Find me on"): ORCID plus the scholar and professional profiles (the server counts the same). */
const VERIFY_LINKS = ["orcidId", ...SCHOLAR_LINK_KEYS, ...PROFESSIONAL_LINK_KEYS] as const;
export const linksForVerification = (p: Pick<Profile, (typeof VERIFY_LINKS)[number]>) => VERIFY_LINKS.filter((k) => String(p[k] ?? "").trim()).length;
/** Memberships counted: any on the profile except a society a Super Admin refused. */
export const membershipsForVerification = (p: Pick<Profile, "timeline">) => p.timeline.filter((e) => e.type === "membership" && e.verification !== "rejected").length;

export function missingForVerification(p: Pick<Profile, "firstName" | "lastName" | "designation" | "affiliation" | "timeline" | (typeof VERIFY_LINKS)[number]>): string[] {
  const links = linksForVerification(p);
  return [
    !p.firstName.trim() || !p.lastName.trim() ? "name" : "",
    !p.designation.trim() ? "designation" : "",
    !p.affiliation.trim() ? "affiliation" : "",
    links < 2 ? `${2 - links === 2 ? "2 profile links" : "1 more profile link"} (ORCID, Google Scholar, ResearchGate, LinkedIn…)` : "",
    membershipsForVerification(p) < 1 ? "a membership" : "",
  ].filter(Boolean);
}

/** The same requirements as a checklist, for the "Verify my profile" popup: what each needs and whether it is done. */
export function verificationChecklist(p: Pick<Profile, "firstName" | "lastName" | "designation" | "affiliation" | "timeline" | (typeof VERIFY_LINKS)[number]>): Array<{ key: "name" | "designation" | "affiliation" | "links" | "membership"; label: string; hint?: string; done: boolean; progress?: string }> {
  const links = linksForVerification(p);
  const members = membershipsForVerification(p);
  return [
    { key: "name", label: "Name", done: Boolean(p.firstName.trim() && p.lastName.trim()) },
    { key: "designation", label: "Designation", done: Boolean(p.designation.trim()) },
    { key: "affiliation", label: "Affiliation", done: Boolean(p.affiliation.trim()) },
    { key: "links", label: "2 profile links", hint: "ORCID, Google Scholar, ResearchGate, LinkedIn…", done: links >= 2, progress: `${Math.min(links, 2)} of 2` },
    { key: "membership", label: "1 membership", hint: "IEEE, ACM, IET or any society", done: members >= 1, progress: `${Math.min(members, 1)} of 1` },
  ];
}

/** "Verify my profile" on My Profile: ask the Super Admin to check the profile; its green tick appears once approved. Own backend only
 *  (the status comes from the server); shows nothing otherwise, and nothing once verified (the tick beside the name says it). */
export function VerifyProfile({ profile, edit }: { profile: Profile; edit?: Pick<ShowcaseEdit, "intro" | "affiliation" | "links" | "add"> }) {
  const { setVerification } = useProfile();
  const status: ProfileVerification | undefined = profile.profileVerification;
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!status || status.status === "verified") return null;
  const missing = missingForVerification(profile);
  const checklist = verificationChecklist(profile);
  /** A row opens the editor for that detail (the popup closes first). */
  const fix = (key: (typeof checklist)[number]["key"]) => {
    if (!edit) return;
    setAsking(false);
    if (key === "name" || key === "designation") edit.intro();
    else if (key === "affiliation") edit.affiliation();
    else if (key === "links") edit.links();
    else edit.add("membership");
  };

  const run = async (work: (s: Awaited<ReturnType<typeof getProfileService>>) => Promise<ProfileVerification> | undefined, then?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      const next = await work(await getProfileService());
      if (next) setVerification(next);
      then?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const ask = () => { setNote(""); setError(null); setAsking(true); };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5">
      {status.status === "pending" ? (
        <>
          <span style={{ color: PENDING_AMBER }} className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] px-3 py-1.5 text-[13px] font-semibold">
            <Clock size={14} strokeWidth={2.2} aria-hidden="true" /> Verification pending
          </span>
          <button type="button" disabled={busy} onClick={() => void run((s) => s.withdrawVerification?.())} className="text-[13px] font-semibold text-ink-muted underline-offset-2 hover:text-primary hover:underline disabled:opacity-50">
            Withdraw request
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={ask} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary-soft-border bg-primary-soft px-3.5 text-[13px] font-semibold text-primary hover:bg-white">
            <BadgeCheck size={15} strokeWidth={2.2} aria-hidden="true" /> {status.status === "rejected" ? "Ask for verification again" : "Verify my profile"}
          </button>
          {status.status === "rejected" && (
            <span className="text-[13px] font-semibold text-danger-ink">Not verified{status.reason ? `: ${status.reason}` : ""}</span>
          )}
        </>
      )}
      {error && !asking && <span role="alert" className="text-[13px] text-danger-ink">{error}</span>}

      <Dialog open={asking} onClose={() => setAsking(false)} size="md" icon={BadgeCheck} title="Verify my profile" description="Our team checks that this profile is genuine. Once it is, a green tick shows next to your name.">
        {missing.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-navy">Complete these first, so there is something to verify.</p>
            <ul className="mt-3 space-y-2" aria-label="Verification requirements">
              {checklist.map((item) => (
                <li key={item.label}>
                  <button type="button" disabled={!edit} onClick={() => fix(item.key)} className={`group flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors enabled:cursor-pointer ${item.done ? "border-line bg-canvas enabled:hover:bg-white" : "border-primary-soft-border bg-primary-soft enabled:hover:bg-white"} enabled:hover:border-primary`}>
                    <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-success text-white" : "border-2 border-primary text-primary"}`}>
                      {item.done ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${item.done ? "text-ink-muted" : "text-navy"}`}>{item.label}<span className="sr-only">{item.done ? " — done" : " — still needed"}{edit ? ". Opens the editor." : ""}</span></span>
                      {!item.done && item.hint && <span className="block text-xs text-ink-muted">{item.hint}</span>}
                    </span>
                    {item.progress && <span className={`shrink-0 text-xs font-semibold ${item.done ? "text-success-ink" : "text-primary"}`}>{item.progress}</span>}
                    {edit && <ChevronRight size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">Tap a row to add it, then press Verify my profile again.</p>
            <div className="mt-5 flex justify-end"><button type="button" onClick={() => setAsking(false)} className={GHOST_BTN}>Close</button></div>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void run((s) => s.requestVerification?.(note), () => setAsking(false)); }}>
            <ul className="mb-4 space-y-1 text-[13px] text-ink-soft">
              <li><span className="font-semibold text-navy">{[profile.firstName, profile.lastName].filter(Boolean).join(" ")}</span> · {profile.designation}</li>
              <li>{profile.affiliation}{profile.country ? `, ${profile.country}` : ""}</li>
            </ul>
            <label htmlFor="verify-note" className="mb-1.5 block text-[13px] font-semibold text-navy">Anything that helps us check? <span className="font-normal text-ink-muted">(optional)</span></label>
            <textarea id="verify-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. my faculty page, or the conferences I chair" className={`${INPUT_CLASS} h-auto py-2`} />
            <p className="mt-2 text-xs text-ink-muted">Adding your ORCID iD, a verified institutional email or your faculty page makes it quicker.</p>
            {error && <p role="alert" className="mt-3 text-[13px] text-danger-ink">{error}</p>}
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setAsking(false)} className={GHOST_BTN}>Cancel</button>
              <button type="submit" disabled={busy} className={PRIMARY_BTN}>{busy ? "Sending…" : "Send request"}</button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
