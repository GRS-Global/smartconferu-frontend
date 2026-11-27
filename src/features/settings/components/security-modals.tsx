"use client";

import { Check, Copy, Download, Laptop, LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { Modal } from "@/components/ui/modal";
import { PasswordField } from "@/components/ui/password-field";
import { LOGIN_PATH } from "@/lib/auth-redirect";
import {
  beginTotpSetup, completeMerge, disableTotp, enableTotp, listSessions, mfaStatus, newRecoveryCodes, requestEmailChange, requestMerge,
  signOutDevice, signOutEverywhere, type MfaStatus, type SessionInfo, type TotpSetup,
} from "@/services/api/security";
import { AuthRequiredError, MfaRequiredError } from "@/services/errors";

/* Security & Settings › Account & Security, own-backend screens: two-step verification, signed-in devices, the sign-in email address and
   connecting a new provider-only sign-in to an existing account. Each talks to Backend/src/modules/auth/account.controller.ts through
   services/api/security.ts; the backend's messages are ready to show. */

const INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary";
const LABEL = "mb-1 block text-xs font-semibold text-ink-soft";
const PRIMARY = "w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";
const GHOST = "cursor-pointer rounded-lg border-[1.5px] border-line px-3.5 py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50";
/** The 6-digit code of the authenticator app, or a recovery code (xxxx-xxxx): what the backend accepts. */
const CODE = /^(\d{6}|[a-zA-Z0-9]{4}-?[a-zA-Z0-9]{4})$/;

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong — please try again.");

/** Runs a request with a busy flag and an error line; an ended session is reported to the caller instead of shown. */
function useAction(onAuthEnded?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError("");
    try { return await fn(); }
    catch (e) { if (e instanceof AuthRequiredError && onAuthEnded) onAuthEnded(); else setError(messageOf(e)); return undefined; }
    finally { setBusy(false); }
  }, [onAuthEnded]);
  return { busy, error, setError, run };
}

/* ------------------------------------------------------------------ two-step verification */

type TwoStepView =
  | { kind: "loading" }
  | { kind: "status"; status: MfaStatus }
  | { kind: "setup"; setup: TotpSetup }
  | { kind: "codes"; codes: string[]; why: string }
  | { kind: "ask"; action: "disable" | "codes"; status: MfaStatus };

function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Smartconferu recovery codes\nEach code works once.\n\n${text}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "smartconferu-recovery-codes.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <ul className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-line bg-canvas p-4 font-mono text-sm text-ink" aria-label="Recovery codes">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex gap-2">
        <button type="button" onClick={() => void copy()} className={GHOST}>{copied ? <><Check size={13} className="mr-1 inline" aria-hidden="true" />Copied</> : <><Copy size={13} className="mr-1 inline" aria-hidden="true" />Copy</>}</button>
        <button type="button" onClick={download} className={GHOST}><Download size={13} className="mr-1 inline" aria-hidden="true" />Download</button>
      </div>
    </>
  );
}

export function TwoStepModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [view, setView] = useState<TwoStepView>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [loadError, setLoadError] = useState("");
  const ended = useCallback(() => router.replace(LOGIN_PATH), [router]);
  const { busy, error, setError, run } = useAction(ended);
  const valid = CODE.test(code.trim());

  const load = useCallback(async () => {
    try { setView({ kind: "status", status: await mfaStatus() }); }
    catch (e) { if (e instanceof AuthRequiredError) ended(); else setLoadError(messageOf(e)); }
  }, [ended]);
  // The first load is written out here (not through `load`) so no state is set while the effect runs, only when the answer arrives.
  useEffect(() => {
    let alive = true;
    mfaStatus().then(
      (status) => { if (alive) setView({ kind: "status", status }); },
      (e: unknown) => { if (!alive) return; if (e instanceof AuthRequiredError) ended(); else setLoadError(messageOf(e)); },
    );
    return () => { alive = false; };
  }, [ended]);

  const back = async () => { setCode(""); setError(""); setLoadError(""); setView({ kind: "loading" }); await load(); };
  const startSetup = async () => { const setup = await run(beginTotpSetup); if (setup) { setCode(""); setView({ kind: "setup", setup }); } };
  const confirmSetup = async () => { const codes = await run(() => enableTotp(code)); if (codes) { setCode(""); setView({ kind: "codes", codes, why: "Two-step verification is on. Your other devices were signed out." }); } };
  const submitAsk = async (action: "disable" | "codes") => {
    if (action === "codes") {
      const codes = await run(() => newRecoveryCodes(code));
      if (codes) { setCode(""); setView({ kind: "codes", codes, why: "New recovery codes. The old ones no longer work." }); }
      return;
    }
    if (await run(async () => { await disableTotp(code); return true; })) await back();
  };

  return (
    <Modal title="Two-step verification" subtitle="Ask for a code from an authenticator app when you sign in." icon={ShieldCheck} onClose={onClose} maxWidth="max-w-lg">
      {loadError && <AuthMessage tone="error">{loadError}</AuthMessage>}
      {view.kind === "loading" && !loadError && <p role="status" className="text-sm text-ink-muted">Loading…</p>}

      {view.kind === "status" && (
        <div>
          <div className="mb-4 flex items-center justify-between rounded-xl border border-line px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-ink">Authenticator app</div>
              <div className="text-xs text-ink-faint">{view.status.enabled ? `On · ${view.status.recoveryCodesLeft} recovery code${view.status.recoveryCodesLeft === 1 ? "" : "s"} left` : "Off"}</div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${view.status.enabled ? "bg-success-soft text-success-ink" : "bg-canvas text-ink-muted"}`}>{view.status.enabled ? "On" : "Off"}</span>
          </div>
          {view.status.required && !view.status.enabled && <AuthMessage tone="error">Your account is a Super Admin account: two-step verification has to be on to use the admin features.</AuthMessage>}
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          {!view.status.enabled ? (
            <>
              <p className="mb-4 text-sm leading-relaxed text-ink-muted">When it is on, signing in needs your password (or a login code, or Google/Microsoft/ORCID) <b>and</b> a 6-digit code from an app such as Google Authenticator, Microsoft Authenticator or Authy.</p>
              <button type="button" disabled={busy} onClick={() => void startSetup()} className={PRIMARY}>{busy ? "Starting…" : "Turn on two-step verification"}</button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setCode(""); setError(""); setView({ kind: "ask", action: "codes", status: view.status }); }} className={GHOST}>Get new recovery codes</button>
              <button type="button" onClick={() => { setCode(""); setError(""); setView({ kind: "ask", action: "disable", status: view.status }); }} className={`${GHOST} text-danger-ink`}>Turn off</button>
            </div>
          )}
        </div>
      )}

      {view.kind === "setup" && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void confirmSetup(); }}>
          <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
            <li>In your authenticator app choose <b>Add account → Enter a setup key</b>.</li>
            <li>Type this key (spaces don&apos;t matter):
              <div className="mt-1.5 select-all break-all rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-sm tracking-wider text-ink" aria-label="Setup key">{view.setup.secret.replace(/(.{4})/g, "$1 ").trim()}</div>
              <a href={view.setup.otpauthUrl} className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">On your phone? Open it in your authenticator app</a>
            </li>
            <li>Enter the 6-digit code the app shows:</li>
          </ol>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <label htmlFor="mfa-setup-code" className="sr-only">6-digit code</label>
          <input id="mfa-setup-code" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setError(""); }} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus className={`${INPUT} text-center text-lg font-semibold tracking-[0.3em]`} />
          <button type="submit" disabled={!/^[0-9]{6}$/.test(code) || busy} className={`${PRIMARY} mt-4`}>{busy ? "Checking…" : "Confirm and turn on"}</button>
          <button type="button" onClick={() => void back()} className="mt-3 w-full cursor-pointer text-center text-xs font-semibold text-ink-muted hover:underline">Cancel</button>
        </form>
      )}

      {view.kind === "codes" && (
        <div>
          <AuthMessage>{view.why}</AuthMessage>
          <p className="mb-3 text-sm leading-relaxed text-ink-muted"><b>Save these recovery codes now.</b> Each works once, if you lose your phone. They won&apos;t be shown again.</p>
          <RecoveryCodes codes={view.codes} />
          <button type="button" onClick={() => void back()} className={`${PRIMARY} mt-5`}>I&apos;ve saved them</button>
        </div>
      )}

      {view.kind === "ask" && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (valid && !busy) void submitAsk(view.action); }}>
          <p className="mb-3 text-sm leading-relaxed text-ink-muted">{view.action === "disable" ? "Enter a code from your authenticator app (or a recovery code) to turn two-step verification off." : "Enter a code from your authenticator app (or a recovery code) to get new recovery codes. The old ones stop working."}</p>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <label htmlFor="mfa-ask-code" className="sr-only">Code</label>
          <input id="mfa-ask-code" value={code} onChange={(e) => { setCode(e.target.value.slice(0, 9)); setError(""); }} autoComplete="one-time-code" placeholder="123456" autoFocus className={`${INPUT} text-center text-lg font-semibold tracking-[0.2em]`} />
          <button type="submit" disabled={!valid || busy} className={`${PRIMARY} mt-4 ${view.action === "disable" ? "!bg-danger" : ""}`}>{busy ? "Checking…" : view.action === "disable" ? "Turn off" : "Get new codes"}</button>
          <button type="button" onClick={() => void back()} className="mt-3 w-full cursor-pointer text-center text-xs font-semibold text-ink-muted hover:underline">Cancel</button>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ signed-in devices */

/** "Chrome on Windows" from a user-agent string. */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function SessionsModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const ended = useCallback(() => router.replace(LOGIN_PATH), [router]);
  const { busy, error, run } = useAction(ended);

  const load = useCallback(async () => {
    try { setSessions(await listSessions()); }
    catch (e) { if (e instanceof AuthRequiredError) ended(); else setLoadError(messageOf(e)); }
  }, [ended]);
  useEffect(() => {
    let alive = true;
    listSessions().then(
      (list) => { if (alive) setSessions(list); },
      (e: unknown) => { if (!alive) return; if (e instanceof AuthRequiredError) ended(); else setLoadError(messageOf(e)); },
    );
    return () => { alive = false; };
  }, [ended]);

  const signOut = async (id: string) => { if ((await run(async () => { await signOutDevice(id); return true; })) !== undefined) await load(); };
  const everywhere = async () => {
    if ((await run(async () => { await signOutEverywhere(); return true; })) !== undefined) { router.replace(LOGIN_PATH); router.refresh(); }
  };
  const others = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <Modal title="Active sessions" subtitle="The devices where you are signed in." icon={Laptop} onClose={onClose} maxWidth="max-w-lg">
      {loadError && <AuthMessage tone="error">{loadError}</AuthMessage>}
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      {sessions === null && !loadError && <p role="status" className="text-sm text-ink-muted">Loading…</p>}
      {sessions && (
        <ul className="space-y-2" aria-label="Signed-in devices">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">{describeDevice(s.userAgent)}{s.current && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success-ink">This device</span>}</div>
                <div className="mt-0.5 text-xs text-ink-faint">Last active {when(s.lastActiveAt)}{s.ipAddress ? ` · ${s.ipAddress}` : ""}</div>
                <div className="text-xs text-ink-faint">Signed in {when(s.signedInAt)}</div>
              </div>
              {!s.current && <button type="button" disabled={busy} onClick={() => void signOut(s.id)} className={`${GHOST} shrink-0`}>Sign out</button>}
            </li>
          ))}
        </ul>
      )}
      {sessions && (
        <div className="mt-5 border-t border-muted pt-4">
          <button type="button" disabled={busy} onClick={() => void everywhere()} className={`${GHOST} flex w-full items-center justify-center gap-2 text-danger-ink`}><LogOut size={13} aria-hidden="true" /> Sign out everywhere{others > 0 ? ` (${others + 1} devices)` : ""}</button>
          <p className="mt-2 text-center text-xs text-ink-faint">This also signs you out here.</p>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ sign-in email address */

export function ChangeEmailModal({ currentEmail, hasPassword, onClose }: { currentEmail: string; hasPassword: boolean; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState("");
  const ended = useCallback(() => router.replace(LOGIN_PATH), [router]);
  const { busy, error, setError, run } = useAction(ended);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && (!hasPassword || Boolean(password));

  const submit = async () => {
    if (!valid || busy) return;
    if ((await run(async () => { await requestEmailChange(email, hasPassword ? password : undefined); return true; })) !== undefined) { setSent(email.trim()); setPassword(""); }
  };

  return (
    <Modal title="Change email address" subtitle="The address you sign in with." onClose={onClose} maxWidth="max-w-md">
      {sent ? (
        <div className="py-2 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft"><Check size={22} className="text-success-ink" aria-hidden="true" /></div>
          <p className="text-sm font-semibold text-navy">Check your inbox</p>
          <p className="mb-5 mt-1 text-xs leading-relaxed text-ink-muted">We sent a confirmation link to <b>{sent}</b>. Your address changes when you open it. The link works once and expires after 24 hours. We also told {currentEmail || "your current address"} about the request.</p>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white">Close</button>
        </div>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {currentEmail && <p className="mb-3 text-sm text-ink-muted">Current address: <b className="text-ink">{currentEmail}</b></p>}
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <div className="space-y-3">
            <div>
              <label htmlFor="new-email" className={LABEL}>New email address <span className="text-danger-ink">*</span></label>
              <input id="new-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="name@university.edu" className={INPUT} />
            </div>
            {hasPassword && (
              <div>
                <label htmlFor="email-current-password" className={LABEL}>Your current password <span className="text-danger-ink">*</span></label>
                <PasswordField id="email-current-password" label="current password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} className={INPUT} />
              </div>
            )}
          </div>
          <button type="submit" disabled={!valid || busy} className={`${PRIMARY} mt-4`}>{busy ? "Sending…" : "Send confirmation link"}</button>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ connecting a new provider-only sign-in */

/** Own backend: "Merge accounts" works for one case only — a new sign-in that came without an email (ORCID gives none) can be connected to the
 *  existing account that owns an address, by a code sent to that address. Two accounts that both have an email can't be merged. */
export function ConnectAccountModal({ mainEmail, onClose }: { mainEmail: string; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const ended = useCallback(() => router.replace(LOGIN_PATH), [router]);
  const { busy, error, setError, run } = useAction(ended);

  if (mainEmail) {
    return (
      <Modal title="Merge accounts" onClose={onClose} maxWidth="max-w-md">
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">Merging two accounts that both already have an email address isn&apos;t available.</p>
        <p className="text-sm leading-relaxed text-ink-muted">If you also sign in with Google, Microsoft or ORCID, those sign-ins connect to this account automatically when they use the same verified email address ({mainEmail}). Connected sign-ins are listed under <b>Linked sign-in methods</b>.</p>
        <button type="button" onClick={onClose} className={`${PRIMARY} mt-5`}>Close</button>
      </Modal>
    );
  }

  const send = async () => { if ((await run(async () => { await requestMerge(email); return true; })) !== undefined) { setStep("code"); setCode(""); } };
  const verify = async () => {
    const ok = await run(async () => {
      try { await completeMerge(email, code); return true; }
      catch (e) { if (e instanceof MfaRequiredError) throw new Error("That account uses two-step verification. Sign out and sign in to it directly instead."); throw e; }
    });
    if (ok) { router.replace("/dashboard"); router.refresh(); }
  };

  return (
    <Modal title="Connect to your existing account" subtitle="This sign-in has no email address yet." onClose={onClose} maxWidth="max-w-md">
      {step === "email" ? (
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (/^\S+@\S+\.\S+$/.test(email.trim()) && !busy) void send(); }}>
          <p className="mb-3 text-sm leading-relaxed text-ink-muted">Already have a Smartconferu account? Enter its email address. We&apos;ll send a code to it; entering the code moves this sign-in to that account.</p>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <label htmlFor="merge-email" className={LABEL}>Email address of your existing account</label>
          <input id="merge-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className={INPUT} />
          <button type="submit" disabled={!/^\S+@\S+\.\S+$/.test(email.trim()) || busy} className={`${PRIMARY} mt-4`}>{busy ? "Sending…" : "Send code"}</button>
        </form>
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (/^[0-9]{6}$/.test(code) && !busy) void verify(); }}>
          <p className="mb-3 text-sm leading-relaxed text-ink-muted">If an account exists for <b>{email.trim()}</b>, we sent a 6-digit code to it. Enter it below.</p>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}
          <label htmlFor="merge-code" className="sr-only">6-digit code</label>
          <input id="merge-code" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)); setError(""); }} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus className={`${INPUT} text-center text-lg font-semibold tracking-[0.3em]`} />
          <button type="submit" disabled={!/^[0-9]{6}$/.test(code) || busy} className={`${PRIMARY} mt-4`}>{busy ? "Checking…" : "Connect and sign in"}</button>
          <button type="button" onClick={() => { setStep("email"); setError(""); }} className="mt-3 w-full cursor-pointer text-center text-xs font-semibold text-ink-muted hover:underline">Use a different address</button>
        </form>
      )}
    </Modal>
  );
}
