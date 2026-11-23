"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DATA_SOURCE } from "@/lib/config";
import { getProfileService } from "@/services/profile";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import type { Profile, ProfilePatch, ProfileVerification } from "@/types/profile";

/** Loading the profile and "the profile is incomplete" are different things: an error is never read as incomplete. */
export type ProfileState =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean }
  | { status: "disabled" }; // mock data mode: no accounts, so no profile

interface ProfileContextValue {
  state: ProfileState;
  /** Loads the profile again (after an error, or to refresh). */
  reload: () => void;
  /** Saves part of the profile; resolves to the stored profile and updates the state. Throws a ServiceError message to show. */
  save: (patch: ProfilePatch) => Promise<Profile>;
  uploadPhoto: (photo: Blob) => Promise<string>;
  /** Puts a new "Verify my profile" status on the loaded profile (after the member asked, or took the request back). */
  setVerification: (v: ProfileVerification) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** Mounted once for the signed-in screens, so every one of them (the gate, the header, My Profile) shares one profile. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfileState>(DATA_SOURCE === "mock" ? { status: "disabled" } : { status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (DATA_SOURCE === "mock") return undefined;
    let cancelled = false;
    getProfileService()
      .then((service) => service.load())
      .then((profile) => { if (!cancelled) setState({ status: "ready", profile }); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [tick]);

  // The profile can change without this user saving it (the Super Admin approves a new institution, society or area).
  // Opening My Profile, or coming back to the tab, quietly loads it again: no spinner, the page just shows the new data.
  const pathname = usePathname();
  const onProfilePage = pathname.startsWith("/profile");
  useEffect(() => {
    if (DATA_SOURCE === "mock") return undefined;
    let cancelled = false;
    const quiet = () => {
      getProfileService()
        .then((service) => service.load())
        .then((profile) => { if (!cancelled) setState((s) => (s.status === "ready" ? { status: "ready", profile } : s)); })
        .catch(() => undefined);
    };
    if (onProfilePage) quiet();
    const onVisible = () => { if (onProfilePage && document.visibilityState === "visible") quiet(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); };
  }, [onProfilePage]);

  const reload = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);

  const save = useCallback(async (patch: ProfilePatch) => {
    const profile = await (await getProfileService()).save(patch);
    setState({ status: "ready", profile });
    return profile;
  }, []);

  const uploadPhoto = useCallback(async (photo: Blob) => (await getProfileService()).uploadPhoto(photo), []);

  const setVerification = useCallback((v: ProfileVerification) => setState((s) => (s.status === "ready" ? { status: "ready", profile: { ...s.profile, profileVerification: v } } : s)), []);

  const value = useMemo(() => ({ state, reload, save, uploadPhoto, setVerification }), [state, reload, save, uploadPhoto, setVerification]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>.");
  return ctx;
}

/** For shared chrome that may render outside the provider (the header on any screen). */
export function useOptionalProfile(): ProfileContextValue | null {
  return useContext(ProfileContext);
}
