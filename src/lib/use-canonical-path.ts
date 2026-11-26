"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** On an older address (/submissions/<paper>/…), moves to the page's current one once it is known (the conference comes with the paper). */
export function useCanonicalPath(target: string | null) {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (target && path.startsWith("/submissions/")) router.replace(`${target}${window.location.search}${window.location.hash}`);
  }, [target, path, router]);
}
