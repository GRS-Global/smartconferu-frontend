"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import type { Profile } from "@/types/profile";
import { NOTIFY_CHANNELS } from "../fields";
import { profileEmails } from "./helpers";
import { EditIconButton, VerifyStatus } from "./parts";

const EMAIL_TYPES = [
  { key: "personal" as const, label: "Personal" },
  { key: "professional" as const, label: "Professional" },
];
const channelLabel = (key: string) => NOTIFY_CHANNELS.find((c) => c.key === key)?.label ?? key;

function SubHeading({ title, button }: { title: string; button?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-bold tracking-[0.01em] text-navy">{title}</h3>
      {button}
    </div>
  );
}

/** My Profile's private sidebar: one "Contact details" card (only visible to you) with the email address(es), the
 *  mobile number and the postal address. Email can't be edited here (it is the account's sign-in email), and the
 *  prototype's mobile verification (simulated there) has no counterpart yet, so a status shows only when one is stored. */
export function ContactCard({ profile, onEditEmails, onEditPhone, onEditAddress, onShare }: { profile: Profile; onEditEmails: () => void; onEditPhone: () => void; onEditAddress: () => void; onShare: () => void }) {
  const { emails, primaryEmail } = profileEmails(profile);
  const rows = EMAIL_TYPES.filter((t) => emails[t.key].value.trim()).sort((a, b) => Number(b.key === primaryEmail) - Number(a.key === primaryEmail));
  const channels = profile.notifyChannels;
  const addressLine = [
    profile.addressLine1, profile.addressLine2,
    [[profile.city, profile.state].filter(Boolean).join(", "), profile.postCode].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  return (
    <>
    <section aria-labelledby="contact-heading" className="rounded-xl border border-line bg-white p-6">
      <h2 id="contact-heading" className="text-[15px] font-bold text-navy">Contact details</h2>
      <div className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ink-muted"><Lock size={12} aria-hidden="true" /> Only visible to you</div>

      <div className="mt-[18px]">
        <SubHeading title="Email addresses" button={<EditIconButton onClick={onEditEmails} label="Manage email addresses" />} />
        {rows.map((t, i) => {
          const e = emails[t.key];
          return (
            <div key={t.key} className={i ? "mt-3.5 border-t border-muted pt-3.5" : "mt-2"}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-muted">{t.label}</span>
                {primaryEmail === t.key && <span className="rounded-full bg-primary-soft px-2 py-[3px] text-[11px] font-bold tracking-[0.03em] text-primary">PRIMARY</span>}
              </div>
              <div className="mt-[3px] truncate text-sm font-semibold text-ink">{e.value}</div>
              <div className="mt-1.5"><VerifyStatus status={e.status} /></div>
            </div>
          );
        })}
      </div>

      <div className="mt-[18px] border-t border-muted pt-[18px]">
        <SubHeading title="Mobile number" button={profile.phone ? <EditIconButton onClick={onEditPhone} label="Manage mobile number" /> : undefined} />
        {profile.phone ? (
          <>
            <div className="mt-1.5 text-sm font-semibold text-ink">{profile.phone}</div>
            {profile.phoneStatus && <div className="mt-1.5"><VerifyStatus status={profile.phoneStatus} /></div>}
            <div className="mt-2.5 text-[13px] text-ink-muted">
              {channels.length ? `Alerts by ${channels.map(channelLabel).join(" & ")} are set.` : "SMS and WhatsApp alerts are off."}
            </div>
          </>
        ) : (
          <button type="button" onClick={onEditPhone} className="mt-3 text-sm font-semibold text-primary hover:underline">+ Add mobile number</button>
        )}
      </div>

      <div className="mt-[18px] border-t border-muted pt-[18px]">
        <SubHeading title="Address" button={addressLine ? <EditIconButton onClick={onEditAddress} label="Edit address" /> : undefined} />
        {addressLine
          ? <p className="mt-1.5 text-sm leading-[1.55] text-ink">{addressLine}</p>
          : <button type="button" onClick={onEditAddress} className="mt-1.5 text-sm font-semibold text-primary hover:underline">+ Add address</button>}
      </div>
    </section>
    <div className="px-1 text-[13px] leading-[1.55] text-ink-muted">
      Your public profile is {profile.publicProfileEnabled ? "on" : "off"}.{" "}
      <button type="button" onClick={onShare} className="font-semibold text-primary hover:underline">Manage</button>
    </div>
    </>
  );
}
