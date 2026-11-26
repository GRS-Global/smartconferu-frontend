"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { refreshSession } from "@/lib/api-client";
import { LOGIN_PATH, safeNext } from "@/lib/auth-redirect";
import { MfaCodeForm } from "./mfa-code-form";

const ERRORS: Record<string, string> = {
  cancelled: "The sign-in was cancelled. You can try again or use another option.",
  invalid_state: "This sign-in link has expired or was opened in another browser. Please start again from the sign-in page.",
  provider_error: "The provider couldn't sign you in. Please try again, or use another option.",
  identity_in_use: "That account is already connected to a different Smartconferu account.",
  account_disabled: "This account has been disabled. Please contact support.",
};

type Phase = { kind: "checking" } | { kind: "mfa"; next: string } | { kind: "error"; message: string };

/** Where the provider sign-in (Google, Microsoft, ORCID) returns to: `/auth/callback?status=…&next=…[&error=…]`.
 *  The backend has already set its session cookie, so on success this only asks it for the access token and moves on. */
export function OAuthCallback() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams(window.location.search);
    const next = safeNext(q.get("next"));
    const status = q.get("status");
    const error = q.get("error");
    const fail = (message: string) => { if (live) setPhase({ kind: "error", message }); };
    if (error) { fail(ERRORS[error] ?? "The sign-in didn't work. Please try again."); return undefined; }
    if (status === "mfa_required") { const t = setTimeout(() => { if (live) setPhase({ kind: "mfa", next }); }, 0); return () => { live = false; clearTimeout(t); }; }
    if (status !== "signed_in" && status !== "linked") { fail("This page is opened by a provider sign-in. Please start from the sign-in page."); return undefined; }
    void refreshSession().then((ok) => {
      if (!live) return;
      if (ok) { router.replace(next); router.refresh(); } else fail("We couldn't finish signing you in. Please try again.");
    }).catch((e: unknown) => fail(e instanceof Error ? e.message : "We couldn't finish signing you in. Please try again."));
    return () => { live = false; };
  }, [router]);

  return (
    <div className="relative z-10 w-full max-w-[480px]">
      <Link href="/" className="mb-8 flex items-center justify-center text-center transition-opacity hover:opacity-90" aria-label="Smartconferu home">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={36} height={36} priority className="h-9 w-auto" />
        </span>
      </Link>
      <div className="rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-1 text-xl font-bold text-navy">Signing you in</h1>
        {phase.kind === "checking" && <p role="status" className="text-sm text-ink-muted">Finishing your sign-in…</p>}
        {phase.kind === "mfa" && <MfaCodeForm onVerified={() => { router.replace(phase.next); router.refresh(); }} onCancel={() => router.replace(LOGIN_PATH)} />}
        {phase.kind === "error" && (
          <>
            <AuthMessage tone="error">{phase.message}</AuthMessage>
            <Link href={LOGIN_PATH} className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
