"use client";

import { ChevronDown, Pencil, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

/* The CFP manager's bar of actions (the prototype's CFPNavBar): Publish, Managers, View, and the "Edit ▾" menu (Edit content, Edit details,
   Change theme, Change logo, Close this CFP). The menu opens on hover or on click. An item that is not ported yet carries an `href` and opens the
   prototype's page. */

export interface CfpNavItem { label: string; icon: LucideIcon; onClick?: () => void; href?: string; active?: boolean; accent?: boolean }
export interface CfpEditItem { label: string; icon: LucideIcon; onClick?: () => void; href?: string; active?: boolean; danger?: boolean; divider?: boolean; disabled?: boolean; disabledReason?: string }

const ITEM = "flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-canvas";

export function CfpNavBar({ navItems, editMenuItems, editMenuActive }: { navItems: CfpNavItem[]; editMenuItems: CfpEditItem[] | null; editMenuActive: boolean }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const later = () => { timer.current = setTimeout(() => setOpen(false), 150); };
  return (
    <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="mb-6 flex flex-wrap items-center gap-1 rounded-2xl bg-white p-1.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const body = <><Icon size={14} aria-hidden="true" /> {item.label}</>;
        const color = item.active ? "var(--primary)" : item.accent ? "var(--success)" : "var(--ink-soft)";
        const bg = item.active ? "var(--primary-soft)" : "transparent";
        return item.href
          ? <a key={item.label} href={item.href} style={{ color, background: bg }} className={ITEM}>{body}</a>
          : <button key={item.label} type="button" onClick={item.onClick} aria-pressed={item.active} style={{ color, background: bg }} className={ITEM}>{body}</button>;
      })}
      {editMenuItems && (
        <div className="relative" onMouseEnter={show} onMouseLeave={later}>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} style={{ color: editMenuActive ? "var(--primary)" : "var(--ink-soft)", background: editMenuActive ? "var(--primary-soft)" : "transparent" }} className={ITEM}>
            <Pencil size={14} aria-hidden="true" /> Edit
            <ChevronDown size={12} aria-hidden="true" style={{ transition: "transform 160ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>
          <div role="menu" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", opacity: open ? 1 : 0, transform: open ? "translateY(0)" : "translateY(-6px)", pointerEvents: open ? "auto" : "none", transition: "opacity 160ms ease, transform 160ms ease" }} className="absolute left-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl bg-white py-1.5">
            {editMenuItems.map((item) => {
              const Icon = item.icon;
              const color = item.danger ? "var(--danger)" : item.active ? "var(--primary)" : "var(--ink)";
              const row = "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold";
              const icon = <Icon size={14} aria-hidden="true" style={{ color: item.danger ? "var(--danger)" : "var(--primary)" }} />;
              return (
                <Fragment key={item.label}>
                  {item.divider && <div style={{ borderTop: "1px solid var(--muted)" }} className="my-1.5" />}
                  {item.disabled
                    ? <span role="menuitem" aria-disabled="true" title={item.disabledReason || "Coming soon"} style={{ color: "var(--line-strong)" }} className={`${row} cursor-not-allowed`}><Icon size={14} aria-hidden="true" /> {item.label}</span>
                    : item.href
                      ? <a role="menuitem" href={item.href} style={{ color }} className={`${row} hover:bg-canvas`}>{icon} {item.label}</a>
                      : <button role="menuitem" type="button" onClick={() => { setOpen(false); item.onClick?.(); }} style={{ color, background: item.active ? "var(--primary-soft)" : "transparent" }} className={`${row} cursor-pointer transition-colors hover:bg-canvas`}>{icon} {item.label}</button>}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
