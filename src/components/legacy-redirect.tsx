"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** An older address of a page: moves to its current one (keeping ?query and #hash), so links in emails sent before still work. */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    const extra = to.includes("?") ? window.location.search.replace(/^\?/, "&") : window.location.search;
    router.replace(`${to}${extra === "&" ? "" : extra}${window.location.hash}`);
  }, [router, to]);
  return <div role="status" aria-label="Opening the page" className="p-4 sm:p-8"><div className="h-48 animate-pulse rounded-2xl border border-line bg-white" /></div>;
}
