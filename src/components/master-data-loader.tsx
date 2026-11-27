"use client";

import { useEffect } from "react";
import { loadMasterData } from "@/lib/master-data";

/** Fetches the lists members pick from (institutions, societies, research areas) once per page load; renders nothing. A screen that needs them asks for
 *  them itself (useMasterDataVersion); this loader waits a few seconds so about 50 KB of lists do not compete with what the page is showing first. */
export function MasterDataLoader() {
  useEffect(() => {
    const t = setTimeout(() => { void loadMasterData(); }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
