import type { RoleFilter } from "./roles";
import { ROLE_ORDER } from "./roles";
import type { Sort } from "./components/table-parts";

/* The list's view state, kept for this browser tab (sessionStorage) so leaving for a conference and
   coming back lands on the same list. The last role picked is also kept across tabs (localStorage),
   so a new tab opens on it; a refresh of the dashboard itself starts over on "All conferences".
   Storage can be unavailable (private mode) — then the dashboard simply starts fresh. */

export type CertFilter = "any" | "issued" | "not";
export type NumRule = "any" | "some" | "none";

export interface DFilters {
  id: string;
  text: string;
  years: string[];
  countries: string[];
  cert: CertFilter;
  num: Record<string, NumRule>;
  role: Record<string, string[]>;
}

export const D_EMPTY: DFilters = { id: "", text: "", years: [], countries: [], cert: "any", num: {}, role: {} };

export interface SavedView {
  roleFilter?: RoleFilter;
  sort?: Sort | null;
  status?: "all" | "active" | "archived";
  search?: string;
  filters?: Partial<DFilters>;
  scrollY?: number;
}

const VIEW_KEY = "smartconferu.dashboard.view";
const LAST_ROLE_KEY = "smartconferu.dashboard.lastRole";

export function readView(): SavedView {
  try { return JSON.parse(window.sessionStorage.getItem(VIEW_KEY) || "{}") || {}; } catch { return {}; }
}

export function writeView(patch: SavedView): void {
  try { window.sessionStorage.setItem(VIEW_KEY, JSON.stringify({ ...readView(), ...patch })); } catch { /* storage off — nothing to keep */ }
}

export function writeLastRole(role: RoleFilter): void {
  try { window.localStorage.setItem(LAST_ROLE_KEY, role); } catch { /* storage off */ }
}

// Read once per page load: was this load a refresh of the dashboard itself?
let refreshPending: boolean | null = null;
function isDashboardRefresh(): boolean {
  if (refreshPending === null) {
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      refreshPending = nav?.type === "reload" && /\/dashboard(\/|$)/.test(window.location.pathname);
    } catch { refreshPending = false; }
  }
  return refreshPending;
}

export function initialView(): SavedView {
  if (isDashboardRefresh()) {
    refreshPending = false;
    try { window.sessionStorage.removeItem(VIEW_KEY); } catch { /* storage off */ }
    writeLastRole("all");
    return {};
  }
  const view = readView();
  if (view.roleFilter) return view;
  let last: string | null = null;
  try { last = window.localStorage.getItem(LAST_ROLE_KEY); } catch { /* storage off */ }
  return ROLE_ORDER.includes(last as RoleFilter) ? { ...view, roleFilter: last as RoleFilter } : view;
}
