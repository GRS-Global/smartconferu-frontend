"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { Dialog } from "@/components/ui/dialog";
import { AUTH_API } from "@/lib/config";
import { MfaRequiredError } from "@/services/errors";
import { authService } from "../auth-service";

/** The own backend's login code has exactly 6 digits (Supabase's can be up to 10). */
const CODE_MAX = AUTH_API ? 6 : 10;

export type AccountEmailKind = "otp" | "reset";

const FLOWS: Record<AccountEmailKind, { title: string; desc: string; button: string; busy: string }> = {
  reset: { title: "Reset your password", desc: "Enter your account email and we'll send you a link to choose a new password.", button: "Send reset link", busy: "Sending…" },
  otp: { title: "Log in with a one-time code", desc: "We'll email you a code to sign in with instead of your password.", button: "Send code", busy: "Sending…" },
};
// Supabase can wait a minute between emails to the same address — the resend button counts it down.
const RESEND_SECONDS = 60;
const INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary";

interface Props {
  kind: AccountEmailKind | null;
  initialEmail: string;
  onClose: () => void;
  /** Called after a one-time code signs the user in. */
  onSignedIn: () => void;
  /** The code was right but the account has two-step verification: the login screen asks for that code next. */
  onMfaRequired?: () => void;
}

/** "Forgot password?" (emails a reset link) and "Email me a login code" (emails a code, then signs in with it). */
export function AccountEmailDialog({ kind, initialEmail, onClose, onSignedIn, onMfaRequired }: Props) {
  // Remount per opening so every opening starts on the email step.
  return <Inner key={kind ?? "closed"} kind={kind} initialEmail={initialEmail} onClose={onClose} onSignedIn={onSignedIn} onMfaRequired={onMfaRequired} />;
}

function Inner({ kind, initialEmail, onClose, onSignedIn, onMfaRequired }: Props) {
  const flow = FLOWS[kind ?? "otp"];
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<"email" | "sent" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  const codeOk = code.trim().length >= 6 && code.trim().length <= CODE_MAX && /^[0-9]+$/.test(code.trim());

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong — please try again."); } finally { setBusy(false); }
  };
  const send = () => run(async () => {
    const auth = await authService();
    if (kind === "reset") await auth.sendPasswordReset(email);
    else await auth.sendLoginCode(email);
    setCooldown(RESEND_SECONDS);
    setStep(kind === "reset" ? "sent" : "code");
  });
  const resend = () => run(async () => {
    await (await authService()).sendLoginCode(email);
    setCooldown(RESEND_SECONDS);
    setCode("");
    setInfo("A new code is on its way.");
  });
  const verify = () => run(async () => {
    try {
      await (await authService()).verifyLoginCode(email, code);
    } catch (e) {
      if (e instanceof MfaRequiredError && onMfaRequired) { onMfaRequired(); return; }
      throw e;
    }
    onSignedIn();
  });

  return (
    <Dialog open={kind !== null} onClose={onClose} size="md" title={flow.title}>
      {step === "sent" && (
        <div className="py-3 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft"><Check size={22} className="text-success-ink" aria-hidden="true" /></div>
          <p className="text-sm font-semibold text-navy">Check your inbox</p>
          <p className="mb-5 mt-1 text-xs leading-relaxed text-ink-muted">
            If an account exists for <b>{email.trim()}</b>, we&apos;ve sent it a link to choose a new password. The link works once, expires after an hour, and must be opened in this browser. Don&apos;t see it? Check your spam folder.
          </p>
          <button type="button" onClick={onClose} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover">Close</button>
        </div>
      )}

      {step === "code" && (
        <form onSubmit={(e) => { e.preventDefault(); if (codeOk && !busy) verify(); }}>
          <p className="mb-3 text-sm text-ink-muted">We&apos;ve emailed a code to <b className="text-ink">{email.trim()}</b>. Enter it below{AUTH_API ? "." : " — or just click the sign-in link in the same email."}</p>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          {info && <AuthMessage>{info}</AuthMessage>}
          <label htmlFor="login-code" className="sr-only">Code from the email</label>
          <input
            id="login-code" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, CODE_MAX)); setError(""); }}
            inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="Code from the email"
            className="w-full rounded-lg border-[1.5px] border-line px-3.5 py-3 text-center text-lg font-semibold tracking-[0.3em] text-ink outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal focus:border-primary"
          />
          <button type="submit" disabled={!codeOk || busy} className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45">
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="mt-3 flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); setInfo(""); }} className="font-semibold text-ink-muted hover:underline">Use a different email</button>
            <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {step === "email" && (
        <form onSubmit={(e) => { e.preventDefault(); if (valid && !busy && cooldown <= 0) send(); }}>
          <p className="mb-3 text-sm text-ink-muted">{flow.desc}</p>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <label htmlFor="account-email" className="sr-only">Email address</label>
          <input id="account-email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="Email address" type="email" autoComplete="email" autoFocus className={INPUT} />
          <button type="submit" disabled={!valid || busy || cooldown > 0} className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45">
            {busy ? flow.busy : cooldown > 0 ? `Wait ${cooldown}s` : flow.button}
          </button>
        </form>
      )}
    </Dialog>
  );
}
