"use client";

import { useEffect } from "react";
import { loadMasterData } from "@/lib/master-data";

/** Fetches the lists members pick from (institutions, societies, research areas) once per page load; renders nothing. */
export function MasterDataLoader() {
  useEffect(() => { void loadMasterData(); }, []);
  return null;
}
