"use client";

import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/field";
import { DATA_SOURCE } from "@/lib/config";
import { getProfileService } from "@/services/profile";
import type { EmailSlot } from "@/types/profile";
import { isEmail } from "../validation";
import { profileEmails } from "../showcase/helpers";
import { VerifyStatus } from "../showcase/parts";
import { useSectionSave } from "../use-section-save";
import { RadioChoice } from "./editor-parts";
import type { EditorProps } from "./editor-types";
import { SectionCard } from "./section-card";

const TYPES = [
  { key: "personal", label: "Personal", hint: "Your own address — stays with you if you change institutions.", placeholder: "name@gmail.com" },
  { key: "professional", label: "Professional", hint: "Your institution or work address — helps organizers confirm your affiliation.", placeholder: "name@university.edu" },
] as const;
type Slots = { personal: EmailSlot; professional: EmailSlot };
type SlotKey = keyof Slots;

/** My Profile › Email addresses: a personal and a professional slot. The address you sign in with is shown verified and can't be edited here;
 *  an address typed into the other slot is saved as "Not verified". Own backend: a verification link is emailed to it (and can be sent again); it is "Verified"
 *  once the link is opened. Only a verified address can be primary, and choosing it as primary is still the person's own step. */
export function EmailsEditor({ profile, save, onDone, onCancel }: EditorProps) {
  const saved = profileEmails(profile);
  const [emails, setEmails] = useState<Slots>(saved.emails);
  const [primary, setPrimary] = useState<SlotKey>(saved.primaryEmail);
  const [touched, setTouched] = useState(false);
  const state = useSectionSave();
  const [link, setLink] = useState<{ slot: SlotKey | null; state: "idle" | "sending" | "sent" | "error"; message: string }>({ slot: null, state: "idle", message: "" });
  /** Emails the verification link of a saved address again (own backend). */
  const resend = async (slot: SlotKey) => {
    setLink({ slot, state: "sending", message: "" });
    try {
      const service = await getProfileService();
      await service.resendEmailVerification?.(slot);
      setLink({ slot, state: "sent", message: "" });
    } catch (e) {
      setLink({ slot, state: "error", message: e instanceof Error ? e.message : "The link could not be sent. Try again in a moment." });
    }
  };
  const isAccount = (k: SlotKey) => saved.emails[k].status === "verified" && saved.emails[k].value.trim().toLowerCase() === profile.mainEmail.trim().toLowerCase();
  const problem = (k: SlotKey) => (emails[k].value.trim() && !isEmail(emails[k].value) ? "Enter a valid email, e.g. name@university.edu." : "");
  const invalid = TYPES.some((t) => problem(t.key));
  const dirty = JSON.stringify(emails) !== JSON.stringify(saved.emails) || primary !== saved.primaryEmail;

  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const next = {} as Slots;
    for (const t of TYPES) {
      const e = emails[t.key];
      const value = e.value.trim();
      const changed = value !== saved.emails[t.key].value.trim();
      next[t.key] = { value, status: !value ? "" : changed ? "pending" : e.status };
    }
    // The primary has to stay verified: if it just changed, fall back to a verified address.
    let primaryEmail: SlotKey = primary;
    if (next[primaryEmail].status !== "verified") primaryEmail = (TYPES.map((t) => t.key).find((k) => next[k].status === "verified") ?? primaryEmail);
    const added = TYPES.some((t) => next[t.key].status === "pending" && next[t.key].value !== saved.emails[t.key].value.trim());
    if (await state.run(() => save({ emails: next, primaryEmail }))) onDone(added ? (DATA_SOURCE === "api" ? "Saved — we sent a verification link to the new address" : "Saved — the new address is not verified yet") : "Email addresses updated");
  };

  return (
    <SectionCard inDialog id="emails" title="Email addresses" description="Private — organizers use these to reach you about your submissions." save={state} canSave={dirty && !(touched && invalid)} onSave={() => void submit()} onCancel={onCancel}>
      <div role="radiogroup" aria-label="Primary email" className="flex flex-col gap-4">
        {TYPES.map((t) => {
          const e = emails[t.key];
          const has = Boolean(e.value.trim());
          const verified = has && e.status === "verified" && e.value.trim() === saved.emails[t.key].value.trim();
          const account = isAccount(t.key);
          const err = touched ? problem(t.key) : "";
          return (
            <div key={t.key} className={`rounded-xl border px-4 py-4 ${primary === t.key ? "border-primary-soft-border" : "border-line"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <label htmlFor={`pm-email-${t.key}`} className="text-sm font-bold text-navy">{t.label} email</label>
                  <div className="mt-0.5 text-[13px] text-ink-muted">{t.hint}</div>
                </div>
                <div className="shrink-0 pt-0.5">{has && <VerifyStatus status={e.status || "new"} />}</div>
              </div>
              <div className="mt-3">
                <input
                  id={`pm-email-${t.key}`} type="email" value={e.value} placeholder={t.placeholder} readOnly={account} aria-label={`${t.label} email`} aria-invalid={err ? true : undefined}
                  onChange={(ev) => { const v = ev.target.value; const s = saved.emails[t.key]; setEmails((m) => ({ ...m, [t.key]: { value: v, status: v === s.value ? s.status : "new" } })); }}
                  className={INPUT_CLASS}
                />
                {err && <p id={`pm-email-${t.key}-error`} role="alert" className="mt-1 text-[11.5px] text-danger">{err}</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <RadioChoice checked={primary === t.key} disabled={!verified} onSelect={() => setPrimary(t.key)}>Primary — sign-in &amp; notifications</RadioChoice>
                {account && <span className="text-[13px] text-ink-muted">The email you sign in with.</span>}
                {has && !account && e.status !== "verified" && (
                  DATA_SOURCE !== "api" ? <span className="text-[13px] text-ink-muted">Verification isn&apos;t available yet, so this can&apos;t be your primary address.</span>
                  : e.value.trim() !== saved.emails[t.key].value.trim() ? <span className="text-[13px] text-ink-muted">Save, and we&apos;ll email a verification link to this address.</span>
                  : (
                    <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">
                      {link.slot === t.key && link.state === "sent" ? "Link sent — check your inbox." : "We sent a link to this address. Open it to verify."}
                      <button type="button" disabled={link.slot === t.key && link.state === "sending"} onClick={() => void resend(t.key)} className="cursor-pointer font-semibold text-primary hover:underline disabled:cursor-default disabled:opacity-60">
                        {link.slot === t.key && link.state === "sending" ? "Sending…" : "Resend link"}
                      </button>
                      {link.slot === t.key && link.state === "error" && <span role="alert" className="w-full text-[11.5px] text-danger">{link.message}</span>}
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] leading-[1.55] text-ink-muted">Only a verified address can be primary. Reviewers and other authors never see either address.</p>
    </SectionCard>
  );
}
