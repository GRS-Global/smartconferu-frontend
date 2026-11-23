"use client";

import { useEffect } from "react";

/* A browser's date field only opens its calendar from the little icon at its right edge; a click on the text itself just selects the day / month / year.
   People expect the calendar to open wherever they click in the box, so this opens it for every date and date-and-time field of the app. Typing a date
   still works (the calendar is only a help). Nothing is rendered. */

const KINDS = new Set(["date", "datetime-local", "month", "week"]);

export function OpenDatePicker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || !KINDS.has(el.type) || el.disabled || el.readOnly) return;
      // `showPicker` may refuse (an old browser, or the calendar is already open): the field then simply behaves as before.
      try { el.showPicker(); } catch { /* keep the default behaviour */ }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
