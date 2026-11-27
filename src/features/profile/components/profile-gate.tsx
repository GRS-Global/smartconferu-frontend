"use client";

import { TriangleAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { completeProfileUrl } from "@/lib/auth-redirect";
import { getProfileCompleteness } from "../completeness";
import { useProfile } from "../profile-context";

const noSubscribe = () => () => undefined;

function Waiting({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-5 p-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl border border-line bg-white" />
    </div>
  );
}

/** The post-login profile-completeness gate for the signed-in screens.
 *  - still loading → a placeholder (the page is not shown yet);
 *  - the profile could not be read → an error with "Try again" (never treated as incomplete);
 *  - loaded and missing required details → /complete-profile?next=<this page>;
 *  - loaded and complete → the page. */
export function ProfileGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, reload } = useProfile();
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const incomplete = state.status === "ready" && getProfileCompleteness(state.profile).missingRequired.length > 0;

  useEffect(() => {
    if (incomplete) router.replace(completeProfileUrl(`${pathname}${window.location.search}`));
  }, [incomplete, router, pathname]);

  if (state.status === "disabled") return <>{children}</>;
  if (state.status === "auth") return <SessionEnded onRecovered={reload} />;
  if (state.status === "error") {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-line bg-white">
          <EmptyState
            icon={TriangleAlert}
            title={state.config ? "The database connection isn't set up." : "Couldn't load your profile."}
            description={state.message}
            action={state.config ? undefined : <Button size="sm" onClick={reload}>Try again</Button>}
          />
        </div>
      </div>
    );
  }
  if (incomplete) return <Waiting label="Taking you to your profile" />;
  // While the profile loads, the page is already rendered but kept out of sight: its code and its data load at the same time as the
  // profile instead of after it. The wrapper stays the same when it shows, so the page is not mounted twice.
  // Only in the browser: the server render (and the prerender) shows the placeholder alone, as before.
  const loading = state.status === "loading";
  return (
    <>
      {(loading || !inBrowser) && <Waiting label="Loading your profile" />}
      {inBrowser && <div style={{ display: loading ? "none" : "contents" }}>{children}</div>}
    </>
  );
}
