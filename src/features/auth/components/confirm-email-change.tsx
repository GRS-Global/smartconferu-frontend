"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthMessage } from "@/components/ui/auth-message";
import { DEFAULT_AFTER_LOGIN, LOGIN_PATH } from "@/lib/auth-redirect";
import { AUTH_API } from "@/lib/config";

/** One confirmation per link: the token works once, and React may run the effect twice in development. */
const runs = new Map<string, Promise<unknown>>();

type Phase = { kind: "checking" } | { kind: "done" } | { kind: "invalid"; message: string };

/** Where the "Confirm this address" link of the change-email message lands (`/confirm-email?token=…`). It works without being signed in:
 *  the link itself proves the new address. Afterwards the person signs in with it (their sessions stay as they were). */
export function ConfirmEmailChange() {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    let live = true;
    const token = new URLSearchParams(window.location.search).get("token");
    const fail = (message: string) => { if (live) setPhase({ kind: "invalid", message }); };
    if (!AUTH_API) { fail("Email change links are handled by the sign-in service; open the link again from your email."); return undefined; }
    if (!token) { fail("This link is incomplete — open it again from your email, or ask for a new one in Settings."); return undefined; }
    const run = runs.get(token) ?? import("@/services/api/security").then((m) => m.confirmEmailChange(token));
    runs.set(token, run);
    run.then(
      () => { if (live) setPhase({ kind: "done" }); },
      (e: unknown) => fail(e instanceof Error ? e.message : "This link has expired or was already used. Please ask for a new one in Settings."),
    );
    return () => { live = false; };
  }, []);

  return (
    <div className="relative z-10 w-full max-w-[480px]">
      <Link href="/" className="mb-8 flex items-center justify-center text-center transition-opacity hover:opacity-90" aria-label="Smartconferu home">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={36} height={36} priority className="h-9 w-auto" />
        </span>
      </Link>
      <div className="rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-1 text-xl font-bold text-navy">Confirm your new email</h1>
        {phase.kind === "checking" && <p role="status" className="text-sm text-ink-muted">Confirming your new email address…</p>}
        {phase.kind === "done" && (
          <>
            <AuthMessage>Your email address was changed. From now on sign in with the new address.</AuthMessage>
            <Link href={DEFAULT_AFTER_LOGIN} className="mb-2 block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Go to my conferences</Link>
            <Link href={LOGIN_PATH} className="block w-full text-center text-xs font-semibold text-ink-muted hover:underline">Back to sign in</Link>
          </>
        )}
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
