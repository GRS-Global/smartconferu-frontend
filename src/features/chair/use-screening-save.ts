"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getChairService } from "@/services/chair";
import type { ChairPaper, ScreeningRecord } from "@/types/chair";

/** The chair's edits to a paper's screening records: shown at once, saved through `save_screening` shortly after (or now), and undone with a
 *  message when the database refuses. Used by the paper's own Initial Check / Plagiarism Check pages (the tables keep their own copy). */
export function useScreeningSave(onError: (title: string, text: string) => void, reload: () => void) {
  const [local, setLocal] = useState<Record<string, ScreeningRecord>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => { const t = timers.current; return () => { Object.values(t).forEach(clearTimeout); }; }, []);
  const recOf = useCallback((p: ChairPaper, n: number): ScreeningRecord | undefined => local[`${p.dbId}:${n}`] ?? p.screening[String(n)], [local]);
  const persist = useCallback((p: ChairPaper, n: number, rec: ScreeningRecord, now = false) => {
    const k = `${p.dbId}:${n}`;
    setLocal((l) => ({ ...l, [k]: rec }));
    clearTimeout(timers.current[k]);
    const save = async () => {
      // The automatic check lives with the file, not in the chair's record.
      const { auto, ...record } = rec as ScreeningRecord & { auto?: unknown }; void auto;
      try { await (await getChairService()).saveScreening(p.dbId, n, JSON.parse(JSON.stringify(record))); } catch (err) {
        onError("Couldn't save the change", err instanceof Error ? err.message : "Something went wrong.");
        setLocal({}); reload();
      }
    };
    if (now) return save();
    timers.current[k] = setTimeout(() => { void save(); }, 400);
    return Promise.resolve();
  }, [onError, reload]);
  return { local, recOf, persist };
}
