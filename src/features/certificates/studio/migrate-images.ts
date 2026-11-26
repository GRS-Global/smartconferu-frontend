import type { StudioElement } from "./model";

/* Designs saved before the picture library hold their pictures inside the design (data URLs). This moves them into the library: for every image
   element with a data URL it makes a file, asks `create` to store it (which returns the new `src`, e.g. `asset:<id>`) and reports which element got
   which new `src`. A picture that cannot be moved (refused by `check`, an upload that fails, an unreadable data URL) is skipped and stays as it is:
   nothing is lost. Kept free of app imports so it can be tested on its own. */

export interface MigrateDeps {
  /** Stores the file and returns the `src` the element should use from now on. */
  create(file: File, name: string): Promise<string>;
  /** "" when the file can go into the library, else why not. */
  check(file: File): string;
}

export async function migrateDataImages(elements: StudioElement[], deps: MigrateDeps): Promise<Map<string, string>> {
  const moved = new Map<string, string>();
  const done = new Map<string, string>(); // the same picture used twice is stored once
  for (const el of elements) {
    if (el.type !== "image" || !el.src?.startsWith("data:")) continue;
    const already = done.get(el.src);
    if (already) { moved.set(el.id, already); continue; }
    try {
      const blob = await (await fetch(el.src)).blob();
      const file = new File([blob], el.name || "Picture", { type: blob.type });
      if (deps.check(file)) continue;
      const src = await deps.create(file, el.name || "Picture");
      done.set(el.src, src);
      moved.set(el.id, src);
    } catch { /* leave this one where it is */ }
  }
  return moved;
}
