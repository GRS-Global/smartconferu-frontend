"use client";

import { useEffect, useState } from "react";
import { getCertificateService } from "@/services/certificates";
import type { CertTypeKey } from "./data";

/** The kinds of certificate an author earns (the prototype's ROLE_CERTIFICATE.author). */
export const AUTHOR_CERTIFICATE_TYPES: CertTypeKey[] = ["presentation", "author", "publication", "participation"];

/** How many certificates of these kinds the signed-in person holds from one conference (0 while loading or when there are none): what
 *  turns an author's "Certificate" buttons and the wrap-up card from "not yet" to "ready". Never in the page's way. */
export function useConferenceCertificates(slug: string, types: CertTypeKey[] = AUTHOR_CERTIFICATE_TYPES): number {
  const [count, setCount] = useState(0);
  const key = types.join(",");
  useEffect(() => {
    let alive = true;
    getCertificateService()
      .then((s) => s.mine())
      .then((list) => { if (alive) setCount(list.filter((c) => c.conference.id === slug && key.split(",").includes(c.typeKey)).length); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [slug, key]);
  return count;
}
