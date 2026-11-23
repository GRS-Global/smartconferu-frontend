"use client";

/* The lists members pick from (institutions, societies, research areas) come from the backend's master data, which the
   Super Admin keeps: new names, short forms ("GTU" for Gujarat Technological University), renames, retirements.
   The static lists in institutions.ts / societies.ts / research-areas.ts are the starting point and the fallback: they
   are what shows until the backend answers, and what stays if it cannot be reached. When it answers, the lists are
   replaced IN PLACE (same arrays and objects), so every screen that imports them sees the new content on its next
   render; `useMasterDataVersion()` makes a screen render again once the lists arrive. Own-backend mode only. */
import { useSyncExternalStore } from "react";
import { API_URL, DATA_SOURCE } from "./config";
import { INSTITUTIONS, type Institution } from "./institutions";
import { RESEARCH_AREA_GROUPS, RESEARCH_AREAS, RESEARCH_SUBAREAS } from "./research-areas";
import { SOCIETIES, type Society } from "./societies";

interface ApiInstitution { key: string; name: string; aliases: string[]; country: string | null; departments: string[] }
interface ApiSociety { key: string; name: string; acronym: string; url: string | null }
interface ApiArea { name: string; subareas: { name: string }[] }
interface ApiGroup { label: string; areas: ApiArea[] }

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Changes when the lists were replaced by the backend's; use it to render a screen again. */
export function useMasterDataVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/master-data/${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`master data ${path}: ${res.status}`);
  return (await res.json()) as T;
}

function applyInstitutions(rows: ApiInstitution[]) {
  const next: Institution[] = rows.map((r) => ({
    id: r.key, name: r.name, aliases: r.aliases ?? [], country: r.country ?? "", ...(r.departments?.length ? { departments: r.departments } : {}),
  }));
  INSTITUTIONS.splice(0, INSTITUTIONS.length, ...next);
}

function applySocieties(rows: ApiSociety[]) {
  // The shipped logos are named after the society's key; a society the Super Admin added has none (the acronym tile shows).
  const logos = new Map(SOCIETIES.map((s) => [s.id, s.logo]));
  const next: Society[] = rows.map((r) => ({ id: r.key, name: r.name, acronym: r.acronym, url: r.url ?? "", logo: logos.get(r.key) ?? "" }));
  SOCIETIES.splice(0, SOCIETIES.length, ...next);
}

function applyAreas(groups: ApiGroup[]) {
  RESEARCH_AREA_GROUPS.splice(0, RESEARCH_AREA_GROUPS.length, ...groups.map((g) => ({ label: g.label, areas: g.areas.map((a) => a.name) })));
  RESEARCH_AREAS.splice(0, RESEARCH_AREAS.length, ...RESEARCH_AREA_GROUPS.flatMap((g) => g.areas));
  for (const k of Object.keys(RESEARCH_SUBAREAS)) delete RESEARCH_SUBAREAS[k];
  for (const g of groups) for (const a of g.areas) RESEARCH_SUBAREAS[a.name] = a.subareas.map((s) => s.name);
}

let started: Promise<void> | null = null;

/** Loads the three lists once (they are public: no sign-in needed). A list that cannot be loaded, or comes back empty, stays as it was. */
export function loadMasterData(): Promise<void> {
  if (DATA_SOURCE !== "api") return Promise.resolve();
  started ??= Promise.allSettled([
    get<ApiInstitution[]>("institutions").then((r) => { if (r.length) applyInstitutions(r); }),
    get<ApiSociety[]>("societies").then((r) => { if (r.length) applySocieties(r); }),
    get<ApiGroup[]>("research-areas").then((r) => { if (r.length) applyAreas(r); }),
  ]).then(() => { version += 1; listeners.forEach((fn) => fn()); });
  return started;
}
