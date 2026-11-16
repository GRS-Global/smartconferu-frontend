"use client";

import { useEffect } from "react";
import { useOptionalProfile } from "@/features/profile/profile-context";

/** Applies the saved "Color-blind mode" preference: status colors switch to a palette that is easier to tell apart
 *  (the overrides live in tokens.css under [data-colorblind]). It follows the *stored* value, so the page only
 *  changes once the preference has actually been saved. Renders nothing. */
export function ColorBlindApplier() {
  const ctx = useOptionalProfile();
  const on = ctx?.state.status === "ready" && ctx.state.profile.colorBlindMode;
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.colorblind = "true";
    else delete root.dataset.colorblind;
    return () => { delete root.dataset.colorblind; };
  }, [on]);
  return null;
}
