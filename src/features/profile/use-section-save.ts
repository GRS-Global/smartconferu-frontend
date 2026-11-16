"use client";

import { useEffect, useRef, useState } from "react";

/** Busy / error / "Saved" state for one profile card's Save. Errors are shown to the user and the card stays editable. */
export function useSectionSave(onSuccess?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await fn();
      setSaved(true);
      onSuccess?.();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, saved, run, clear: () => setError("") };
}

export type SectionSave = ReturnType<typeof useSectionSave>;
