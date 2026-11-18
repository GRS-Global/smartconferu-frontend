"use client";

import { Check, ChevronDown, ChevronRight, LifeBuoy, Power, ShieldCheck, UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/cn";
import { loginUrl } from "@/lib/auth-redirect";
import { onSessionChange } from "@/lib/api-client";
import { AUTH_API, AUTH_CONFIGURED, DATA_SOURCE } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";
import { getProfileCompleteness } from "@/features/profile/completeness";
import { initialsOf, ProfileAvatar } from "@/features/profile/components/profile-avatar";
import { useOptionalProfile } from "@/features/profile/profile-context";
import { authService } from "../auth-service";

/** Profile progress in the header, on every page, until the profile is complete (as in the prototype's top bar). */
export function ProfileProgress() {
  const ctx = useOptionalProfile();
  if (!ctx || ctx.state.status !== "ready") return null;
  const { percent } = getProfileCompleteness(ctx.state.profile);
  return percent === 100 ? (
    <Link href="/profile" title="Your profile is complete" className="hidden items-center gap-1.5 text-xs font-semibold text-success hover:opacity-80 md:flex">
      <Check size={14} strokeWidth={2.5} aria-hidden="true" /> Profile complete
    </Link>
  ) : (
    <Link href="/profile" title="Complete your profile in My Profile" className="hidden items-center gap-2 rounded-full border border-primary-soft-border bg-primary-soft py-1.5 pl-3 pr-2.5 text-xs font-semibold text-navy transition-colors hover:border-primary md:flex">
      <span aria-hidden="true" className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></span>
      Profile {percent}% complete
      <span className="flex items-center gap-0.5 text-primary">Complete <ChevronRight size={12} aria-hidden="true" /></span>
    </Link>
  );
}

/** Account button in the header: who is signed in (name, email, photo from their profile), My Profile and
 *  Sign out. It also watches the session: if it ends on its own (expired and couldn't refresh, or signed
 *  out in another tab) the user is sent back to the login page. Renders nothing in mock mode. */
export function UserMenu() {
  if (DATA_SOURCE === "mock" || !AUTH_CONFIGURED) return null;
  return <SignedInMenu />;
}

function SignedInMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const profileCtx = useOptionalProfile();
  const profile = profileCtx?.state.status === "ready" ? profileCtx.state.profile : null;
  const [sessionEmail, setSessionEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const manual = useRef(false); // a sign-out the user asked for isn't an "expired" session
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  useEffect(() => {
    if (AUTH_API) {
      // The session ended on its own (it couldn't be refreshed): back to sign-in, unless the user just chose Sign out.
      return onSessionChange((event) => { if (event === "signed_out" && !manual.current) router.replace(loginUrl(pathname, "expired")); });
    }
    const db = getSupabase();
    db.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? ""));
    const { data } = db.auth.onAuthStateChange((event, session) => {
      setSessionEmail(session?.user.email ?? "");
      if (event === "SIGNED_OUT" && !manual.current) router.replace(loginUrl(pathname, "expired"));
    });
    return () => data.subscription.unsubscribe();
  }, [router, pathname]);

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    manual.current = true;
    await (await authService()).signOut();
    router.replace("/login");
    router.refresh();
  };

  const email = profile?.mainEmail || sessionEmail;
  if (!email) return null;
  const fullName = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") : "";
  const initials = profile ? initialsOf(profile.firstName, profile.lastName, email) : email[0].toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu, signed in as ${fullName || email}`}
        title={fullName || email}
        style={{ boxShadow: open || pathname.startsWith("/profile") ? "0 0 0 2px var(--primary)" : "none" }}
        className="flex cursor-pointer items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1 transition-colors hover:bg-canvas"
      >
        <ProfileAvatar photoUrl={profile?.photoUrl ?? ""} initials={initials} size={34} />
        {/* The ▾ that says this opens a menu; it turns over while the menu is open. */}
        <ChevronDown size={14} aria-hidden="true" className={cn("shrink-0 text-primary transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-white p-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <ProfileAvatar photoUrl={profile?.photoUrl ?? ""} initials={initials} size={52} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-navy">{fullName || "Your account"}</div>
              <div className="truncate text-xs text-ink-muted">{email}</div>
              {profile?.designation && <div className="truncate text-[11px] text-ink-faint">{profile.designation}</div>}
            </div>
          </div>
          <div className="border-b border-line py-2">
            <Link href="/profile" role="menuitem" onClick={close} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors hover:bg-canvas", pathname.startsWith("/profile") ? "text-primary" : "text-ink")}>
              <UserCog size={17} aria-hidden="true" className={cn("shrink-0", pathname.startsWith("/profile") ? "text-primary" : "text-ink-muted")} /> My Profile
            </Link>
            <Link href="/settings" role="menuitem" onClick={close} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-canvas">
              <ShieldCheck size={17} aria-hidden="true" className="shrink-0 text-ink-muted" /> Security &amp; Settings
            </Link>
            <Link href="/help" role="menuitem" onClick={close} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-canvas">
              <LifeBuoy size={17} aria-hidden="true" className="shrink-0 text-ink-muted" /> Help
            </Link>
          </div>
          <button type="button" role="menuitem" onClick={signOut} disabled={busy} className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60">
            <Power size={17} aria-hidden="true" className="shrink-0" /> {busy ? "Logging out…" : "Log Out"}
          </button>
        </div>
      )}
    </div>
  );
}
