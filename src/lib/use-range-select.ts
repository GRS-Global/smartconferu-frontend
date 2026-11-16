"use client";

import { useEffect, useRef, type MouseEvent } from "react";

/* Row selection the way spreadsheets and mail apps do it (the prototype's src/shared/useRangeSelect.js):
     click            tick / untick one row (and remember it as the starting point)
     Shift + click    tick every row from the starting point to this one, or untick them all when the row clicked is being unticked
     press and drag   down (or up) across the checkboxes ticks, or unticks, every row passed over
   `setMany(ids, on)` ticks (on = true) or unticks every id given, in one state update. */
export interface RangeConfig { ids: string[]; isSelected: (id: string) => boolean; setMany: (ids: string[], on: boolean) => void }
interface Drag { from: string; on: boolean; cfg: RangeConfig; moved: boolean }

export function useRangeSelect() {
  const anchor = useRef<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    const end = () => {
      if (!drag.current) return;
      if (drag.current.moved) { justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0); }
      drag.current = null;
      document.body.style.userSelect = "";
    };
    window.addEventListener("mouseup", end);
    window.addEventListener("blur", end);
    return () => { window.removeEventListener("mouseup", end); window.removeEventListener("blur", end); };
  }, []);

  return (cfg: RangeConfig) => {
    const between = (a: string, b: string) => {
      const i = cfg.ids.indexOf(a), j = cfg.ids.indexOf(b);
      if (i < 0 || j < 0) return [b];
      return cfg.ids.slice(Math.min(i, j), Math.max(i, j) + 1);
    };
    return {
      box: (id: string) => ({
        onMouseDown: (e: MouseEvent) => {
          if (e.button !== 0 || e.shiftKey) return;
          drag.current = { from: id, on: !cfg.isSelected(id), cfg, moved: false };
          document.body.style.userSelect = "none";
        },
        onClick: (e: MouseEvent) => {
          e.stopPropagation();
          if (justDragged.current) return;
          const on = !cfg.isSelected(id);
          cfg.setMany(e.shiftKey && anchor.current != null ? between(anchor.current, id) : [id], on);
          anchor.current = id;
        },
        onChange: () => undefined,
        title: "Click to select · Shift + click to select a range · Drag to select several",
      }),
      row: (id: string) => ({
        onMouseEnter: () => {
          const d = drag.current;
          if (!d || d.from === id) return;
          d.moved = true;
          d.cfg.setMany(between(d.from, id), d.on);
          anchor.current = id;
        },
      }),
    };
  };
}
