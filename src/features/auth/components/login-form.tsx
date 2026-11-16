"use client";

import { ChevronLeft, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { PasswordField } from "@/components/ui/password-field";
import { REGISTER_PATH, safeNext } from "@/lib/auth-redirect";
import { DATA_SOURCE, PROTOTYPE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";
import { authService } from "../auth-service";
import { AccountEmailDialog, type AccountEmailKind } from "./account-email-dialog";
import { DEMO_ACCOUNTS, DEMO_ROLE_TONE } from "../demo-accounts";
import { SsoButtons } from "./sso-buttons";
import { SAMPLE_UI } from "@/lib/sample-mode";
import { cn } from "@/lib/cn";

// As in the prototype the border does not change on focus (there its inline border style overrides the focus class) and there is no outline.
const INPUT = "field-no-outline w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400";
/** The line under the logo is fixed text in the prototype's sign-in page (not tied to any account). */
const TAGLINE = "World Conference on Information Systems for Business Management";
const BTN_FX = "transition-all hover:shadow-[0_0_30px_rgba(124,58,237,0.35)] hover:scale-[1.02]";

/** Errors Supabase puts in the URL hash when an emailed link is expired or already used. Read before
 *  the Supabase client (which strips the hash) is created. */
function linkErrorFromHash(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const description = params.get("error_description");
  if (!description && !params.get("error")) return "";
  const expired = /expired|invalid/i.test(`${params.get("error_code")} ${description}`);
  return expired ? "This link has expired or was already used — please request a new one." : (description || "This link didn't work — please try again.").replace(/\+/g, " ");
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  const mock = DATA_SOURCE === "mock";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState("");
  const [resend, setResend] = useState<"" | "sending" | "sent" | string>("");
  const [dialog, setDialog] = useState<AccountEmailKind | null>(null);
  const [linkError] = useState(linkErrorFromHash);
  const submitting = useRef(false); // blocks a second submit before React re-renders the disabled button

  const finish = () => {
    setDone(true);
    router.replace(next);
    router.refresh();
  };

  // A session can arrive without this form: an emailed sign-in link (hash tokens or ?code=) is consumed by the
  // client on load. Once one exists, leave the login page for where the user was going.
  useEffect(() => {
    if (mock || !configured) return undefined;
    const db = getSupabase();
    db.auth.getSession().then(({ data }) => { if (data.session) { setDone(true); router.replace(next); router.refresh(); } });
    const { data } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) { setDone(true); router.replace(next); router.refresh(); }
    });
    return () => data.subscription.unsubscribe();
  }, [mock, configured, next, router]);

  const submit = async () => {
    if (submitting.current || busy || done) return;
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await (await authService()).signIn(email, password);
      finish();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong — please try again.";
      setError(message);
      setUnconfirmed(/confirm your email/i.test(message) ? email.trim() : "");
      setResend("");
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  };

  const resendConfirmation = async () => {
    setResend("sending");
    try { await (await authService()).resendConfirmation(unconfirmed); setResend("sent"); } catch (e) { setResend(e instanceof Error ? e.message : "Couldn't resend the email."); }
  };

  const reason = params.get("reason");
  const notice = !error && reason === "expired" ? "Your session has ended — please sign in again." : "";
  const disabled = busy || done || mock || !configured;

  return (
    <div className="relative z-10 w-full max-w-[480px]">
      <a href={`${PROTOTYPE_URL}/`} className="mb-8 flex flex-col items-center justify-center gap-3 text-center transition-opacity hover:opacity-90" aria-label="Smartconferu home">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={36} height={36} priority className="h-9 w-auto" />
        </span>
        <span className="text-xs text-white/60">{TAGLINE}</span>
      </a>

      <div className="rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-1 text-xl font-bold text-navy">Welcome back</h1>
        <p className="mb-6 text-sm text-ink-muted">Sign in to submit and track your papers.</p>

        {mock && <AuthMessage tone="error">Sign-in is not used in mock data mode. <Link href="/dashboard" className="underline">Open the dashboard</Link> to see the fixtures.</AuthMessage>}
        {!mock && !configured && <AuthMessage tone="error">Sign-in isn&apos;t set up on this site yet (the Supabase keys are missing).</AuthMessage>}
        {linkError && !error && <AuthMessage tone="error">{linkError}</AuthMessage>}
        {notice && <AuthMessage>{notice}</AuthMessage>}
        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        {done && <AuthMessage>Signed in — taking you to your conferences…</AuthMessage>}
        {unconfirmed && (
          <p className="-mt-1 mb-3 text-xs text-ink-muted">
            {resend === "sent" ? `Confirmation email sent again to ${unconfirmed}.`
              : resend && resend !== "sending" ? resend
                : <>Didn&apos;t get the email? <button type="button" onClick={resendConfirmation} disabled={resend === "sending"} className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60">{resend === "sending" ? "Sending…" : "Resend confirmation email"}</button></>}
          </p>
        )}

        <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="sr-only">Email address</label>
            <input id="login-email" name="email" type="text" autoComplete="username" placeholder="Email address" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} disabled={mock || !configured} className={INPUT} />
          </div>
          <div>
            <label htmlFor="login-password" className="sr-only">Password</label>
            <PasswordField id="login-password" name="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} disabled={mock || !configured} className={INPUT} />
          </div>
          <button type="submit" disabled={disabled || !email.trim() || !password} className={cn("w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50", BTN_FX)}>
            {busy || done ? "Signing in…" : "Sign in"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => setDialog("otp")} disabled={mock || !configured} className="font-semibold text-primary hover:underline disabled:opacity-50">Email me a login code</button>
            <button type="button" onClick={() => setDialog("reset")} disabled={mock || !configured} className="font-semibold text-primary hover:underline disabled:opacity-50">Forgot password?</button>
          </div>
        </form>
        <AccountEmailDialog kind={dialog} initialEmail={email} onClose={() => setDialog(null)} onSignedIn={() => { setDialog(null); finish(); }} />

        {/* Demo logins show sample data, so they are only offered in sample / mock mode (as in the prototype). */}
        {SAMPLE_UI && (
          <div className="mt-4 rounded-lg border border-line bg-canvas p-3">
            <p className="mb-2 text-xs font-semibold text-ink-muted">Demo logins — role-based dashboards</p>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((a) => {
                const tone = DEMO_ROLE_TONE[a.role];
                return (
                  <button key={a.role} type="button" onClick={() => { setEmail(a.email); setPassword(a.password); setError(""); }} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-slate-50">
                    <span style={{ background: tone.bg, color: tone.color }} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold">{tone.label}</span>
                    <span className="truncate font-mono text-[11px] text-ink-faint">{a.email}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-ink-faint">Click a row to fill it in, then hit Sign in.</p>
          </div>
        )}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium text-ink-faint">or continue with</span>
          <div className="h-px flex-1 bg-line" />
        </div>
        <SsoButtons />

        <p className="mt-5 text-center text-xs text-ink-faint">
          Don&apos;t have an account? <Link href={REGISTER_PATH} className="font-semibold text-primary hover:underline">Register here</Link>
        </p>
      </div>

      <a href={`${PROTOTYPE_URL}/smart-cfp/`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-white/20 bg-white/5 py-2.5 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white">
        <Sparkles size={14} aria-hidden="true" /> Browse Smart CFP — no account needed
      </a>
      <p className="mt-6 text-center text-xs text-white/45">{SAMPLE_UI ? "This is a clickable prototype with sample data — no real accounts required." : "Your account and everything you add are saved for real."}</p>
      <a href={`${PROTOTYPE_URL}/`} className="mt-4 flex items-center justify-center gap-1 text-xs font-semibold text-white/60 transition-colors hover:text-white">
        <ChevronLeft size={13} aria-hidden="true" /> Back to home
      </a>
    </div>
  );
}
