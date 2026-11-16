"use client";

import { Award, Briefcase, Building2, Camera, Check, FileText, GraduationCap, Link2, Mail, MapPin, Smartphone, TriangleAlert, User, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal as ModalWindow } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { useProfile } from "../profile-context";
import { ProfileShowcase, type ShowcaseEdit } from "../showcase/profile-showcase";
import { AboutEditor, AddressEditor, IntroEditor, PhoneEditor } from "./basic-editors";
import { AffiliationsEditor } from "./affiliations-editor";
import { EmailsEditor } from "./emails-editor";
import { LinksEditor } from "./links-editor";
import { LIST_TITLES, ListEditor } from "./list-editor";
import { PhotoEditor } from "./photo-editor";
import { SecuritySettingsModal } from "@/features/settings/components/settings-modal";
import { ShareDialog } from "./share-dialog";

type Modal = "intro" | "photo" | "about" | "affiliation" | "experience" | "education" | "memberships" | "links" | "emails" | "phone" | "address";

const TITLES: Record<Modal, string> = {
  intro: "Edit intro", photo: "Profile photo", about: "Edit about", affiliation: "Edit affiliations", experience: "Edit experience", education: "Edit education",
  memberships: "Edit memberships", links: "Scholar & professional profiles", emails: "Email addresses", phone: "Mobile number", address: "Edit address",
};
const SUBTITLES: Record<Modal, string> = {
  intro: "Your name, role and how people can reach you.", photo: "A clear headshot helps organizers recognize you.", about: "Tell organizers and reviewers what you work on.",
  affiliation: "Institutions you currently work or research at. One is your primary.", experience: "Roles you have held — use ↑ ↓ to set the order.", education: "Degrees and qualifications — use ↑ ↓ to set the order.",
  memberships: "Societies and professional bodies — use ↑ ↓ to set the order.", links: "Where people can find your published work and connect with you online.",
  emails: "Private — organizers use these to reach you about your submissions.", phone: "Optional — used for SMS or WhatsApp alerts.", address: "Private — never shown on your public profile.",
};
const ICONS: Record<Modal, LucideIcon> = {
  intro: User, photo: Camera, about: FileText, affiliation: Building2, experience: Briefcase, education: GraduationCap, memberships: Award, links: Link2, emails: Mail, phone: Smartphone, address: MapPin,
};
// The prototype's window widths: S 480, M 640, L 768.
const S_W = "max-w-[480px]", M_W = "max-w-[640px]", L_W = "max-w-[768px]";
const WIDTHS: Record<Modal, string> = { intro: M_W, photo: S_W, about: M_W, affiliation: L_W, experience: L_W, education: L_W, memberships: L_W, links: L_W, emails: M_W, phone: S_W, address: M_W };
const SAVED: Partial<Record<Modal, string>> = {
  intro: "Intro updated", photo: "Photo updated", about: "About updated", affiliation: "Affiliations updated", phone: "Mobile number updated", address: "Address updated", emails: "Email addresses updated",
};

function Message({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mx-auto max-w-[1120px] p-8"><div className="rounded-2xl border border-line bg-white"><EmptyState icon={TriangleAlert} title={title} description={description} action={action} /></div></div>;
}

/** The toast every profile page shows after a save. */
export function useToast() {
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const flash = (text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));
  const node = toast && (
    <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-pop">
      <Check size={15} aria-hidden="true" /> {toast.text}
    </div>
  );
  return { flash, node };
}

/** My Profile, as the prototype's showcase page. The pencils open the edit forms in dialogs; the gate has already
 *  made sure the profile is loaded and complete. */
export function ProfilePage({ openSettings = false }: { openSettings?: boolean }) {
  const { state, reload, save, uploadPhoto } = useProfile();
  const [modal, setModal] = useState<Modal | null>(null);
  const [startSociety, setStartSociety] = useState<string | null>(null);
  const [focusAdd, setFocusAdd] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Security & Settings is a popup over the profile; "/settings" opens the profile with it showing.
  const [settingsOpen, setSettingsOpen] = useState(openSettings);
  const closeSettings = () => { setSettingsOpen(false); if (typeof window !== "undefined" && window.location.search) window.history.replaceState(null, "", "/profile"); };
  const { flash, node: toastNode } = useToast();

  if (state.status === "disabled") return <Message title="Profiles aren't available in mock data mode." description="Mock mode has no accounts. Use the Supabase data source to see your profile." />;
  if (state.status === "auth") return <SessionEnded onRecovered={reload} />;
  if (state.status === "error") return <Message title="Couldn't load your profile." description={state.message} action={<Button size="sm" onClick={reload}>Try again</Button>} />;
  if (state.status === "loading") {
    return <div role="status" aria-label="Loading your profile" className="mx-auto max-w-[1120px] space-y-5 p-8"><div className="h-64 animate-pulse rounded-xl border border-line bg-white" /><div className="h-48 animate-pulse rounded-xl border border-line bg-white" /></div>;
  }

  const { profile } = state;
  const open = (m: Modal) => () => setModal(m);
  const close = () => { setModal(null); setStartSociety(null); setFocusAdd(false); };
  const done = (m: Modal) => (message?: string) => { close(); const text = message ?? SAVED[m]; if (text) flash(text); };
  const edit: ShowcaseEdit = {
    intro: open("intro"), photo: open("photo"), links: open("links"), about: open("about"), affiliation: open("affiliation"), phone: open("phone"), address: open("address"),
    experience: open("experience"), education: open("education"), memberships: open("memberships"), emails: open("emails"),
    addSociety: (id) => { setStartSociety(id); setModal("memberships"); },
    share: () => setSharing(true),
    settings: () => setSettingsOpen(true),
    add: (kind) => { setFocusAdd(true); setModal(kind === "membership" ? "memberships" : kind); },
  };
  const base = { profile, save, onCancel: close };

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-24 pt-5 sm:px-8 sm:pt-10">
      <ProfileShowcase profile={profile} edit={edit} />

      {modal !== null && modal !== "photo" && (
        <ModalWindow title={TITLES[modal]} subtitle={SUBTITLES[modal]} icon={ICONS[modal]} onClose={close} maxWidth={WIDTHS[modal]} roomy footerSlot={modal !== "links"}>
        {modal === "intro" && <IntroEditor {...base} onDone={done("intro")} onManageAffiliation={open("affiliation")} />}
        {modal === "about" && <AboutEditor {...base} onDone={done("about")} />}
        {modal === "affiliation" && <AffiliationsEditor {...base} onDone={done("affiliation")} />}
        {(modal === "experience" || modal === "education" || modal === "memberships") && (
          <ListEditor key={modal} {...base} kind={modal === "memberships" ? "membership" : modal} startSociety={modal === "memberships" ? startSociety : null} focusAdd={focusAdd} onDone={done(modal)} />
        )}
        {modal === "emails" && <EmailsEditor {...base} onDone={done("emails")} />}
        {modal === "phone" && <PhoneEditor {...base} onDone={done("phone")} />}
        {modal === "address" && <AddressEditor {...base} onDone={done("address")} />}
        {modal === "links" && <LinksEditor profile={profile} save={save} onDone={close} flash={flash} />}
        </ModalWindow>
      )}

      {modal === "photo" && <PhotoEditor {...base} uploadPhoto={uploadPhoto} onDone={done("photo")} />}
      {settingsOpen && <SecuritySettingsModal profile={profile} save={save} onClose={closeSettings} onAddPhone={open("phone")} />}
      {sharing && <ShareDialog profile={profile} onClose={() => setSharing(false)} onTogglePublic={async (on) => { await save({ publicProfileEnabled: on }); }} />}
      {toastNode}
    </div>
  );
}

export { LIST_TITLES };
