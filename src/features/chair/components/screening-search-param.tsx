"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/* A chair notification about one paper opens a screening table with its ID filter already set (the prototype's `initialSearch`, from the
   notification's `screeningSearch`). Like the prototype, the filter is only the table's starting state: it is applied once on arrival and
   the `?search=` is then removed from the address, so a refresh shows the whole table again. Only a paper label ("ISBM-680") is accepted. */
const PAPER = /^[A-Za-z0-9]{1,40}-\d{1,9}$/;

function Reader({ onSearch }: { onSearch: (id: string) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("search");
  useEffect(() => {
    if (q === null) return;
    if (PAPER.test(q)) onSearch(q);
    router.replace(pathname, { scroll: false });
    // onSearch is a fresh function each render; only a new ?search= should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return null;
}

export function ScreeningSearchParam({ onSearch }: { onSearch: (id: string) => void }) {
  return <Suspense fallback={null}><Reader onSearch={onSearch} /></Suspense>;
}
