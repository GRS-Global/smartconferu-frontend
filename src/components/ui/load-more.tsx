import { useId } from "react";

/* The prototype's loading ring (shared/Loader.jsx): a brand-gradient arc over a soft track. The animation lives in globals.css (sl-spinner / sl-arc). */

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  const id = useId().replace(/:/g, "");
  const stroke = Math.max(3.5, 5 - size / 40);
  return (
    <svg viewBox="0 0 50 50" width={size} height={size} className="sl-spinner shrink-0" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`sl-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="25" cy="25" r="20" fill="none" stroke="var(--primary-soft-border)" strokeWidth={stroke} />
      <circle className="sl-arc" cx="25" cy="25" r="20" fill="none" stroke={`url(#sl-${id})`} strokeWidth={stroke} strokeLinecap="round" />
    </svg>
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
