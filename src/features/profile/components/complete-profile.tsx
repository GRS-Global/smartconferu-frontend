"use client";

import { TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { authService } from "@/features/auth/auth-service";
import { safeNext } from "@/lib/auth-redirect";
import { getProfileCompleteness } from "../completeness";
import { useProfile } from "../profile-context";
import { useIdentityForm } from "../use-identity-form";
import { remainingRequired } from "../validation";
import type { Profile } from "@/types/profile";
import { CompletenessMeter } from "./completeness-meter";
import { IdentityFields } from "./identity-fields";

/** "One last step before you get started": the required details a new account still owes (ported from the
 *  prototype's CompleteProfilePage). Complete accounts never stay here: they go straight on to `next`. */
export function CompleteProfile() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { state, reload } = useProfile();
  const complete = state.status === "ready" && getProfileCompleteness(state.profile).missingRequired.length === 0;

  useEffect(() => {
    if (state.status === "disabled" || complete) router.replace(next);
  }, [state.status, complete, router, next]);

  if (state.status === "auth") return <SessionEnded onRecovered={reload} />;
  if (state.status === "loading" || state.status === "disabled" || complete) {
    return <div role="status" aria-label="Loading your profile" className="relative z-10 h-80 w-full max-w-[800px] animate-pulse rounded-2xl bg-white/90" />;
  }
  if (state.status === "error") {
    return (
      <div className="relative z-10 w-full max-w-[800px] rounded-2xl bg-white shadow-2xl">
        <EmptyState
          icon={TriangleAlert}
          title={state.config ? "The database connection isn't set up." : "Couldn't load your profile."}
          description={state.message}
          action={state.config ? undefined : <Button size="sm" onClick={reload}>Try again</Button>}
        />
      </div>
    );
  }
  return <CompleteProfileForm key={state.profile.userId} profile={state.profile} next={next} />;
}

function CompleteProfileForm({ profile, next }: { profile: Profile; next: string }) {
  const router = useRouter();
  const { save, uploadPhoto } = useProfile();
  const form = useIdentityForm(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const { missing, emailInvalid } = remainingRequired({ ...profile, ...form.values, affiliation: form.inst.name });
  const blockers = Object.keys(form.problems).filter((k) => k === "webPage" || k === "phone").length;
  const left = missing.length + (emailInvalid ? 1 : 0) + blockers;
  const canContinue = left === 0 && !busy && !saved;

  const submit = async () => {
    if (!canContinue) { form.touchAll(); return; }
    setBusy(true);
    setError("");
    try {
      const { patch, newPhoto } = form.buildPatch();
      if (newPhoto) patch.photoPath = await uploadPhoto(newPhoto);
      await save(patch);
      setSaved(true);
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      setBusy(false);
    }
  };

  const signOut = async () => {
    await (await authService()).signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="relative z-10 w-full max-w-[800px]">
      <div className="mb-8 flex flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={24} height={36} priority className="h-9 w-6" />
        </span>
        <p className="text-xs text-white/60">One last step before you get started</p>
      </div>

      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="rounded-2xl bg-white p-8 shadow-2xl" aria-labelledby="complete-title">
        <h1 id="complete-title" className="mb-1 text-xl font-bold text-navy">Complete your profile</h1>
        <p className="mb-5 text-sm text-ink-muted">
          A few details are missing from your profile. Organizers need a little more before you can submit, review or register — fields marked <span className="text-danger-ink">*</span> are required.
        </p>
        <div className="mb-5"><CompletenessMeter completeness={form.completeness} /></div>

        <div className="mb-5 rounded-xl border border-line p-5">
          <IdentityFields form={form} email={profile.mainEmail} emailNote="The email you sign in with. You can add other addresses later in My Account." idPrefix="complete" />
        </div>

        {error && <AuthMessage tone="error">{error}</AuthMessage>}
        {saved && <AuthMessage>Saved — taking you to Smartconferu…</AuthMessage>}
        <button type="submit" disabled={!canContinue} className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-ink-faint">
          {saved || busy ? "Saving…" : canContinue ? "Continue to Smartconferu" : `Fill in ${left} more required field${left === 1 ? "" : "s"}`}
        </button>

        <p className="mt-5 text-center text-xs text-ink-muted">
          Not you? <button type="button" onClick={() => void signOut()} className="font-semibold text-primary hover:underline">Sign out</button>
        </p>
      </form>
    </div>
  );
}
