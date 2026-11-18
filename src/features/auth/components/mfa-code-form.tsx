"use client";

import { ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { authService } from "../auth-service";

const INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-3 text-center text-lg font-semibold tracking-[0.2em] text-ink outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal focus:border-primary";
/** The backend takes the 6-digit code of the authenticator app, or a recovery code (xxxx-xxxx). */
const CODE = /^(\d{6}|[a-zA-Z0-9]{4}-?[a-zA-Z0-9]{4})$/;

/** The second step of a sign-in on an account with two-step verification: the code from the authenticator app, or a recovery code.
 *  The backend remembers the first step in its own cookie for a few minutes, so only the code is sent. `onVerified` runs once the session exists. */
export function MfaCodeForm({ onVerified, onCancel }: { onVerified: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const ok = CODE.test(code.trim());

  const submit = async () => {
    if (submitting.current || busy || !ok) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const auth = await authService();
      if (!auth.verifyMfa) throw new Error("Two-step verification isn't available here.");
      await auth.verifyMfa(code);
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><ShieldCheck size={20} aria-hidden="true" /></div>
      <h1 className="mb-1 text-xl font-bold text-navy">Two-step verification</h1>
      <p className="mb-5 text-sm text-ink-muted">Enter the 6-digit code from your authenticator app. Lost your phone? Use one of your recovery codes instead.</p>
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      <label htmlFor="mfa-code" className="sr-only">Authenticator code or recovery code</label>
      <input id="mfa-code" value={code} onChange={(e) => { setCode(e.target.value.slice(0, 9)); setError(""); }} autoFocus autoComplete="one-time-code" inputMode="text" placeholder="123456" className={INPUT} />
      <button type="submit" disabled={!ok || busy} className="mt-4 w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Checking…" : "Verify and sign in"}</button>
      <button type="button" onClick={onCancel} className="mt-3 w-full cursor-pointer text-center text-xs font-semibold text-ink-muted hover:underline">Back to sign in</button>
    </form>
  );
}
