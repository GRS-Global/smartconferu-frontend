"use client";
/* Super Admin sign-in (the prototype's AdminLogin): step 1 work email + password, step 2 the
   6-digit code the API emails to the admin (or the authenticator-app code when they set one up).
   Only a super admin in a verified session gets into the console. */
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { ApiError } from "../api";
import { checkAdminAccess, resendCode, resumeAdminSession, signInWithPassword, signOut, verifyCode } from "../services";

const CODE_LENGTH = 6;
const safeNext = (next: string | null) => (next && next.startsWith("/super-admin") && !next.startsWith("//") ? next : "/super-admin");

export function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [step, setStep] = useState<1 | 2>(1);
  const [factor, setFactor] = useState<"email" | "totp">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("reason") === "expired" ? "Your session ended. Please sign in again." : null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Already signed in as a super admin (e.g. another tab): straight in.
  useEffect(() => {
    resumeAdminSession()
      .then((ok) => ok && router.replace(next))
      .catch(() => undefined);
  }, [router, next]);

  const enter = async () => {
    try {
      await checkAdminAccess();
      router.replace(next);
    } catch (e) {
      await signOut().catch(() => undefined);
      throw e instanceof ApiError && e.code === "FORBIDDEN" ? new Error("This account isn't a Super Admin account.") : e;
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your work email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await signInWithPassword(email.trim(), password);
      if (res.kind === "code") {
        setFactor(res.factor ?? "email");
        setStep(2);
        setDigits(Array(CODE_LENGTH).fill(""));
        setTimeout(() => inputs.current[0]?.focus(), 0);
      } else {
        await enter();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  };

  const code = digits.join("");
  const submitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError(`Enter all ${CODE_LENGTH} digits.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode(code);
      await enter();
    } catch (err) {
      if (err instanceof ApiError && err.code === "AUTH_SESSION_EXPIRED") {
        setStep(1);
        setPassword("");
      }
      setError(err instanceof Error ? err.message : "That code didn't work.");
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted a whole code.
      const all = clean.slice(0, CODE_LENGTH).split("");
      setDigits([...all, ...Array(CODE_LENGTH - all.length).fill("")]);
      inputs.current[Math.min(all.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, j) => (j === i ? clean : x)));
    if (clean && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const resend = async () => {
    setError(null);
    setNotice(null);
    try {
      await resendCode();
      setNotice("We've sent a new code. Only the newest code works.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a new code.");
    }
  };

  return (
    <div className="sa-root grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" style={{ background: "#FFFFFF" }}>
      <div className="min-h-screen flex flex-col px-6 sm:px-12 py-8">
        <div className="flex items-center gap-2">
          <Image src="/smartconferu-lockup.png" alt="Smartconferu" width={160} height={32} priority className="h-8 w-auto" />
          <span className="text-[10.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            Admin
          </span>
        </div>
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-[420px] mx-auto">
            <p className="text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text)" }}>Step {step} of 2</span> · {step === 1 ? "Password" : "Verification code"}
            </p>
            <h1 className="text-[26px] sm:text-[28px] font-bold tracking-[-0.02em] leading-tight mt-4" style={{ color: "var(--text)" }}>
              {step === 1 ? "Sign in to the admin console" : "Check your email"}
            </h1>
            <p className="text-[14px] mt-2 mb-7" style={{ color: "var(--text-muted)" }}>
              {step === 1 ? (
                "Restricted administrative area. Use your Super Admin account."
              ) : factor === "email" ? (
                <>
                  We&apos;ve emailed a {CODE_LENGTH}-digit code to <b style={{ color: "var(--text)" }}>{email}</b>. It expires in 10 minutes.
                </>
              ) : (
                <>Enter the {CODE_LENGTH}-digit code from your authenticator app.</>
              )}
            </p>

            {error && (
              <div role="alert" className="mb-5 rounded-xl px-4 py-3 text-[13.5px]" style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger-border-soft)" }}>
                {error}
              </div>
            )}
            {notice && !error && (
              <div role="status" className="mb-5 rounded-xl px-4 py-3 text-[13.5px]" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                {notice}
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={submitPassword} noValidate>
                <label htmlFor="sa-email" className="text-[13.5px] font-medium" style={{ color: "var(--text)" }}>
                  Work email
                </label>
                <div className="relative mt-1.5 mb-5">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
                  <input id="sa-email" type="email" autoComplete="username" className="sa-auth-input !pl-11" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@smartconferu.com" autoFocus />
                </div>
                <label htmlFor="sa-password" className="text-[13.5px] font-medium" style={{ color: "var(--text)" }}>
                  Password
                </label>
                <div className="relative mt-1.5 mb-6">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
                  <input id="sa-password" type={showPw ? "text" : "password"} autoComplete="current-password" className="sa-auth-input !pl-11 !pr-12" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="sa-icon-btn absolute right-1 top-1/2 -translate-y-1/2" aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button type="submit" className="sa-auth-btn" disabled={busy} aria-busy={busy}>
                  {busy ? <Loader2 size={18} className="sa-spin" /> : <>Continue <ArrowRight size={18} className="sa-arrow" /></>}
                </button>
              </form>
            ) : (
              <form onSubmit={submitCode}>
                <div className="flex gap-2 sm:gap-2.5 mb-6" role="group" aria-label={`${CODE_LENGTH}-digit verification code`}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      className="sa-auth-input !w-12 !px-0 text-center !text-[20px] font-semibold"
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={i === 0 ? CODE_LENGTH : 1}
                      value={d}
                      aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                      }}
                    />
                  ))}
                </div>
                <button type="submit" className="sa-auth-btn" disabled={busy || code.length !== CODE_LENGTH} aria-busy={busy}>
                  {busy ? <Loader2 size={18} className="sa-spin" /> : <>Verify and sign in <ShieldCheck size={18} /></>}
                </button>
                <div className="flex items-center justify-between mt-5 text-[13.5px]">
                  <button type="button" className="font-semibold hover:underline" style={{ color: "var(--text-soft)" }} onClick={() => { setStep(1); setError(null); setNotice(null); }}>
                    Back
                  </button>
                  {factor === "email" && (
                    <button type="button" className="font-semibold hover:underline" style={{ color: "var(--primary)" }} onClick={() => void resend()}>
                      Send a new code
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
        <p className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--text-faint)" }}>
          <KeyRound size={14} /> Every sign-in is recorded in the activity log.
        </p>
      </div>
      <div className="hidden lg:flex min-h-screen items-end p-12" style={{ background: "var(--gradient-dark)" }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--primary-soft-border)" }}>
            Super Admin Console
          </p>
          <p className="text-white text-[30px] xl:text-[36px] font-bold leading-[1.15] tracking-[-0.02em] mt-3 max-w-[460px]">One command center for every conference.</p>
          <p className="text-[14px] mt-3 max-w-[420px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            Approve new conferences, handle deletion requests, keep the master lists and the platform&apos;s emails in order.
          </p>
        </div>
      </div>
    </div>
  );
}
