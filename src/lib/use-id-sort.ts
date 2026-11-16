"use client";

import { useState } from "react";

/* ID-column sorting for tables (the prototype's src/shared/idSort.js). IDs like "ICTCS-12" or "ICTCS-102" are compared with their numbers
   as numbers, so 2 comes before 10. The first click on the heading sorts highest first, the second lowest first, the third puts the table
   back in its own order. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export const compareIds = (a: unknown, b: unknown) => collator.compare(String(a ?? ""), String(b ?? ""));

export function useIdSort() {
  const [dir, setDir] = useState<"asc" | "desc" | null>(null);
  const toggle = () => setDir((d) => (d === null ? "desc" : d === "desc" ? "asc" : null));
  const sort = <T,>(rows: T[], getId: (row: T) => string): T[] => (dir ? [...rows].sort((a, b) => (dir === "asc" ? 1 : -1) * compareIds(getId(a), getId(b))) : rows);
  return { dir, toggle, sort };
}
