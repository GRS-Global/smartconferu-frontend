"use client";

import { Bell, ChevronRight, GitMerge, KeyRound, Laptop, Link2, Mail, MessageSquare, Settings, ShieldCheck, Smartphone, Trash2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { NOTIFY_CHANNELS } from "@/features/profile/fields";
import { profileSlug } from "@/features/profile/components/share-dialog";
import { AUTH_API, SMS_ALERTS_ENABLED } from "@/lib/config";
import type { Profile, ProfilePatch } from "@/types/profile";
import { DeleteAccountModal, LinkedSignInModal, MergeAccountsModal } from "./account-modals";
import { ChangePasswordModal } from "./change-password-card";
import { NOTIFY_FREQUENCIES } from "./preference-cards";
import { ChangeEmailModal, ConnectAccountModal, SessionsModal, TwoStepModal } from "./security-modals";

/* My Profile › Security & Settings, as the prototype's popup over the profile (settingsBody): Account & Security (Change password …), Notifications,
   Display & Accessibility and Privacy. Like the prototype there is no Save button: each change is written to the profile as it is made (the profile
   keeps the old value and an error shows if the write fails); Done closes the popup. Linked sign-in methods and Delete account are real (see
   account-modals.tsx). Merge accounts and "Show my reviewer level and badges" are the prototype's design only: merging is not switched on (pressing the button says so
   and changes nothing) and the badge setting is only kept (this app has no peer review recognition on the profile for it to show) */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;

function WhatsAppIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
    </svg>
  );
}

function CardHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <div className="mb-4 flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={15} aria-hidden="true" /></div><h3 className="text-sm font-bold text-navy">{title}</h3></div>;
}

function ActionItem({ icon: Icon, title, subtitle, onClick, danger = false }: { icon: LucideIcon; title: string; subtitle: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-canvas">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${danger ? "bg-danger-soft text-danger-ink" : "bg-primary-soft text-primary"}`}><Icon size={16} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{title}</span><span className="block truncate text-xs text-ink-faint">{subtitle}</span></span>
      <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-line-strong" />
    </button>
  );
}

const Card = ({ children }: { children: ReactNode }) => <div style={CARD} className="rounded-2xl bg-white p-6">{children}</div>;

export function SecuritySettingsModal({ profile, save, onClose, onAddPhone }: { profile: Profile; save: (patch: ProfilePatch) => Promise<Profile>; onClose: () => void; onAddPhone: () => void }) {
  const [dialog, setDialog] = useState<"password" | "linked" | "merge" | "delete" | "email" | "twostep" | "sessions" | null>(null);
  const [error, setError] = useState("");
  const write = async (patch: ProfilePatch) => {
    setError("");
    try { await save(patch); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that change. Please try again."); }
  };
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const toggleChannel = (key: string, on: boolean) => { const cur = profile.notifyChannels; void write({ notifyChannels: on ? [...cur.filter((c) => c !== key), key] : cur.filter((c) => c !== key) }); };

  return (
    <>
      <Modal title="Security & Settings" subtitle="Your account, notifications, display and privacy." icon={ShieldCheck} onClose={onClose} maxWidth="max-w-3xl" roomy
        actions={<button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-lg bg-primary px-[22px] text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Done</button>}>
        <div className="space-y-5">
          <Card>
            <CardHeader icon={ShieldCheck} title="Account & Security" />
            <div className="mt-2 space-y-1">
              <ActionItem icon={KeyRound} title="Change password" subtitle="Update your login password" onClick={() => setDialog("password")} />
              {AUTH_API && <ActionItem icon={Mail} title="Change email address" subtitle="The address you sign in with" onClick={() => setDialog("email")} />}
              {AUTH_API && <ActionItem icon={Smartphone} title="Two-step verification" subtitle="Ask for a code from an authenticator app when you sign in" onClick={() => setDialog("twostep")} />}
              {AUTH_API && <ActionItem icon={Laptop} title="Active sessions" subtitle="See where you are signed in and sign devices out" onClick={() => setDialog("sessions")} />}
              <ActionItem icon={Link2} title="Linked sign-in methods" subtitle="Google, ORCID, Microsoft" onClick={() => setDialog("linked")} />
              <ActionItem icon={GitMerge} title="Merge accounts" subtitle="Combine two accounts into one" onClick={() => setDialog("merge")} danger />
              <ActionItem icon={Trash2} title="Delete account" subtitle="Permanently remove your account and all its data" onClick={() => setDialog("delete")} danger />
            </div>
          </Card>

          <Card>
            <CardHeader icon={Bell} title="Notifications" />
            <label htmlFor="notify-frequency" className="mb-1 block text-xs font-semibold text-ink-soft">Email me about activity on my submissions</label>
            <select id="notify-frequency" value={profile.notifyFrequency} onChange={(e) => void write({ notifyFrequency: e.target.value })} className="w-full max-w-xs cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-primary">
              {NOTIFY_FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            {SMS_ALERTS_ENABLED && <div className="mt-5 border-t border-muted pt-4">
              <div className="text-sm font-semibold text-ink">Text &amp; WhatsApp alerts</div>
              {profile.phone ? (
                <>
                  <div className="mb-2 text-xs text-ink-faint">Sent to {profile.phone}. Email notifications stay on either way.</div>
                  {NOTIFY_CHANNELS.map(({ key }) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <span id={`notify-${key}`} className="flex items-center gap-2 text-sm text-ink-soft">{key === "sms" ? <MessageSquare size={15} aria-hidden="true" className="text-ink-muted" /> : <WhatsAppIcon />} {key === "sms" ? "Text message (SMS)" : "WhatsApp"}</span>
                      <Switch labelledBy={`notify-${key}`} checked={profile.notifyChannels.includes(key)} onChange={(on) => toggleChannel(key, on)} />
                    </div>
                  ))}
                </>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-canvas px-3.5 py-3">
                  <span className="text-xs text-ink-muted">Add a mobile number to also get notifications by SMS or WhatsApp.</span>
                  <button type="button" onClick={() => { onClose(); onAddPhone(); }} className="shrink-0 cursor-pointer text-xs font-semibold text-primary hover:underline">Add mobile number</button>
                </div>
              )}
            </div>}
          </Card>

          <Card>
            <CardHeader icon={Settings} title="Display & Accessibility" />
            <div className="mb-4">
              <label htmlFor="display-timezone" className="mb-1 block text-xs font-semibold text-ink-soft">Timezone</label>
              <div className="w-full max-w-sm"><TimezoneSelect id="display-timezone" value={profile.timezone} onChange={(v) => void write({ timezone: v })} className="w-full rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none" /></div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-muted pt-4">
              <div><div id="cb-title" className="text-sm font-semibold text-ink">Color-blind mode</div><div id="cb-desc" className="text-xs text-ink-faint">Use a color palette that&apos;s easier to distinguish</div></div>
              <Switch labelledBy="cb-title" describedBy="cb-desc" checked={profile.colorBlindMode} onChange={(v) => void write({ colorBlindMode: v })} />
            </div>
          </Card>

          <Card>
            <CardHeader icon={Link2} title="Privacy" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div id="pub-title" className="text-sm font-semibold text-ink">Shareable public profile</div>
                <div className="mt-0.5 text-xs text-ink-faint">{profile.publicProfileEnabled ? `${origin}/author/${profileSlug(profile)}` : "Off — turn this on so others can view your profile without signing in."}</div>
              </div>
              <Switch labelledBy="pub-title" checked={profile.publicProfileEnabled} onChange={(v) => void write({ publicProfileEnabled: v })} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-muted pt-4">
              <div className="min-w-0">
                <div id="rev-title" className="text-sm font-semibold text-ink">Show my reviewer level and badges</div>
                <div className="mt-0.5 text-xs text-ink-faint">Adds &quot;Peer review recognition&quot; to your profile — never which papers or conferences you reviewed, or your scores.</div>
              </div>
              <Switch labelledBy="rev-title" checked={profile.showReviewerAchievements} onChange={(v) => void write({ showReviewerAchievements: v })} />
            </div>
          </Card>
          {error && <p role="alert" className="text-sm font-semibold text-danger-ink">{error}</p>}
        </div>
      </Modal>
      {dialog === "password" && <ChangePasswordModal onClose={() => setDialog(null)} />}
      {dialog === "linked" && <LinkedSignInModal onClose={() => setDialog(null)} />}
      {dialog === "merge" && (AUTH_API ? <ConnectAccountModal mainEmail={profile.mainEmail} onClose={() => setDialog(null)} /> : <MergeAccountsModal onClose={() => setDialog(null)} />)}
      {dialog === "email" && <ChangeEmailModal currentEmail={profile.mainEmail} hasPassword={profile.hasPassword !== false} onClose={() => setDialog(null)} />}
      {dialog === "twostep" && <TwoStepModal onClose={() => setDialog(null)} />}
      {dialog === "sessions" && <SessionsModal onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteAccountModal onClose={() => setDialog(null)} />}
    </>
  );
}
