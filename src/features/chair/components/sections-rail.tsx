"use client";

import { ArrowRight, ChevronDown, ChevronRight, Check, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { STICKY_SIDE_XL } from "@/components/layout/sticky-side";

/* The right-hand "Sections" rail the prototype's settings pages share (ConfSettingsRail): a card that says where you are on the page —
   each section with a one-line summary (and, for long ones, its items) that jumps to it — and, under it, links to the related pages. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;

export interface RailSection { id: string; label: string; meta?: ReactNode; /** A count badge on the right (Email Templates). */ count?: number; /** A coloured pill on the right instead of the arrow ("Closed", "On"). */ tone?: { label: string; bg: string; color: string }; children?: Array<{ id: string; label: string; /** Shown with an "Off" pill (the email is switched off). */ off?: boolean }> }
export interface RailLink { label: string; desc: string; href?: string; onClick?: () => void; /** A word on the right instead of nothing: "Incomplete", or "Done" with a tick (the prototype's status). */ status?: { label: string; done?: boolean } }

/** Scrolls so the section sits just under the header, and pulses it (the prototype's jump). */
const jump = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: "smooth" });
  el.animate?.([{ boxShadow: "0 0 0 4px rgba(124, 58, 237, 0.22)" }, { boxShadow: "0 0 0 4px rgba(124, 58, 237, 0)" }], { duration: 1400, delay: 350, easing: "ease-out" });
};

export function SectionsRail({ title = "Sections", sub = "Jump to a part of this page", sections, links = [] }: { title?: string; sub?: string; sections: RailSection[]; links?: RailLink[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const ids = sections.map((x) => x.id).join("|");
  // The active section is the last one whose top has passed the header; at the very bottom of the page it is the last one.
  useEffect(() => {
    const list = ids.split("|").filter(Boolean);
    const onScroll = () => {
      let cur = list[0];
      list.forEach((id) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= 140) cur = id; });
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = list[list.length - 1];
      setActive(cur);
    };
    // Capture: the page may scroll inside a container, whose scroll events do not bubble.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    onScroll();
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [ids]);
  return (
    <aside className={`space-y-4 ${STICKY_SIDE_XL}`} aria-label="Sections">
      <nav style={CARD} className="overflow-hidden rounded-2xl bg-white">
        <div className="border-b border-muted px-4 py-3.5"><div className="text-xs font-bold text-navy">{title}</div><div className="mt-0.5 text-[11px] text-ink-muted">{sub}</div></div>
        <ul className="space-y-0.5 p-2">
          {sections.map((s) => {
            const on = active === s.id;
            const expandable = Boolean(s.children?.length);
            const isOpen = open.has(s.id);
            const toggle = () => setOpen((cur) => { const next = new Set(cur); if (next.has(s.id)) next.delete(s.id); else next.add(s.id); return next; });
            return (
              <li key={s.id} className={expandable ? "relative" : undefined}>
                {/* The expand arrow sits over the row's right edge, outside the jump button (no nested buttons). */}
                {expandable && <button type="button" onClick={toggle} aria-expanded={isOpen} aria-controls={`${s.id}-rail-items`} aria-label={`${isOpen ? "Hide" : "Show"} ${s.label} list`} title={isOpen ? "Hide list" : `Show all ${s.children!.length}`} className={`absolute right-1.5 top-1.5 z-[1] flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary ${on || isOpen ? "text-primary" : "text-ink-muted"}`}><ChevronDown size={15} aria-hidden="true" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} className="transition-transform duration-200" /></button>}
                <button type="button" aria-expanded={expandable ? isOpen : undefined} aria-current={on ? "location" : undefined} onClick={() => { setActive(s.id); jump(s.id); if (expandable) toggle(); }} style={{ boxShadow: on ? "inset 2px 0 0 var(--primary)" : "none" }} className={`flex w-full cursor-pointer items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${on ? "bg-primary-soft" : "bg-transparent hover:bg-canvas"}`}>
                  <span className="min-w-0"><span className={`block text-[12.5px] font-semibold leading-snug ${on ? "text-primary" : "text-navy"}`}>{s.label}</span>{s.meta && <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{s.meta}</span>}</span>
                  {s.count !== undefined && <span className="mt-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-ink-muted">{s.count}</span>}
                  {expandable ? <span className="w-7 shrink-0" aria-hidden="true" /> : s.tone ? <span style={{ background: s.tone.bg, color: s.tone.color }} className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">{s.tone.label}</span> : <ChevronRight size={14} aria-hidden="true" className={`mt-0.5 shrink-0 ${on ? "text-primary" : "text-line-strong"}`} />}
                </button>
                {expandable && isOpen && (
                  <ul id={`${s.id}-rail-items`} style={{ borderLeft: "1px solid var(--border)" }} className="mb-1.5 ml-4 mt-1 space-y-0.5 pl-2">
                    {s.children!.map((c) => <li key={c.id}><button type="button" onClick={() => { setActive(s.id); const el = document.getElementById(c.id); if (!el) return; el.scrollIntoView({ behavior: "smooth", block: "center" }); el.animate?.([{ boxShadow: "0 0 0 3px rgba(124, 58, 237, 0.35)" }, { boxShadow: "0 0 0 3px rgba(124, 58, 237, 0)" }], { duration: 1600, delay: 350, easing: "ease-out" }); }} title={`Go to “${c.label}”`} className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-canvas"><Mail size={12} aria-hidden="true" className={`shrink-0 ${c.off ? "text-line-strong" : "text-ink-faint"}`} /><span className={`min-w-0 flex-1 truncate text-[11.5px] font-medium leading-snug group-hover:text-primary ${c.off ? "text-ink-faint" : "text-ink-soft"}`}>{c.label}</span>{c.off && <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[9.5px] font-bold text-ink-muted">Off</span>}<ArrowRight size={11} aria-hidden="true" className="shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" /></button></li>)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {links.length > 0 && (
        <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
          {links.map((l, i) => (
            l.onClick || !l.href
              ? <button key={l.label} type="button" onClick={l.onClick} className={`flex w-full items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-canvas ${i ? "border-t border-muted" : ""}`}>
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink">{l.label}</span><span className="mt-0.5 block text-[11px] text-ink-faint">{l.desc}</span></span>
                {l.status && <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${l.status.done ? "text-success-ink" : "text-ink-faint"}`}>{l.status.done && <Check size={12} strokeWidth={3} aria-hidden="true" />}{l.status.label}</span>}
                <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-line-strong" />
              </button>
              : <Link key={l.label} href={l.href} className={`flex items-center gap-2 px-4 py-3.5 transition-colors hover:bg-canvas ${i ? "border-t border-muted" : ""}`}>
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink">{l.label}</span><span className="mt-0.5 block text-[11px] text-ink-faint">{l.desc}</span></span>
                {l.status && <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${l.status.done ? "text-success-ink" : "text-ink-faint"}`}>{l.status.done && <Check size={12} strokeWidth={3} aria-hidden="true" />}{l.status.label}</span>}
                <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-line-strong" />
              </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
