"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { PasswordField } from "@/components/ui/password-field";
import { DEFAULT_AFTER_LOGIN, LOGIN_PATH } from "@/lib/auth-redirect";
import { AUTH_API, AUTH_CONFIGURED, DATA_SOURCE } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";
import { authService } from "../auth-service";
import { OLD_LINK_MESSAGE, readEmailLink } from "../email-link";

const INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary";
const MIN_LENGTH = AUTH_API ? 8 : 6;

type Phase = { kind: "checking" } | { kind: "ready" } | { kind: "invalid"; message: string };

const NO_LINK = "This reset link has expired or was already used. Go back to sign in and choose Forgot password? to get a new one.";
const NOT_OPENED = "We couldn't open this reset link. It may have expired, been used already, or been opened in a different browser than the one you asked from. Go back to sign in and choose Forgot password? to get a new one.";

/** Where the "reset your password" email link lands (the prototype's ResetPasswordPage). The Supabase client exchanges the link's
 *  code on load and announces a recovery session (PASSWORD_RECOVERY); only then is the new-password form shown. Opening the page
 *  without a link, with an expired or used one, or in another browser than the one that asked, says so and points back to sign in. */
export function ResetPasswordForm() {
  const router = useRouter();
  const configured = AUTH_CONFIGURED;
  const mock = DATA_SOURCE === "mock";
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false); // blocks a second submit before React re-renders the disabled button

  useEffect(() => {
    if (mock || !configured) return undefined;
    if (AUTH_API) {
      // The emailed link carries a one-time token (?token=…); the backend checks it when the new password is sent.
      const token = new URLSearchParams(window.location.search).get("token");
      const t = setTimeout(() => setPhase(token ? { kind: "ready" } : { kind: "invalid", message: NO_LINK }), 0);
      return () => clearTimeout(t);
    }
    // Read what the link left in the address bar before the Supabase client is created (it cleans it up).
    const link = readEmailLink();
    const unusable = link.error || (link.hasImplicitTokens ? OLD_LINK_MESSAGE : !link.hasCode ? NO_LINK : "");
    if (unusable) {
      const t = setTimeout(() => setPhase({ kind: "invalid", message: unusable }), 0);
      return () => clearTimeout(t);
    }

    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const db = getSupabase();
    const { data } = db.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && live) { clearTimeout(timer); setPhase({ kind: "ready" }); }
    });
    // getSession() resolves once the client has finished starting up (and exchanging the code). If no recovery session was
    // announced shortly after, the link could not be used here.
    void db.auth.getSession().then(() => {
      timer = setTimeout(() => { if (live) setPhase((p) => (p.kind === "checking" ? { kind: "invalid", message: NOT_OPENED } : p)); }, 1200);
    });
    return () => { live = false; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [mock, configured]);

  const problem = password.length < MIN_LENGTH ? `Password must be at least ${MIN_LENGTH} characters.` : password !== password2 ? "The two passwords don't match." : "";
  const canSubmit = phase.kind === "ready" && !problem && !busy && !done;

  const submit = async () => {
    if (submitting.current || busy || done) return;
    if (problem) { setError(problem); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await (await authService()).setNewPassword(password);
      setPassword("");
      setPassword2("");
      setDone(true);
      // The backend ends every session when a password is reset, so the next step is signing in with the new one.
      router.replace(AUTH_API ? `${LOGIN_PATH}?reset=1` : DEFAULT_AFTER_LOGIN);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="relative z-10 w-full max-w-[480px]">
      <Link href="/" className="mb-8 flex items-center justify-center text-center transition-opacity hover:opacity-90" aria-label="Smartconferu home">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={36} height={36} priority className="h-9 w-auto" />
        </span>
      </Link>

      <div className="rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-1 text-xl font-bold text-navy">Set a new password</h1>

        {mock && <AuthMessage tone="error">Password reset is not used in mock data mode.</AuthMessage>}
        {!mock && !configured && <AuthMessage tone="error">Sign-in isn&apos;t set up on this site yet (the sign-in service isn&apos;t configured).</AuthMessage>}

        {!mock && configured && phase.kind === "checking" && <p role="status" className="text-sm text-ink-muted">Checking your reset link…</p>}

        {phase.kind === "invalid" && (
          <>
            <p role="alert" className="mb-5 text-sm text-ink-muted">{phase.message}</p>
            <Link href={LOGIN_PATH} className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Back to sign in</Link>
          </>
        )}

        {phase.kind === "ready" && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <p className="mb-5 text-sm text-ink-muted">Choose a new password for your account. {AUTH_API ? "You'll sign in with it afterwards." : "You'll be signed in straight after."}</p>
            {error && <AuthMessage tone="error">{error}</AuthMessage>}
            {done && <AuthMessage>{AUTH_API ? "Password updated — taking you to sign in…" : "Password updated — taking you to your conferences…"}</AuthMessage>}
            <div className="space-y-3">
              <div>
                <label htmlFor="reset-password" className="sr-only">New password</label>
                <PasswordField id="reset-password" name="new-password" label="new password" autoComplete="new-password" autoFocus placeholder={`New password (min. ${MIN_LENGTH} characters)`} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} disabled={busy || done} className={INPUT} />
              </div>
              <div>
                <label htmlFor="reset-password2" className="sr-only">Retype new password</label>
                <PasswordField id="reset-password2" name="new-password-confirm" label="retyped password" autoComplete="new-password" placeholder="Retype new password" value={password2} onChange={(e) => { setPassword2(e.target.value); setError(""); }} disabled={busy || done} className={INPUT} />
              </div>
              <button type="submit" disabled={!canSubmit} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                {busy || done ? "Saving…" : "Save password and sign in"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
