"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { Modal } from "@/components/ui/modal";
import { PasswordField } from "@/components/ui/password-field";
import { TriggeredEmailNote } from "@/components/ui/triggered-email-note";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { authService } from "@/features/auth/auth-service";
import { AUTH_API } from "@/lib/config";
import { useOptionalProfile } from "@/features/profile/profile-context";
import { AuthRequiredError } from "@/services/errors";

/** The own backend asks for 8 characters (Supabase 6). */
export const MIN_PASSWORD_LENGTH = AUTH_API ? 8 : 6;

/** The form's own problems, in the prototype's wording; "" when fine. */
export function passwordProblems(current: string, next: string, again: string, needsCurrent = true) {
  return {
    current: needsCurrent && !current ? "Enter your current password." : "",
    next: next.length < MIN_PASSWORD_LENGTH ? `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      : next === current ? "Your new password must be different from the current one." : "",
    again: again && next !== again ? "The two new passwords don't match." : "",
  };
}

const INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary";
const LABEL = "mb-1 block text-xs font-semibold text-ink-soft";

/** Security & Settings › Account & Security › Change password, as the prototype's popup (ChangePasswordModal). The current password is checked
 *  first; "Password updated" is shown only once Supabase Auth reports success. */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [ended, setEnded] = useState(false);
  const profileCtx = useOptionalProfile();
  // An account created through Google, Microsoft or ORCID has no password yet: it can set one without a current password.
  const needsCurrent = !(profileCtx?.state.status === "ready" && profileCtx.state.profile.hasPassword === false);

  const problems = passwordProblems(current, next, again, needsCurrent);
  const valid = (!needsCurrent || Boolean(current)) && !problems.next && next === again && !busy;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await (await authService()).changePassword(needsCurrent ? current : "", next);
      setDone(true);
      // The account has a password now: the next time, the current one is asked for.
      if (!needsCurrent) profileCtx?.reload();
    } catch (e) {
      if (e instanceof AuthRequiredError) setEnded(true);
      else setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal title="Change Password" onClose={onClose} maxWidth="max-w-lg">
        <div className="py-3 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft"><Check size={22} aria-hidden="true" className="text-success-ink" /></div>
          <p className="text-sm font-semibold text-navy">Password updated</p>
          <p className="mb-5 mt-1 text-xs text-ink-faint">Use your new password the next time you sign in.</p>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white">Close</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Change Password" onClose={onClose} maxWidth="max-w-lg">
      {ended && <SessionEnded />}
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        <div className="space-y-3">
          {needsCurrent ? <div>
            <label htmlFor="pw-current" className={LABEL}>Current password <span className="text-danger-ink">*</span></label>
            <PasswordField id="pw-current" label="current password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setError(""); }} className={INPUT} />
          </div> : <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted">You signed up with Google, Microsoft or ORCID, so there is no password yet. Choose one to also sign in with your email.</p>}
          <div>
            <label htmlFor="pw-new" className={LABEL}>New password <span className="text-danger-ink">*</span></label>
            <PasswordField id="pw-new" label="new password" autoComplete="new-password" value={next} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} onChange={(e) => { setNext(e.target.value); setError(""); }} className={INPUT} />
          </div>
          <div>
            <label htmlFor="pw-again" className={LABEL}>Retype new password <span className="text-danger-ink">*</span></label>
            <PasswordField id="pw-again" label="retyped password" autoComplete="new-password" value={again} aria-invalid={Boolean(problems.again) || undefined} onChange={(e) => { setAgain(e.target.value); setError(""); }} className={INPUT} />
            {problems.again && <p role="alert" className="mt-1 text-xs font-medium text-danger-ink">{problems.again}</p>}
          </div>
        </div>
        <TriggeredEmailNote className="mt-4" emails={[{ key: "passwordChanged", to: "Your login email" }]} />
        <button type="submit" disabled={!valid} className="mt-1 w-full cursor-pointer rounded-lg bg-navy py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Updating…" : "Update Password"}</button>
      </form>
    </Modal>
  );
}
