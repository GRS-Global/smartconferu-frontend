"use client";
/* Super Admin sign-in, laid out like the prototype's AdminLogin: a brand panel that previews the
   console (left, desktop only; a short header below lg) and a two-step form (right).
   Step 1: work email + password. Step 2: the 6-digit code the API emails to the admin (or the
   authenticator-app code when they set one up). Only a super admin in a verified session gets in.
   In development the API can send the code back (DEV_SHOW_EMAIL_CODES) and this page fills it in. */
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Eye, EyeOff, Info, KeyRound, Loader2, Lock, Mail, ShieldCheck, type LucideIcon } from "lucide-react";
import { ApiError } from "../api";
import { checkAdminAccess, resendCode, resumeAdminSession, signInWithPassword, signOut, verifyCode } from "../services";
import { fmtTrustDate, queueWelcome, rememberTrust, TRUST_DAYS, trustedUntil } from "../trusted-device";
import { ModuleStrip, PlatformScene } from "./login-visual";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
// Match the API: 5 wrong passwords lock the account for 15 minutes.
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const emptyCode = () => Array<string>(CODE_LENGTH).fill("");
const safeNext = (next: string | null) => (next && next.startsWith("/super-admin") && !next.startsWith("//") ? next : "/super-admin");

export function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const expired = params.get("reason") === "expired";
  const [step, setStep] = useState<1 | 2>(1);
  const [factor, setFactor] = useState<"email" | "totp">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Next.js keeps a visited page alive (hidden) and shows it again on the next visit, so without
  // this, signing out landed back on step 2 with the old code still filled in. Start over instead.
  useLayoutEffect(
    () => () => {
      setStep(1);
      setPassword("");
      setDevCode(null);
      setError(null);
    },
    [],
  );

  // Already signed in as a super admin (e.g. another tab): straight in.
  useEffect(() => {
    resumeAdminSession()
      .then((ok) => ok && router.replace(next))
      .catch(() => undefined);
  }, [router, next]);

  const enter = async () => {
    try {
      await checkAdminAccess();
      queueWelcome();
      router.replace(next);
    } catch (e) {
      await signOut().catch(() => undefined);
      throw e instanceof ApiError && e.code === "FORBIDDEN" ? new Error("This account isn't a Super Admin account.") : e;
    }
  };

  return (
    <div className="sa-root min-h-screen flex flex-col lg:flex-row" style={{ background: "#FFFFFF" }}>
      <BrandPanel />
      <MobileHeader />

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-5 sm:px-10 py-10 lg:py-16 [@media(max-height:820px)]:lg:py-8">
          <div className="w-full max-w-[400px]">
            {step === 1 ? (
              <PasswordStep
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                remember={remember}
                setRemember={setRemember}
                error={error ?? (expired ? "Your session ended. Please sign in again." : null)}
                setError={setError}
                onCode={(f, code) => {
                  setFactor(f);
                  setDevCode(code ?? null);
                  setStep(2);
                }}
                onSignedIn={enter}
              />
            ) : (
              <CodeStep
                email={email.trim()}
                factor={factor}
                devCode={devCode}
                setDevCode={setDevCode}
                onBack={() => {
                  setStep(1);
                  setError(null);
                }}
                onExpired={(message) => {
                  setStep(1);
                  setPassword("");
                  setError(message);
                }}
                onVerified={async (trust) => {
                  await enter();
                  if (trust) rememberTrust(email);
                }}
              />
            )}

            <p className="mt-8 pt-6 border-t text-[13.5px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Author, reviewer or chair?{" "}
              <a href="/login" className="sa-focus inline-flex items-center gap-1 font-semibold hover:underline underline-offset-2" style={{ color: "var(--primary)" }}>
                Sign in to Smartconferu <ArrowRight size={14} />
              </a>
            </p>
          </div>
        </div>

        <footer className="px-5 sm:px-10 pb-8">
          <div className="max-w-[400px] mx-auto flex items-start gap-3">
            <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: "var(--muted)", color: "var(--text-soft)" }}>
              <Lock size={15} />
            </span>
            <div className="text-[12.5px] leading-snug">
              <p className="font-semibold" style={{ color: "var(--text-soft)" }}>
                Restricted administrative area
              </p>
              <p style={{ color: "var(--text-muted)" }}>All sign-ins and administrative actions are recorded in the audit log.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ---------- shared form pieces ---------- */

/* Replaces the step indicator once the typed email belongs to a trusted device: one step only. */
function TrustedIndicator({ until }: { until: Date }) {
  return (
    <div className="flex items-center gap-3 mb-8 sa-pop">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--success)", boxShadow: "0 0 0 4px var(--success-soft)" }} aria-hidden="true" />
      <p className="text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text)" }}>Trusted device</span> · password only until {fmtTrustDate(until)}
      </p>
    </div>
  );
}

/* ●━━━○  Step 1 of 2 · Password; the line fills once step 1 is done. */
function StepIndicator({ step }: { step: 1 | 2 }) {
  const dot = (n: number) => {
    const on = n <= step;
    return (
      <span
        className="w-2.5 h-2.5 rounded-full transition-[background-color,box-shadow] duration-200"
        style={{ background: on ? "var(--primary)" : "#FFFFFF", border: on ? "none" : "1.5px solid var(--border-strong)", boxShadow: n === step ? "0 0 0 4px var(--primary-soft)" : "none" }}
      />
    );
  };
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="flex items-center" aria-hidden="true">
        {dot(1)}
        <span className="w-10 h-[2px] mx-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <span className="block h-full transition-[width] duration-300" style={{ width: step > 1 ? "100%" : "0%", background: "var(--primary)" }} />
        </span>
        {dot(2)}
      </div>
      <p className="text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text)" }}>Step {step} of 2</span> · {step === 1 ? "Password" : "Verification code"}
      </p>
    </div>
  );
}

function AccessBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em]"
      style={{ background: "var(--primary-soft)", color: "var(--primary)", border: "1px solid var(--primary-soft-border)" }}
    >
      <ShieldCheck size={13} strokeWidth={2.2} /> Super admin access
    </span>
  );
}

function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h1 className="text-[26px] sm:text-[28px] font-bold tracking-[-0.02em] leading-tight mt-4" style={{ color: "var(--text)" }}>
        {title}
      </h1>
      <p className="text-[14.5px] leading-relaxed mt-2 mb-8" style={{ color: "var(--text-muted)" }}>
        {children}
      </p>
    </>
  );
}

function Notice({ tone, icon: Icon, role, children }: { tone: "danger" | "info"; icon: LucideIcon; role?: "alert" | "status"; children: ReactNode }) {
  const colors = tone === "danger" ? { background: "var(--danger-soft)", color: "var(--danger-ink)" } : { background: "var(--muted)", color: "var(--text-soft)" };
  return (
    <div role={role} className="sa-pop flex gap-2.5 text-[13px] leading-snug rounded-[10px] px-3.5 py-3 mb-5" style={colors}>
      <Icon size={16} className="shrink-0 mt-px" style={{ color: tone === "info" ? "var(--primary)" : undefined }} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-[12.5px] font-medium mt-2" style={{ color: "var(--danger-ink)" }}>
      <CircleAlert size={14} aria-hidden="true" />
      {children}
    </p>
  );
}

function SubmitButton({ busy, disabled, busyLabel, children }: { busy: boolean; disabled?: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button type="submit" className="sa-auth-btn cursor-pointer" disabled={disabled || busy} aria-busy={busy}>
      {busy ? (
        <>
          <Loader2 size={18} className="sa-spin" aria-hidden="true" />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/* ---------- step 1: email + password ---------- */

function PasswordStep(props: {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  onCode: (factor: "email" | "totp", devCode?: string) => void;
  onSignedIn: () => Promise<void>;
}) {
  const { email, setEmail, password, setPassword, remember, setRemember, error, setError, onCode, onSignedIn } = props;
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [locked, setLocked] = useState<string | null>(null);
  const trusted = trustedUntil(email); // re-read as the email changes
  const [showPw, setShowPw] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const empty = { email: email.trim() ? undefined : "Enter your work email.", password: password ? undefined : "Enter your password." };
    if (empty.email || empty.password) {
      setMissing(empty);
      document.getElementById(empty.email ? "sa-email" : "sa-password")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await signInWithPassword(email.trim(), password, remember);
      if (res.kind === "code") onCode(res.factor ?? "email", res.devCode);
      else await onSignedIn();
    } catch (err) {
      // A wrong password counts towards the lock; anything else (no admin access, network) just shows.
      if (err instanceof ApiError && err.code === "AUTH_ACCOUNT_LOCKED") {
        setLocked(err.message);
      } else if (err instanceof ApiError && err.code === "AUTH_INVALID_CREDENTIALS") {
        const left = attemptsLeft - 1;
        setAttemptsLeft(left);
        setError(left > 0 ? `Wrong email or password. ${left} ${left === 1 ? "attempt" : "attempts"} left before a ${LOCK_MINUTES}-minute lock.` : "Wrong email or password.");
      } else {
        setError(err instanceof Error ? err.message : "Couldn't sign you in.");
      }
    } finally {
      setBusy(false);
    }
  };
  const trackCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));
  const clearError = () => error && setError(null);

  return (
    <form onSubmit={submit} noValidate className="sa-rise" aria-describedby={error ? "sa-login-error" : undefined}>
      {trusted ? <TrustedIndicator until={trusted} /> : <StepIndicator step={1} />}
      <AccessBadge />
      <Heading title="Sign in to the admin console">Manage conference approvals, licenses and platform operations from one secure workspace.</Heading>

      {locked && (
        <Notice tone="danger" icon={Lock} role="alert">
          <p className="font-semibold">Sign-in locked for {LOCK_MINUTES} minutes</p>
          <p className="mt-0.5" style={{ color: "var(--text-soft)" }}>
            {locked}
          </p>
        </Notice>
      )}
      {error && !locked && (
        <Notice tone="danger" icon={CircleAlert} role="alert">
          <span id="sa-login-error">{error}</span>
        </Notice>
      )}

      <div className="mb-5">
        <label htmlFor="sa-email" className="block text-[13.5px] font-medium mb-2" style={{ color: "var(--text)" }}>
          Work email
        </label>
        <div className="relative">
          <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} aria-hidden="true" />
          <input
            id="sa-email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError();
              setMissing((m) => ({ ...m, email: undefined }));
            }}
            placeholder="you@smartconferu.com"
            aria-invalid={missing.email || error ? "true" : "false"}
            aria-describedby={missing.email ? "sa-email-msg" : undefined}
            className="sa-auth-input !pl-11"
          />
        </div>
        {missing.email && <FieldError id="sa-email-msg">{missing.email}</FieldError>}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="sa-password" className="text-[13.5px] font-medium" style={{ color: "var(--text)" }}>
            Password
          </label>
          <button
            type="button"
            onClick={() => setForgot((f) => !f)}
            aria-expanded={forgot}
            aria-controls="sa-forgot"
            className="sa-focus text-[13px] font-medium hover:underline underline-offset-2 cursor-pointer"
            style={{ color: "var(--primary)" }}
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} aria-hidden="true" />
          <input
            id="sa-password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
              setMissing((m) => ({ ...m, password: undefined }));
            }}
            onKeyDown={trackCaps}
            onKeyUp={trackCaps}
            onBlur={() => setCapsLock(false)}
            aria-invalid={missing.password || error ? "true" : "false"}
            aria-describedby={missing.password ? "sa-password-msg" : undefined}
            className="sa-auth-input !pl-11 !pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? "Hide password" : "Show password"}
            aria-pressed={showPw}
            className="sa-focus absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)] cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {missing.password ? (
          <FieldError id="sa-password-msg">{missing.password}</FieldError>
        ) : (
          capsLock && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium mt-2" style={{ color: "var(--warning-ink)" }} role="status">
              <CircleAlert size={14} aria-hidden="true" /> Caps Lock is on
            </p>
          )
        )}
      </div>

      {forgot && (
        <div id="sa-forgot">
          <Notice tone="info" icon={Info}>
            Your admin account uses the same password as your Smartconferu account. Reset it with{" "}
            <a href="/login" className="font-semibold underline underline-offset-2">
              Forgot password?
            </a>{" "}
            on the Smartconferu sign-in page, then come back here.
          </Notice>
        </div>
      )}

      <label className="inline-flex items-center gap-2.5 text-[13.5px] mb-6 select-none" style={{ color: "var(--text-soft)" }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer" />
        Keep me signed in on this device
      </label>

      <SubmitButton busy={busy} busyLabel="Checking…">
        {trusted ? "Sign in" : "Continue"} <ArrowRight size={17} className="sa-arrow" aria-hidden="true" />
      </SubmitButton>
      <p className="flex items-center justify-center gap-1.5 text-[12.5px] mt-3" style={{ color: "var(--text-muted)" }}>
        {trusted ? (
          <>
            <ShieldCheck size={13} aria-hidden="true" style={{ color: "var(--success-ink)" }} /> This device is trusted, so no code is needed
          </>
        ) : (
          <>
            <KeyRound size={13} aria-hidden="true" /> Next, you&apos;ll enter a {CODE_LENGTH}-digit code
          </>
        )}
      </p>
    </form>
  );
}

/* ---------- step 2: 6-digit code ----------
   Typing moves to the next box, Backspace goes back, pasting a whole code fills every box. */

function CodeStep(props: {
  email: string;
  factor: "email" | "totp";
  devCode: string | null;
  setDevCode: (v: string | null) => void;
  onBack: () => void;
  onExpired: (message: string) => void;
  onVerified: (trust: boolean) => Promise<void>;
}) {
  const { email, factor, devCode, setDevCode, onBack, onExpired, onVerified } = props;
  // Off by default so a shared computer is never trusted by accident.
  const [trust, setTrust] = useState(false);
  const [digits, setDigits] = useState<string[]>(() => (devCode ? devCode.split("").slice(0, CODE_LENGTH) : emptyCode()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(factor === "email" ? RESEND_SECONDS : 0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const complete = digits.every((d) => d !== "");

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const set = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    setError("");
    if (clean.length > 1) {
      const all = clean.slice(0, CODE_LENGTH).split("");
      setDigits(Array.from({ length: CODE_LENGTH }, (_, k) => all[k] ?? ""));
      refs.current[Math.min(all.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, k) => (k === i ? clean : x)));
    if (clean && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await verifyCode(digits.join(""), factor === "email" && trust);
      await onVerified(factor === "email" && trust);
    } catch (err) {
      setBusy(false);
      const message = err instanceof Error ? err.message : "That code didn't work.";
      if (err instanceof ApiError && err.code === "AUTH_SESSION_EXPIRED") {
        onExpired(message);
        return;
      }
      setError(message);
      setDigits(emptyCode());
      refs.current[0]?.focus();
    }
  };

  const resend = async () => {
    setError("");
    setInfo("");
    try {
      const res = await resendCode();
      setCooldown(RESEND_SECONDS);
      setInfo("We've sent a new code. Only the newest code works.");
      if (res.devCode) {
        setDevCode(res.devCode);
        setDigits(res.devCode.split("").slice(0, CODE_LENGTH));
      } else {
        setDigits(emptyCode());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a new code.");
    }
  };

  return (
    <form onSubmit={submit} className="sa-rise">
      <StepIndicator step={2} />
      <AccessBadge />
      <Heading title="Two-step verification">
        {factor === "email" ? (
          <>
            We&apos;ve emailed a {CODE_LENGTH}-digit code to{" "}
            <b className="font-semibold" style={{ color: "var(--text)" }}>
              {email}
            </b>
            . It expires in 10 minutes.
          </>
        ) : (
          <>Enter the {CODE_LENGTH}-digit code from your authenticator app, or a recovery code.</>
        )}
      </Heading>

      {error && (
        <Notice tone="danger" icon={CircleAlert} role="alert">
          {error}
        </Notice>
      )}
      {info && !error && (
        <Notice tone="info" icon={Check} role="status">
          {info}
        </Notice>
      )}

      <div className="flex gap-2 sm:gap-2.5 mb-6" role="group" aria-label={`${CODE_LENGTH}-digit verification code`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs.current[i - 1]?.focus()}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={CODE_LENGTH}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
            className="sa-auth-input !h-[54px] !w-0 flex-1 !px-0 text-center !text-[20px] font-semibold"
          />
        ))}
      </div>

      {factor === "email" && (
        <label className="flex items-start gap-2.5 mb-6 select-none">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-[var(--primary)] cursor-pointer" aria-describedby="sa-trust-help" />
          <span>
            <span className="block text-[13.5px]" style={{ color: "var(--text-soft)" }}>
              Trust this device for {TRUST_DAYS} days
            </span>
            <span id="sa-trust-help" className="block text-[12.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              You won&apos;t be asked for a code here until then. Don&apos;t tick this on a shared computer.
            </span>
          </span>
        </label>
      )}

      <SubmitButton busy={busy} disabled={!complete} busyLabel="Verifying…">
        <ShieldCheck size={17} aria-hidden="true" /> Verify and sign in
      </SubmitButton>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-[13px]">
        <button type="button" onClick={onBack} className="sa-focus inline-flex items-center gap-1.5 font-medium cursor-pointer" style={{ color: "var(--text-soft)" }}>
          <ArrowLeft size={15} aria-hidden="true" /> Back
        </button>
        {factor === "email" && (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={cooldown > 0}
            className="sa-focus font-medium hover:underline underline-offset-2 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
            style={{ color: cooldown > 0 ? "var(--text-muted)" : "var(--primary)" }}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        )}
      </div>

      {devCode ? (
        <div className="mt-8 rounded-xl px-4 py-3 flex items-center gap-2 text-[12.5px]" style={{ background: "var(--canvas)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <span className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
            Development
          </span>
          No email is sent yet, so the code was filled in for you.
        </div>
      ) : (
        factor === "email" && (
          <p className="mt-6 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Not in your inbox? Check spam. The code works once.
          </p>
        )
      )}
    </form>
  );
}

/* ---------- brand panel (desktop) ---------- */

const PUBLIC_STATS = [
  ["340+", "Conferences"],
  ["12,400+", "Researchers"],
  ["58,000+", "Papers"],
];

function BrandBackground() {
  return (
    <>
      <div className="absolute inset-0" style={{ background: "var(--gradient-header)" }} />
      <div className="absolute -top-56 -right-40 w-[620px] h-[620px] rounded-full" style={{ background: "radial-gradient(circle,rgba(99,102,241,0.28),rgba(99,102,241,0) 62%)" }} />
      <div className="absolute -bottom-64 -left-40 w-[560px] h-[560px] rounded-full" style={{ background: "radial-gradient(circle,rgba(124, 58, 237,0.22),rgba(124, 58, 237,0) 65%)" }} />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
          WebkitMaskImage: "linear-gradient(180deg,#000,transparent 75%)",
          maskImage: "linear-gradient(180deg,#000,transparent 75%)",
        }}
      />
    </>
  );
}

function BrandPanel() {
  return (
    <aside className="hidden lg:flex relative lg:sticky lg:top-0 lg:self-start lg:h-screen lg:w-[46%] xl:w-1/2 shrink-0 overflow-hidden">
      <BrandBackground />
      <div className="relative z-[1] flex flex-col w-full max-w-[760px] 2xl:max-w-[860px] mx-auto px-10 xl:px-14 py-8 [@media(min-height:900px)]:py-10">
        <span className="inline-flex self-start rounded-xl bg-white px-3.5 py-2" style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
          <Image src="/smartconferu-lockup.png" alt="Smartconferu" width={111} height={28} className="h-7 w-auto" />
        </span>

        <div className="mt-8 [@media(min-height:900px)]:mt-12">
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--primary-soft-border)" }}>
            <span className="w-6 h-px" style={{ background: "var(--primary-soft-border)" }} /> Super Admin Console
          </p>
          <h2 className="text-white text-[30px] xl:text-[36px] font-bold leading-[1.15] tracking-[-0.02em] mt-3">
            One command center for
            <br />
            <span style={{ background: "linear-gradient(90deg,#C4B5FD 0%,#C4B5FD 45%,#67E8F9 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>every conference.</span>
          </h2>
          <p className="text-[14.5px] leading-relaxed mt-3 max-w-[440px] [@media(max-height:780px)]:hidden" style={{ color: "rgba(255,255,255,0.62)" }}>
            Oversee conferences, licenses, CFPs and platform-wide operations from one secure workspace.
          </p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col py-4 -mx-4">
          <PlatformScene />
        </div>

        <div className="[@media(max-height:720px)]:hidden">
          <ModuleStrip />
        </div>

        <dl className="grid grid-cols-3 mt-6 pt-5 border-t [@media(max-height:800px)]:mt-4 [@media(max-height:800px)]:pt-4" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          {PUBLIC_STATS.map(([n, label], i) => (
            <div key={label} className={`flex flex-col items-center text-center ${i ? "border-l" : ""}`} style={{ borderColor: "rgba(255,255,255,0.14)" }}>
              <dt className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                {label}
              </dt>
              <dd className="order-first text-white text-[20px] font-semibold tracking-tight">{n}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

/* ---------- mobile header (replaces the brand panel below lg) ---------- */

function MobileHeader() {
  return (
    <header className="lg:hidden relative overflow-hidden">
      <BrandBackground />
      <div className="relative z-[1] max-w-[400px] mx-auto box-content px-5 sm:px-10 pt-5 pb-6">
        <span className="inline-flex rounded-lg bg-white px-3 py-1.5" style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
          <Image src="/smartconferu-lockup.png" alt="Smartconferu" width={95} height={24} className="h-6 w-auto" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mt-6" style={{ color: "var(--primary-soft-border)" }}>
          Super Admin Console
        </p>
        <p className="text-white text-[19px] font-bold leading-snug tracking-[-0.01em] mt-1.5 max-w-[340px]">One command center for every conference.</p>
      </div>
    </header>
  );
}
