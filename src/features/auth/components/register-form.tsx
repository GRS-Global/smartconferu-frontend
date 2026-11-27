"use client";

import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { CountrySelect } from "@/components/ui/country-select";
import { PasswordField } from "@/components/ui/password-field";
import { TriggeredEmailNote } from "@/components/ui/triggered-email-note";
import { GENDER_OPTIONS } from "@/features/profile/fields";
import { DepartmentPicker, InstitutionPicker } from "@/features/profile/components/institution-fields";
import { PhoneField } from "@/features/profile/components/phone-field";
import { PhotoField, type PhotoValue } from "@/features/profile/components/photo-field";
import { initialsOf } from "@/features/profile/components/profile-avatar";
import { DEFAULT_AFTER_LOGIN, LOGIN_PATH } from "@/lib/auth-redirect";
import { cn } from "@/lib/cn";
import { AUTH_CONFIGURED, DATA_SOURCE } from "@/lib/config";
import { getProfileService } from "@/services/profile";
import { authService } from "../auth-service";
import { PRIVACY_URL, TERMS_URL } from "../legal-links";
import { REQUIRED_LABELS, useRegisterForm, type RegisterForm as Form } from "../use-register-form";
import { SsoButtons } from "./sso-buttons";

/** The prototype's field look on this page: placeholder-only inputs with a 1.5 px border and a brand focus ring (`.smart-field`). */
const REG_INPUT = "w-full rounded-lg border-[1.5px] border-line px-3.5 py-2.5 text-sm text-ink outline-none transition-all placeholder:text-slate-400 smart-field aria-[invalid=true]:border-danger data-[invalid=true]:border-danger";

/** "Create Account" (the prototype's RegisterPage). Same layout, fields, messages and rules; the account is created with Supabase Auth
 *  and the details that aren't sign-in data wait in the sign-up metadata until the first session exists (applySignupDetails).
 *  With "Confirm email" on, a "Check your email" screen follows, with Resend. */
export function RegisterForm() {
  const router = useRouter();
  const form = useRegisterForm();
  const configured = AUTH_CONFIGURED;
  const mock = DATA_SOURCE === "mock";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [photo, setPhoto] = useState<PhotoValue>({ kind: "none" });
  const submitting = useRef(false); // blocks a second submit before React re-renders the disabled button
  const formRef = useRef<HTMLFormElement>(null);

  const disabled = mock || !configured;
  const canContinue = form.pending.length === 0 && form.checksPending.length === 0 && !busy && !done && !disabled;

  // Shows every field's message and brings the first one into view.
  const showMissing = () => {
    form.touchAll();
    if (!form.agreeTos) form.setTosAttempted(true);
    setTimeout(() => formRef.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
  };

  /** The photo is added to the account's profile once signed in (as in the prototype): with a session at hand it is uploaded and
   *  saved through the profile service; a failure never blocks the sign-up (the photo can be added in My Profile). */
  const savePhoto = async () => {
    if (photo.kind !== "new") return;
    try {
      const profiles = await getProfileService();
      await profiles.load(); // applies the sign-up details first
      const photoPath = await profiles.uploadPhoto(photo.blob);
      await profiles.save({ photoPath });
    } catch (e) {
      console.warn("The registration photo could not be saved; it can be added in My Profile", e);
    }
  };

  const submit = async () => {
    if (submitting.current || busy || done) return;
    if (!canContinue) { showMissing(); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const { needsConfirmation } = await (await authService()).signUp(form.buildSignUp());
      form.clearPasswords();
      if (needsConfirmation) {
        setConfirmEmail(form.values.mainEmail.trim());
        setBusy(false);
      } else {
        await savePhoto();
        setDone(true);
        router.replace(DEFAULT_AFTER_LOGIN);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  };

  const who = [form.values.firstName, form.values.lastName].join(" ").trim();
  const to = form.values.mainEmail.trim() ? `${who || "New user"} <${form.values.mainEmail.trim()}>` : "New user";

  return (
    <>
      <Link href="/" className="relative z-10 mb-6 flex shrink-0 flex-col items-center justify-center gap-3 text-center transition-opacity hover:opacity-90" aria-label="Smartconferu home">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={24} height={36} priority className="h-9 w-6" />
        </span>
        <span className="text-xs text-white/60">Create an account to submit and review papers</span>
      </Link>

      {confirmEmail ? (
        <div className="relative z-10 w-full max-w-[800px]">
          <CheckYourEmail email={confirmEmail} onChangeEmail={() => { form.resetConsent(); setConfirmEmail(""); }} />
        </div>
      ) : (
        <div className="reg-card relative z-10 w-full max-w-[800px] overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="shrink-0 border-b border-line px-8 pb-4 pt-7">
            <h1 className="mb-1 text-xl font-bold text-navy">Create Account</h1>
            <p className="text-sm text-ink-muted">
              To use Smartconferu, you must agree to our <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Terms of Service</a>.
              <br />
              You may also be interested in our <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">policy for using personal information</a>.
            </p>
            <div className="mt-4 rounded-xl border border-line bg-canvas px-4 pb-3 pt-3">
              <p className="mb-2.5 text-center text-xs font-semibold text-ink-muted">Sign up in one click with</p>
              <SsoButtons disabled={busy} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs font-medium text-ink-faint">or fill in your details</span>
              <div className="h-px flex-1 bg-line" />
            </div>
          </div>

          <form
            ref={formRef} noValidate aria-label="Create account" className="reg-form"
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
            // The submit button is disabled until the form is valid, and a browser never submits through a disabled button, so Enter
            // in a field is the one way left to "try": treat it as an attempt and show what is missing (including the Terms).
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.defaultPrevented || canContinue || !(e.target instanceof HTMLInputElement) || e.target.type === "checkbox") return;
              e.preventDefault();
              if (!busy && !done && !disabled) showMissing();
            }}
          >
            <div className="reg-scroll px-8 pb-1 pt-5">
              {mock && <AuthMessage tone="error">Registration is not used in mock data mode.</AuthMessage>}
              {!mock && !configured && <AuthMessage tone="error">Registration isn&apos;t set up on this site yet (the Supabase keys are missing).</AuthMessage>}
              <div className="mb-5 space-y-3 rounded-xl border border-line p-5">
                <fieldset disabled={disabled || busy} className="min-w-0 space-y-3 border-0 p-0">
                  <PhotoField value={photo} onChange={setPhoto} initials={initialsOf(form.values.firstName, form.values.lastName, "")} />
                  <Fields form={form} />
                </fieldset>
              </div>
              <TriggeredEmailNote
                className="mb-5"
                emails={[{ key: "verifyEmail", to, recipientName: who }, { key: "welcome", to, recipientName: who, when: "After they click the link in the verification email" }]}
              />
            </div>

            <div className="shrink-0 border-t border-line px-8 pb-5 pt-4">
              <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                {/* autoComplete off: a browser must not restore a ticked box on reload or Back — consent is given on this visit. */}
                <input id="register-tos" type="checkbox" autoComplete="off" checked={form.agreeTos} onChange={(e) => form.setAgreeTos(e.target.checked)} disabled={disabled || busy} aria-invalid={(form.tosAttempted && !form.agreeTos) || undefined} aria-describedby={form.tosAttempted && !form.agreeTos ? "register-tos-error" : undefined} className="h-4 w-4 cursor-pointer rounded accent-[var(--primary)] outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" />
                I agree to the Smartconferu <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Terms of Service</a>
              </label>
              {form.tosAttempted && !form.agreeTos && <p id="register-tos-error" role="alert" className="-mt-2 mb-3 text-[11.5px] text-danger-ink">Tick the Terms of Service to create your account.</p>}

              {error && <div className="mb-3"><AuthMessage tone="error">{error}</AuthMessage></div>}
              {done && <div className="mb-3"><AuthMessage>Account created — taking you to Smartconferu…</AuthMessage></div>}

              <button
                type="submit" disabled={!canContinue}
                className={cn(
                  "w-full cursor-pointer rounded-lg py-3 text-sm font-semibold text-white transition-all focus:outline-none focus:ring-4 focus:ring-purple-400/50 disabled:cursor-not-allowed",
                  canContinue || busy ? "bg-primary" : "bg-ink-faint",
                  (busy || done) && "opacity-70",
                  canContinue && "hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(124,58,237,0.35)]",
                )}
              >
                {busy || done ? "Creating your account…"
                  : canContinue ? "Continue"
                    : form.pending.length ? `Fill in ${form.pending.length} more field${form.pending.length === 1 ? "" : "s"}`
                      : `Tick ${form.checksPending.join(" and ")}`}
              </button>
              {!canContinue && !busy && !done && !disabled && (
                <p className="mt-2 text-center text-[11.5px] text-ink-faint">
                  {form.pending.length ? `Still needed: ${form.pending.map((k) => REQUIRED_LABELS[k]).join(", ")}` : ""}
                  {form.pending.length > 0 && form.checksPending.length > 0 ? " · " : ""}
                  {form.checksPending.length ? `Tick ${form.checksPending.join(" and ")}` : ""}
                  {form.pending.length > 0 && <button type="button" onClick={showMissing} className="ml-1 cursor-pointer font-bold text-primary hover:underline">Show me</button>}
                </p>
              )}
              <p className="mt-3 text-center text-xs text-ink-faint">
                Already have an account? <Link href={LOGIN_PATH} className="cursor-pointer font-semibold text-primary hover:underline focus:underline focus:outline-none">Sign in</Link>
              </p>
            </div>
          </form>
        </div>
      )}

      <Link href="/" className="relative z-10 mt-4 flex shrink-0 items-center justify-center gap-1 text-xs font-semibold text-white/60 transition-colors hover:text-white">
        <ChevronLeft size={13} aria-hidden="true" /> Back to home
      </Link>
    </>
  );
}

function Fields({ form }: { form: Form }) {
  const { values, set, errorOf, touch } = form;
  const invalid = (key: Parameters<typeof errorOf>[0]) => Boolean(errorOf(key)) || undefined;
  const err = (key: Parameters<typeof errorOf>[0]) => (errorOf(key) ? <p role="alert" className="mt-1 text-[11.5px] text-danger-ink">{errorOf(key)}</p> : null);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input autoFocus autoComplete="given-name" aria-label="First name" aria-required="true" placeholder="First name *" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} onBlur={touch("firstName")} aria-invalid={invalid("firstName")} className={REG_INPUT} />
          {err("firstName")}
        </div>
        <div>
          <input autoComplete="family-name" aria-label="Last name" aria-required="true" placeholder="Last name *" value={values.lastName} onChange={(e) => set("lastName", e.target.value)} onBlur={touch("lastName")} aria-invalid={invalid("lastName")} className={REG_INPUT} />
          {err("lastName")}
        </div>
      </div>
      <div>
        {/* autocomplete "username" (not "email"): the email is the account's sign-in name, so a password manager pairs it with the new password
            below, offers to save both after sign-up and fills them on the sign-in page (whose box is "username" too). */}
        <input id="register-email" name="email" type="email" inputMode="email" autoComplete="username" aria-label="Email" aria-required="true" placeholder="Email *" value={values.mainEmail} onChange={(e) => set("mainEmail", e.target.value)} onBlur={touch("mainEmail")} aria-invalid={invalid("mainEmail")} className={REG_INPUT} />
        {err("mainEmail")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div onBlur={touch("affiliation")}>
          <InstitutionPicker id="register-institution" ariaLabel="Affiliation" value={form.inst} onChange={form.setInst} placeholder="Affiliation * (search your institution)" invalid={Boolean(errorOf("affiliation"))} inputClassName={REG_INPUT} />
          {err("affiliation")}
        </div>
        <DepartmentPicker id="register-department" ariaLabel="Department" institution={form.inst} value={form.department} onChange={form.setDepartment} placeholder="Department (optional)" inputClassName={REG_INPUT} />
      </div>
      <div>
        <input autoComplete="organization-title" aria-label="Designation" aria-required="true" placeholder="Designation * (e.g. Professor)" value={values.designation} onChange={(e) => set("designation", e.target.value)} onBlur={touch("designation")} aria-invalid={invalid("designation")} className={REG_INPUT} />
        {err("designation")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div onBlur={touch("country")}>
          <CountrySelect value={values.country} onChange={(c) => set("country", c)} placeholder="Country / region *" invalid={Boolean(errorOf("country"))} className={REG_INPUT} />
          {err("country")}
        </div>
        <div>
          <select aria-label="Gender" aria-required="true" value={values.gender} onChange={(e) => set("gender", e.target.value)} onBlur={touch("gender")} aria-invalid={invalid("gender")} style={{ color: values.gender ? "var(--ink)" : "var(--ink-faint)" }} className={cn(REG_INPUT, "cursor-pointer")}>
            <option value="" disabled>Gender *</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {err("gender")}
        </div>
      </div>
      <div>
        <input type="url" autoComplete="url" aria-label="Website" placeholder="Website (optional)" value={values.webPage} onChange={(e) => set("webPage", e.target.value)} onBlur={touch("webPage")} aria-invalid={invalid("webPage")} className={REG_INPUT} />
        {err("webPage")}
      </div>
      <div>
        <PhoneField id="register-phone" ariaLabel="Mobile number" phone={values.phone} onPhoneChange={(v) => set("phone", v)} onBlur={touch("phone")} channels={values.notifyChannels} onChannelsChange={(v) => set("notifyChannels", v)} invalid={Boolean(errorOf("phone"))} inputClassName={REG_INPUT} />
        {err("phone")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <PasswordField id="register-password" maxLength={128} aria-label="Password" name="password" label="password" aria-required="true" autoComplete="new-password" placeholder="Password * (min. 8 characters)" value={form.password} onChange={(e) => form.setPassword(e.target.value)} onBlur={touch("password")} aria-invalid={invalid("password")} className={REG_INPUT} />
          {err("password")}
        </div>
        <div>
          <PasswordField id="register-password2" maxLength={128} aria-label="Retype password" name="password-confirm" label="retyped password" aria-required="true" autoComplete="new-password" placeholder="Retype password *" value={form.password2} onChange={(e) => form.setPassword2(e.target.value)} onBlur={touch("password2")} aria-invalid={invalid("password2")} className={REG_INPUT} />
          {err("password2")}
        </div>
      </div>
    </>
  );
}

/** Shown after sign-up when Supabase wants the email confirmed first. Resend uses the same call as the sign-in page. */
function CheckYourEmail({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const [resend, setResend] = useState<"" | "sending" | "sent" | string>("");
  const resendEmail = async () => {
    setResend("sending");
    try { await (await authService()).resendConfirmation(email); setResend("sent"); } catch (e) { setResend(e instanceof Error ? e.message : "Couldn't resend the email."); }
  };
  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl" role="status" aria-live="polite">
      <h1 className="mb-1 text-xl font-bold text-navy">Check your email</h1>
      <p className="mb-4 text-sm text-ink-muted">Account created. We&apos;ve sent a confirmation link to <b className="text-ink">{email}</b> — click it to finish signing in.</p>
      <p className="mb-4 text-xs text-ink-muted">Open the link in this browser to be signed in automatically. If you open it somewhere else, just sign in with your email and password afterwards.</p>
      <p className="mb-5 text-xs text-ink-muted">
        {resend === "sent" ? `Confirmation email sent again to ${email}.`
          : resend && resend !== "sending" ? resend
            : <>Didn&apos;t get the email? <button type="button" onClick={resendEmail} disabled={resend === "sending"} className="font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60">{resend === "sending" ? "Sending…" : "Resend confirmation email"}</button></>}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Link href={LOGIN_PATH} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Go to sign in</Link>
        <button type="button" onClick={onChangeEmail} className="text-xs font-semibold text-primary hover:underline">Used the wrong email?</button>
      </div>
    </div>
  );
}
