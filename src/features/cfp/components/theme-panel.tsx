"use client";

import { Check, Info, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import { CFP_THEMES, themeOf } from "../themes";
import { CfpPublicPreview, type CfpPreviewProps } from "./cfp-public-preview";

/* Change theme (the prototype's ChangeThemePage): pick one of the five looks, see the page change at once, apply. The theme is kept in `cfps.theme`. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;

export function ThemePanel({ slug, acronym, currentId, preview, onDone, onSaved, onSessionEnded }: { slug: string; acronym: string; currentId: string; preview: Omit<CfpPreviewProps, "accent" | "heading">; onDone: () => void; onSaved: () => void; onSessionEnded: () => void }) {
  const [selected, setSelected] = useState(currentId);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const theme = themeOf(selected);
  const apply = async () => {
    setBusy(true); setError("");
    try { await (await getCfpService()).saveTheme(slug, selected); setSaved(true); onSaved(); } catch (e) {
      if (e instanceof AuthRequiredError) onSessionEnded(); else setError(e instanceof Error ? e.message : "Couldn't save the theme.");
    } finally { setBusy(false); }
  };

  if (saved) {
    return (
      <div className="flex items-center justify-center p-8" style={{ minHeight: "60vh" }}>
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft"><Check size={28} strokeWidth={2.5} aria-hidden="true" className="text-success-ink" /></div>
          <h2 className="mb-2 text-lg font-bold text-navy">Theme applied</h2>
          <p className="mb-6 text-sm text-ink-muted">{acronym} now uses the {theme.label} theme.</p>
          <Button onClick={onDone}>Back to Overview</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div style={{ border: "1px solid var(--primary-soft-border)" }} className="flex items-start gap-2.5 rounded-xl bg-primary-soft px-4 py-3">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-[#1E4E8C]">{acronym} currently uses the <strong>{themeOf(currentId).label}</strong> theme. Pick a new one below — the preview updates instantly. Click &quot;Apply Theme&quot; to publish the change.</p>
      </div>
      <div style={CARD} className="rounded-2xl bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-extrabold text-navy"><Sparkles size={16} aria-hidden="true" className="text-primary" /> Pick a theme</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CFP_THEMES.map((t) => {
            const on = selected === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setSelected(t.id)} aria-pressed={on} style={{ border: on ? `2px solid ${t.accent}` : "1.5px solid var(--border)", background: on ? t.tint : "#FFFFFF" }} className="relative cursor-pointer rounded-xl p-3 text-left transition-colors">
                {on && <span style={{ background: t.accent }} className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"><Check size={10} strokeWidth={3} aria-hidden="true" className="text-white" /></span>}
                <span style={{ background: t.accent }} className="mb-2.5 block h-8 w-full rounded-lg" />
                <div className="mb-0.5 text-xs font-bold text-ink">{t.label}</div>
                <div className="text-[10.5px] leading-snug text-ink-faint">{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
      <CfpPublicPreview {...preview} accent={theme.accent} heading="Live preview — how authors will see this CFP" />
      {error && <p role="alert" className="text-sm font-semibold text-danger-ink">{error}</p>}
      <div className="flex items-center justify-between pb-4 pt-1">
        <Button variant="outline" onClick={onDone} disabled={busy}>Cancel</Button>
        <button type="button" onClick={() => void apply()} disabled={busy || selected === currentId} title={selected === currentId ? "No changes to save" : undefined} style={{ background: theme.accent, transition: "background 160ms ease" }} className="cursor-pointer rounded-lg px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Applying…" : "Apply Theme"}</button>
      </div>
    </div>
  );
}
