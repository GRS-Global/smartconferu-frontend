"use client";

import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** The "Coming soon" card for Smart CFP. "Go back" returns to where the person came from (the menu, or the sign-in page); a direct visit has nothing to go back to, so it falls back to My Conferences. */
export function SmartCfpSoon() {
  const router = useRouter();
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/dashboard");
  };
  return (
    <div className="relative z-10 w-full max-w-[480px]">
      <Link href="/" className="mb-8 flex items-center justify-center text-center transition-opacity hover:opacity-90" aria-label="Smartconferu home">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
          <Image src="/smartconferu-mark.png" alt="Smartconferu" width={36} height={36} priority className="h-9 w-auto" />
        </span>
      </Link>
      <div className="rounded-2xl bg-white p-8 text-center shadow-2xl">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"><Sparkles size={22} aria-hidden="true" /></span>
        <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">Coming soon</span>
        <h1 className="mt-3 text-xl font-bold text-navy">Smart CFP</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Browse and search calls for papers from conferences around the world, in one place. We&apos;re still building it — it will be here soon.</p>
        <button type="button" onClick={back} className="mt-6 w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Go back</button>
      </div>
    </div>
  );
}
