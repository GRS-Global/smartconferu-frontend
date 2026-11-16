"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { getProfileService } from "@/services/profile";
import { AuthRequiredError } from "@/services/errors";
import type { Profile } from "@/types/profile";
import { useProfile } from "../profile-context";
import { ProfileShowcase, type ShowcaseEdit } from "../showcase/profile-showcase";
import { profileSlug, ShareDialog } from "./share-dialog";

const NOOP = () => {};
const READ_ONLY: ShowcaseEdit = {
  settings: NOOP, intro: NOOP, photo: NOOP, links: NOOP, about: NOOP, affiliation: NOOP, phone: NOOP, address: NOOP, experience: NOOP, education: NOOP, memberships: NOOP, addSociety: NOOP, emails: NOOP, share: NOOP, add: NOOP,
};

type Other = { status: "loading" } | { status: "found"; profile: Profile } | { status: "none" } | { status: "auth" };

/** /author/<slug>: the profile as others would see it (no pencils, no private contact card). The signed-in owner sees their own
 *  (when Public profile is on); anyone else's is read through the database function `public_profile` (migration 0027), which
 *  returns it only when that person switched Public profile on. Until that migration is run, other people's links read "No public
 *  profile found", as before. */
export function PublicProfilePage({ slug }: { slug: string }) {
  const { state, reload, save } = useProfile();
  const [sharing, setSharing] = useState(false);
  const own = state.status === "ready" ? state.profile : null;
  const isOwn = Boolean(own && own.publicProfileEnabled && profileSlug(own) === slug);
  const [other, setOther] = useState<Other>({ status: "loading" });
  const [tick, setTick] = useState(0);

  const needOther = state.status === "ready" && !isOwn;
  useEffect(() => {
    if (!needOther) return undefined;
    let cancelled = false;
    getProfileService().then((s) => s.loadPublic(slug))
      .then((profile): Other => (profile ? { status: "found", profile } : { status: "none" }))
      .catch((e: unknown): Other => (e instanceof AuthRequiredError ? { status: "auth" } : { status: "none" }))
      .then((next) => { if (!cancelled) setOther(next); });
    return () => { cancelled = true; };
  }, [needOther, slug, tick]);

  if (state.status === "auth" || other.status === "auth") return <SessionEnded onRecovered={() => { reload(); setOther({ status: "loading" }); setTick((t) => t + 1); }} />;
  if (state.status === "loading" || (needOther && other.status === "loading")) return <div role="status" aria-label="Loading profile" className="mx-auto max-w-[880px] p-8"><div className="h-64 animate-pulse rounded-xl border border-line bg-white" /></div>;

  if (isOwn && own) {
    return (
      <div className="mx-auto max-w-[880px] px-4 pb-24 pt-6 sm:px-8 sm:pt-10">
        <ProfileShowcase profile={own} edit={{ ...READ_ONLY, share: () => setSharing(true) }} readOnly />
        {sharing && <ShareDialog profile={own} onClose={() => setSharing(false)} onTogglePublic={async (on) => { await save({ publicProfileEnabled: on }); }} />}
      </div>
    );
  }
  if (other.status === "found") {
    return (
      <div className="mx-auto max-w-[880px] px-4 pb-24 pt-6 sm:px-8 sm:pt-10">
        <ProfileShowcase profile={other.profile} edit={READ_ONLY} readOnly />
      </div>
    );
  }
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <User size={26} className="mx-auto mb-3 text-ink-muted" aria-hidden="true" />
        <p className="mb-6 text-sm text-ink-muted">No public profile found at <span className="font-semibold">/author/{slug || "…"}</span> — it may be private, or the address is wrong.</p>
        <Link href="/dashboard" className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">Go to Smartconferu</Link>
      </div>
    </div>
  );
}
