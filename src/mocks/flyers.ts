import type { FlyerService } from "@/services/flyers";
import type { SavedFlyer } from "@/features/flyer/data";

/* NEXT_PUBLIC_DATA_SOURCE=mock only (UI work: no network, no accounts). The flyer is kept in memory for the page's lifetime; nothing is stored. */
const store = new Map<string, SavedFlyer>();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const mockFlyerService: FlyerService = {
  async load(id) { const s = store.get(id); return s ? clone(s) : null; },
  // The mock has one conference, so whatever the chair saved is what its authors see.
  async loadPublished() { const s = [...store.values()].find((x) => x.published); return s ? clone(s.design) : null; },
  async countDownload() { for (const s of store.values()) s.downloads += 1; },
  async save(id, design, published) {
    const saved: SavedFlyer = { design: clone(design), published, downloads: store.get(id)?.downloads ?? 0 };
    store.set(id, saved);
    return clone(saved);
  },
};
