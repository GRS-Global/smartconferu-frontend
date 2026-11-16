"use client";

import { ChevronDown, Funnel } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/cn";

interface FilterPopoverProps {
  /** Column name, used for the accessible name. */
  label: string;
  active: boolean;
  /** Opens against the right edge of the button (last columns). */
  alignRight?: boolean;
  /** Text button instead of the funnel icon: the at-a-glance year picker, which sits on the role's dark banner (white text). */
  buttonLabel?: string;
  children: ReactNode;
}

// Width of the panel (`w-64`), for keeping the fixed panel inside the viewport.
const PANEL_WIDTH = 256;

// Room the tallest panel (a checkbox list, max-h-60 plus padding) wants; with less below the button it opens upward.
const PANEL_ROOM = 300;

/** Where the fixed panel goes: under the button — or above it when there isn't room below — kept inside the viewport
 *  (right-aligned columns end at the button's right edge). */
const panelPosition = (r: DOMRect, alignRight?: boolean): CSSProperties => {
  const want = alignRight ? r.right - PANEL_WIDTH : r.left;
  const left = Math.max(8, Math.min(want, window.innerWidth - PANEL_WIDTH - 8));
  const below = window.innerHeight - r.bottom - 14;
  const above = r.top - 14;
  const up = below < PANEL_ROOM && above > below;
  return up
    ? { position: "fixed", left, bottom: window.innerHeight - r.top + 6, maxHeight: above, overflowY: "auto" }
    : { position: "fixed", left, top: r.bottom + 6, maxHeight: below, overflowY: "auto" };
};

/** Whether the button can still be seen: inside the window and inside every scrolling box it sits in. */
function isTriggerVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) return false;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(p);
    if (!/(auto|scroll)/.test(overflowX + overflowY)) continue;
    const b = p.getBoundingClientRect();
    if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) return false;
  }
  return true;
}

/** A funnel button opening a small panel. The panel is `fixed` (placed from the button's position), so a
 *  horizontally scrolling table can't clip it. It follows the button while the page or the table scrolls, and
 *  closes once the button has scrolled out of sight. */
export function FilterPopover({ label, active, alignRight, buttonLabel, children }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [fixed, setFixed] = useState<CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    // Keep the fixed panel under its button as the page or a scrolling box moves it (scrolling inside the panel itself is ignored).
    const follow = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      const btn = buttonRef.current;
      if (!btn || !isTriggerVisible(btn)) return close();
      setFixed(panelPosition(btn.getBoundingClientRect(), alignRight));
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => { window.removeEventListener("scroll", follow, true); window.removeEventListener("resize", follow); };
  }, [open, close, alignRight]);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (open) return close();
    setFixed(panelPosition(e.currentTarget.getBoundingClientRect(), alignRight));
    setOpen(true);
  };

  return (
    <div
      ref={ref}
      className="relative inline-block"
      // Escape closes the panel (useDismiss); put focus back on the funnel so keyboard users don't lose their place.
      onKeyDown={(e) => { if (e.key === "Escape" && open) buttonRef.current?.focus(); }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Filter by ${label}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={cn(
          buttonLabel
            // The year picker on the dark banner: funnel, label, then a ▾ — translucent white with a white hairline.
            ? "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/35 bg-white/[0.18] px-2.5 text-[11.5px] font-bold text-white transition-colors hover:bg-white/30"
            // A column's funnel: filled purple with a white filled funnel while its filter is on; tinted while its panel is open.
            : cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors",
              active ? "bg-primary text-white" : open ? "bg-primary-soft text-primary" : "text-ink-faint hover:bg-primary-soft hover:text-primary",
            ),
        )}
      >
        <Funnel size={buttonLabel ? 11 : 12} strokeWidth={2.4} fill={active ? "currentColor" : "none"} aria-hidden="true" />
        {buttonLabel}
        {buttonLabel && <ChevronDown size={12} strokeWidth={2.6} aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={`${label} filter`}
          style={fixed ?? undefined}
          className="z-30 w-64 rounded-xl border border-line bg-white p-3.5 text-left text-ink shadow-pop"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function PopoverTitle({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-extrabold text-navy">{children}</p>;
}

export function ClearLink({ onClick, label = "Reset" }: { onClick: () => void; label?: string }) {
  return (
    <div className="mt-2.5 flex justify-end border-t border-muted pt-2">
      <button type="button" onClick={onClick} className="text-xs font-bold text-ink-muted hover:text-primary">{label}</button>
    </div>
  );
}

interface Option<T> {
  value: T;
  label: string;
  count?: number;
}

export function CheckList<T extends string | number>({ options, selected, onChange }: { options: Option<T>[]; selected: T[]; onChange: (next: T[]) => void }) {
  const toggle = (v: T) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="-mx-1 max-h-60 overflow-y-auto">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <label key={String(o.value)} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-ink", on ? "bg-primary-soft" : "hover:bg-canvas")}>
            <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="h-4 w-4 accent-[var(--primary)]" />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.count !== undefined && <span className="text-xs font-medium text-ink-faint">{o.count}</span>}
          </label>
        );
      })}
    </div>
  );
}

export function RadioList<T extends string>({ name, options, value, onChange }: { name: string; options: Option<T>[]; value: T; onChange: (next: T) => void }) {
  return (
    <div className="-mx-1">
      {options.map((o) => (
        <label key={o.value} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-ink", value === o.value ? "bg-primary-soft" : "hover:bg-canvas")}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} className="h-4 w-4 accent-[var(--primary)]" />
          <span className="min-w-0 flex-1">{o.label}</span>
          {o.count !== undefined && <span className="text-xs font-medium text-ink-faint">{o.count}</span>}
        </label>
      ))}
    </div>
  );
}

export function TextFilter({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <input
      autoFocus
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
    />
  );
}
