"use client";

import { BadgeCheck, Clock } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import { getProfileService } from "@/services/profile";
import { PROFESSIONAL_LINK_KEYS, SCHOLAR_LINK_KEYS, type Profile, type ProfileVerification } from "@/types/profile";
import { useProfile } from "../profile-context";
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

/** "Verify my profile" on My Profile: ask the Super Admin to check the profile; its green tick appears once approved. Own backend only
 *  (the status comes from the server); shows nothing otherwise, and nothing once verified (the tick beside the name says it). */
export function VerifyProfile({ profile }: { profile: Profile }) {
  const { setVerification } = useProfile();
  const status: ProfileVerification | undefined = profile.profileVerification;
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!status || status.status === "verified") return null;
  const missing = missingForVerification(profile);

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
            <p className="text-sm text-ink-soft">Add your {missing.join(" and ")} to your profile first, so there is something to verify.</p>
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
