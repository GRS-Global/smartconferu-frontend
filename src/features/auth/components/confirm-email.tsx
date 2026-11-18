"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { DEFAULT_AFTER_LOGIN, LOGIN_PATH } from "@/lib/auth-redirect";
import { AUTH_API, PROTOTYPE_URL } from "@/lib/config";
import { MfaRequiredError } from "@/services/errors";
import { MfaCodeForm } from "./mfa-code-form";

/** One confirmation per link: the token works once, and React may run the effect twice in development. */
const runs = new Map<string, Promise<unknown>>();

type Phase = { kind: "checking" } | { kind: "done" } | { kind: "mfa" } | { kind: "invalid"; message: string };

/** Where the "Confirm my email" link of the sign-up email lands (`/verify-email?token=…`). The backend confirms the address and
 *  signs the person in, so on success they go straight to their dashboard. */
export function ConfirmEmail() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    let live = true;
    const token = new URLSearchParams(window.location.search).get("token");
    const fail = (message: string) => { if (live) setPhase({ kind: "invalid", message }); };
    if (!AUTH_API) { fail("Email confirmation links are handled by the sign-in service; open the link again from your email."); return undefined; }
    if (!token) { fail("This confirmation link is incomplete — open it again from your email, or sign in to ask for a new one."); return undefined; }
    const run = runs.get(token) ?? import("@/services/api/auth").then((m) => m.confirmEmail(token));
    runs.set(token, run);
    run.then(
      () => { if (!live) return; setPhase({ kind: "done" }); router.replace(DEFAULT_AFTER_LOGIN); router.refresh(); },
      (e: unknown) => (e instanceof MfaRequiredError ? (live && setPhase({ kind: "mfa" })) : fail(e instanceof Error ? e.message : "This link has expired or was already used. Sign in to get a new one.")),
    );
    return () => { live = false; };
  }, [router]);

  return (
    <div className="relative z-10 w-full max-w-[480px]">
      <a href={`${PROTOTYPE_URL}/`} className="mb-8 flex items-center justify-center text-center transition-opacity hover:opacity-90" aria-label="Smartconferu home">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={36} height={36} priority className="h-9 w-auto" />
        </span>
      </a>
      <div className="rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-1 text-xl font-bold text-navy">Confirm your email</h1>
        {phase.kind === "checking" && <p role="status" className="text-sm text-ink-muted">Confirming your email address…</p>}
        {phase.kind === "mfa" && <MfaCodeForm onVerified={() => { router.replace(DEFAULT_AFTER_LOGIN); router.refresh(); }} onCancel={() => router.replace(LOGIN_PATH)} />}
        {phase.kind === "done" && <AuthMessage>Email confirmed — taking you to your conferences…</AuthMessage>}
        {phase.kind === "invalid" && (
          <>
            <p role="alert" className="mb-5 text-sm text-ink-muted">{phase.message}</p>
            <Link href={LOGIN_PATH} className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
