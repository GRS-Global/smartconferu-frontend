"use client";
/* The Super Admin console's own "Forgot password?" and "Choose a new password" pages, in the console's sign-in layout. They do not
   use the website's /login or /reset-password: the API emails super admins a link to /super-admin/reset-password. */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { ApiError } from "../api";
import { resetAdminPassword, sendAdminPasswordReset } from "../services";
import { AccessBadge, AdminAuthShell, FieldError, Heading, Notice, SubmitButton } from "./login-page";
import { emailProblem, isValidEmail } from "@/lib/email";

// Match the API (core/auth/password.service.ts).
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

function BackToSignIn() {
  return (
    <Link href="/super-admin/login" className="sa-focus inline-flex items-center gap-1.5 text-[13.5px] font-semibold hover:underline underline-offset-2 mt-5" style={{ color: "var(--primary)" }}>
      <ArrowLeft size={15} aria-hidden="true" /> Back to sign in
    </Link>
  );
}

/* ---------- /super-admin/forgot-password ---------- */

export function AdminForgotPasswordPage() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const to = email.trim();
    if (!to || !isValidEmail(to)) {
      setFieldError(to ? emailProblem(to) : "Enter your work email.");
      document.getElementById("sa-forgot-email")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendAdminPasswordReset(to);
      setSentTo(to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AdminAuthShell>
        <div className="sa-rise" role="status">
          <AccessBadge />
          <Heading title="Check your email">If <b>{sentTo}</b> belongs to a Super Admin account, we&apos;ve sent it a link to choose a new password.</Heading>
          <Notice tone="info" icon={Mail}>
            The link works once and expires after an hour. It opens this console&apos;s own reset page. Don&apos;t see it? Check your spam folder, or send it again.
          </Notice>
          <button type="button" onClick={() => setSentTo(null)} className="sa-focus text-[13.5px] font-semibold hover:underline underline-offset-2 cursor-pointer" style={{ color: "var(--primary)" }}>
            Use another address or send again
          </button>
          <div>
            <BackToSignIn />
          </div>
        </div>
      </AdminAuthShell>
    );
  }

  return (
    <AdminAuthShell>
      <form onSubmit={submit} noValidate className="sa-rise">
        <AccessBadge />
        <Heading title="Forgot your password?">Enter the work email of your Super Admin account. We&apos;ll email you a link to choose a new password.</Heading>
        {error && (
          <Notice tone="danger" icon={CircleAlert} role="alert">
            {error}
          </Notice>
        )}
        <div className="mb-6">
          <label htmlFor="sa-forgot-email" className="block text-[13.5px] font-medium mb-2" style={{ color: "var(--text)" }}>
            Work email
          </label>
          <div className="relative">
            <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} aria-hidden="true" />
            <input
              id="sa-forgot-email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError(null);
                setError(null);
              }}
              placeholder="you@smartconferu.com"
              aria-invalid={fieldError ? "true" : "false"}
              aria-describedby={fieldError ? "sa-forgot-email-msg" : undefined}
              className="sa-auth-input !pl-11"
            />
          </div>
          {fieldError && <FieldError id="sa-forgot-email-msg">{fieldError}</FieldError>}
        </div>
        <SubmitButton busy={busy} busyLabel="Sending…">
          Send reset link <ArrowRight size={17} className="sa-arrow" aria-hidden="true" />
        </SubmitButton>
        <BackToSignIn />
      </form>
    </AdminAuthShell>
  );
}

/* ---------- /super-admin/reset-password?token=… ---------- */

function PasswordInput({ id, label, value, onChange, show, onToggle, invalid, describedBy, autoFocus }: { id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; invalid: boolean; describedBy?: string; autoFocus?: boolean }) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-[13.5px] font-medium mb-2" style={{ color: "var(--text)" }}>
        {label}
      </label>
      <div className="relative">
        <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }} aria-hidden="true" />
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          maxLength={MAX_LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid ? "true" : "false"}
          aria-describedby={describedBy}
          className="sa-auth-input !pl-11 !pr-12"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="sa-focus absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--muted)] cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

export function AdminResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [linkBad, setLinkBad] = useState(!token);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const local =
      password.length < MIN_LENGTH ? `Use at least ${MIN_LENGTH} characters.` : password.length > MAX_LENGTH ? `Use at most ${MAX_LENGTH} characters.` : password !== password2 ? "The two passwords don't match." : null;
    if (local) {
      setProblem(local);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await resetAdminPassword(token, password);
      setDone(true);
    } catch (err) {
      // A used / expired / mangled link: offer a new one. A password the API refuses (too weak…) shows its message.
      const badLink = err instanceof ApiError && (err.code === "AUTH_INVALID_LINK" || (err.code === "VALIDATION_FAILED" && JSON.stringify(err.details ?? "").includes('"token"')));
      if (badLink) setLinkBad(true);
      else setProblem(err instanceof Error ? err.message : "Couldn't save the new password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (linkBad) {
    return (
      <AdminAuthShell>
        <div className="sa-rise">
          <AccessBadge />
          <Heading title="This link has expired">Reset links work once and expire after an hour. Ask for a new one and use the newest email.</Heading>
          <Link href="/super-admin/forgot-password" className="sa-auth-btn">
            Send a new link <ArrowRight size={17} className="sa-arrow" aria-hidden="true" />
          </Link>
          <BackToSignIn />
        </div>
      </AdminAuthShell>
    );
  }

  if (done) {
    return (
      <AdminAuthShell>
        <div className="sa-rise" role="status">
          <AccessBadge />
          <Heading title="Password changed">Your new password is set. For safety, every device was signed out. Sign in to the console with the new password.</Heading>
          <Link href="/super-admin/login" className="sa-auth-btn">
            <Check size={17} aria-hidden="true" /> Go to sign in
          </Link>
        </div>
      </AdminAuthShell>
    );
  }

  return (
    <AdminAuthShell>
      <form onSubmit={submit} noValidate className="sa-rise" aria-describedby={problem ? "sa-reset-error" : undefined}>
        <AccessBadge />
        <Heading title="Choose a new password">Set a new password for your Super Admin account. Use at least {MIN_LENGTH} characters.</Heading>
        {problem && (
          <Notice tone="danger" icon={CircleAlert} role="alert">
            <span id="sa-reset-error">{problem}</span>
          </Notice>
        )}
        <PasswordInput id="sa-new-password" label="New password" value={password} onChange={(v) => { setPassword(v); setProblem(null); }} show={show} onToggle={() => setShow((s) => !s)} invalid={!!problem} autoFocus />
        <PasswordInput id="sa-new-password2" label="Repeat new password" value={password2} onChange={(v) => { setPassword2(v); setProblem(null); }} show={show} onToggle={() => setShow((s) => !s)} invalid={!!problem && password !== password2} />
        <div className="mt-1">
          <SubmitButton busy={busy} busyLabel="Saving…">
            <KeyRound size={17} aria-hidden="true" /> Save new password
          </SubmitButton>
        </div>
        <BackToSignIn />
      </form>
    </AdminAuthShell>
  );
}
