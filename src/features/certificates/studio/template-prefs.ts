/* Favourite and recently used templates: a per-person convenience kept in this browser (not shared, not saved with the conference). */
const FAV = "certstudio:favourite-templates";
const RECENT = "certstudio:recent-templates";

function read(key: string): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}
function write(key: string, list: string[]) {
  try { window.localStorage.setItem(key, JSON.stringify(list)); } catch { /* private window or storage blocked: the gallery still works */ }
}

export const loadFavourites = () => read(FAV);
export const loadRecent = () => read(RECENT);
export function toggleFavourite(key: string): string[] {
  const cur = read(FAV);
  const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
  write(FAV, next);
  return next;
}
export function rememberTemplate(key: string) {
  write(RECENT, [key, ...read(RECENT).filter((k) => k !== key)].slice(0, 4));
}
