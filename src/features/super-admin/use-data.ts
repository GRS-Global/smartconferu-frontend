"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface Loaded<T> {
  key: string;
  tick: number;
  data?: T;
  error?: unknown;
}

/** Loads data for a page: `data`, `error`, `loading` and `reload()`. Reloads when `deps` change.
 *  The previous data stays visible while a reload runs. No fallback data. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const key = JSON.stringify(deps);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Loaded<T>>({ key: "", tick: -1 });
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let live = true;
    loadRef.current().then(
      (data) => live && setState({ key, tick, data }),
      (error: unknown) => live && setState((s) => ({ key, tick, data: s.data, error })),
    );
    return () => {
      live = false;
    };
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setState((s) => ({ ...s, data, error: undefined })), []);
  const loading = state.key !== key || state.tick !== tick;
  return { data: state.data, error: loading ? undefined : state.error, loading, reload, setData };
}
