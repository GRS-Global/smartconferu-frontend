"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { loginUrl } from "@/lib/auth-redirect";
import { authService } from "../auth-service";

// One sign-out at a time: two screens can notice the ended session together, and a second, late sign-out
// (queued behind a new sign-in on the auth lock) must never end a session that has just been started.
let ending: Promise<void> | null = null;
// Recovery (reload and try again) is offered once per few seconds: if the server keeps refusing a session it calls valid, end it.
let lastRecovery = 0;

/** The session is gone or was refused while loading. Before acting it asks the auth server: a stale "ended"
 *  screen (kept alive by Next's Activity while the user signed in again) finds a valid session and just asks the
 *  screen to load again (`onRecovered`); otherwise it clears the local session (so the proxy can't bounce us
 *  straight back) and goes to the login page, which returns here after sign-in. Renders nothing. */
export function SessionEnded({ onRecovered }: { onRecovered?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await authService();
      // A network failure is not a sign-out: treat the session as still valid and let the screen retry.
      const valid = await auth.isSignedIn().catch(() => true);
      if (cancelled) return;
      if (valid && onRecovered && Date.now() - lastRecovery > 5000) { lastRecovery = Date.now(); onRecovered(); return; }
      ending ??= auth.signOut().finally(() => { setTimeout(() => { ending = null; }, 3000); });
      await ending;
      if (!cancelled) router.replace(loginUrl(pathname, "expired"));
    })();
    return () => { cancelled = true; };
  }, [router, pathname, onRecovered]);
  return null;
}
