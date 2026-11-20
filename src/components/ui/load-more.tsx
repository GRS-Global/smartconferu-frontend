import { useId, type ReactNode } from "react";

/* The prototype's loaders (shared/Loader.jsx) — every "something is happening, please wait" moment uses one of these four, so it always looks and moves the same.
     <Spinner />        the ring on its own — inside a button or next to a line of text
     <Loader />         a section waiting on the server: larger ring + what's happening + a hint
     <LoadMore />       the row at the bottom of a list while the next page loads on scroll
     <LoadingOverlay /> full screen, for work the user must wait for (sending, paying, preparing files)
   The animations live in globals.css (sl-spinner / sl-arc / sl-halo / sl-bar / sl-fade / sl-pop). */

const TONES = {
  brand: { track: "var(--primary-soft-border)", from: "var(--primary)", to: "var(--accent)" },
  current: { track: "currentColor", from: "currentColor", to: "currentColor" }, // takes the text colour (inside buttons)
  white: { track: "rgba(255,255,255,0.3)", from: "#FFFFFF", to: "#FFFFFF" },
};

export function Spinner({ size = 18, label, tone = "brand", className = "" }: { size?: number; label?: string; tone?: keyof typeof TONES; className?: string }) {
  const id = useId().replace(/:/g, "");
  const stroke = Math.max(3.5, 5 - size / 40);
  const t = TONES[tone];
  return (
    <svg viewBox="0 0 50 50" width={size} height={size} className={`sl-spinner shrink-0 ${className}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`sl-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={t.from} />
          <stop offset="100%" stopColor={t.to} />
        </linearGradient>
      </defs>
      <circle cx="25" cy="25" r="20" fill="none" stroke={t.track} strokeOpacity={tone === "current" ? 0.25 : 1} strokeWidth={stroke} />
      <circle className="sl-arc" cx="25" cy="25" r="20" fill="none" stroke={`url(#sl-${id})`} strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

/** A section waiting on the server: the ring with a soft pulsing halo, what is happening, and an optional hint. */
export function Loader({ label = "Loading…", hint, size = "md", className = "" }: { label?: string; hint?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const ring = size === "lg" ? 56 : size === "sm" ? 32 : 44;
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 py-8 text-center ${className}`}>
      <span className="relative inline-flex items-center justify-center" style={{ width: ring + 16, height: ring + 16 }}>
        <span aria-hidden="true" className="sl-halo absolute inset-0 rounded-full" style={{ background: "var(--primary-soft)" }} />
        <Spinner size={ring} />
      </span>
      <div>
        <p className="text-sm font-bold text-navy">{label}</p>
        {hint && <p className="mt-1 max-w-xs text-xs text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}

/** Infinite-scroll footer: shown while the next page of a list is being fetched. */
export function LoadMore({ label = "Loading more…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center py-2">
      <span style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)", color: "var(--primary)" }} className="inline-flex items-center gap-2.5 rounded-full py-2 pl-2.5 pr-4 text-xs font-bold">
        <Spinner size={20} /> {label}
      </span>
    </div>
  );
}

/** Full-screen "please wait" for work that must finish first: the page behind is dimmed and can't be clicked, a card says what is happening,
 *  with an indeterminate progress bar. Render it through a portal when the page behind is `inert`. */
export function LoadingOverlay({ open = true, label = "Please wait…", hint = "This only takes a moment. Please don't close or refresh the page.", children = null }: { open?: boolean; label?: string; hint?: string; children?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sl-fade fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.38)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}>
      <div role="alertdialog" aria-modal="true" aria-busy="true" aria-label={label} style={{ boxShadow: "0 24px 60px -12px rgba(15,23,42,0.35)" }} className="sl-pop w-full max-w-[360px] rounded-2xl bg-white px-7 pb-6 pt-8 text-center">
        <span className="relative mb-4 inline-flex items-center justify-center" style={{ width: 80, height: 80 }}>
          <span aria-hidden="true" className="sl-halo absolute inset-0 rounded-full" style={{ background: "var(--primary-soft)" }} />
          <Spinner size={60} />
        </span>
        <p className="text-base font-extrabold text-navy">{label}</p>
        {hint && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{hint}</p>}
        <div aria-hidden="true" style={{ background: "var(--primary-soft)" }} className="relative mt-5 h-1.5 overflow-hidden rounded-full">
          <span className="sl-bar absolute inset-y-0 rounded-full" style={{ background: "linear-gradient(90deg, var(--primary), var(--accent))" }} />
        </div>
        {children}
      </div>
    </div>
  );
}
