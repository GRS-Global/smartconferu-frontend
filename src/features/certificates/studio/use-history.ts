"use client";

import { useCallback, useState } from "react";

/* Undo / redo for a document. A drag or a resize is ONE step: `begin()` remembers the starting document, `set()` updates live, `end()` records
   the step. Typing is coalesced: edits with the same key within `COALESCE_MS` are one step, so Ctrl+Z undoes a burst of typing, not a letter.

   Every state change is a pure function of the previous state (no refs touched inside updaters): React may call an updater twice in development,
   and a mutation in there would make the second call see a different world and drop the step. */

const LIMIT = 100;
const COALESCE_MS = 900;

interface State<T> {
  present: T; past: T[]; future: T[];
  /** The document a gesture started from (between begin() and end()). */
  base: T | null;
  /** The key and time of the last coalescable edit. */
  lastKey: string | null; lastAt: number;
}

export function useHistory<T>(initial: T) {
  const [state, setState] = useState<State<T>>({ present: initial, past: [], future: [], base: null, lastKey: null, lastAt: 0 });
  const resolve = <V,>(next: V | ((d: V) => V), from: V): V => (typeof next === "function" ? (next as (d: V) => V)(from) : next);

  const set = useCallback((next: T | ((d: T) => T)) => {
    setState((s) => ({ ...s, present: resolve(next, s.present) }));
  }, []);
  const begin = useCallback(() => { setState((s) => ({ ...s, base: s.present, lastKey: null })); }, []);
  const end = useCallback(() => {
    setState((s) => {
      if (s.base === null) return s;
      if (s.base === s.present) return { ...s, base: null };
      return { ...s, present: s.present, past: [...s.past, s.base].slice(-LIMIT), future: [], base: null };
    });
  }, []);
  /** One recorded step (or a coalesced one when `key` repeats quickly). */
  const commit = useCallback((next: T | ((d: T) => T), key?: string) => {
    const now = Date.now();
    setState((s) => {
      const value = resolve(next, s.present);
      if (value === s.present) return s;
      const same = key !== undefined && s.lastKey === key && now - s.lastAt < COALESCE_MS && s.past.length > 0;
      if (same) return { ...s, present: value, lastAt: now };
      return { ...s, present: value, past: [...s.past, s.present].slice(-LIMIT), future: [], lastKey: key ?? null, lastAt: now };
    });
  }, []);
  const undo = useCallback(() => {
    setState((s) => (s.past.length ? { ...s, present: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.present, ...s.future], lastKey: null } : s));
  }, []);
  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { ...s, present: s.future[0], past: [...s.past, s.present], future: s.future.slice(1), lastKey: null } : s));
  }, []);

  return { doc: state.present, set, begin, end, commit, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
