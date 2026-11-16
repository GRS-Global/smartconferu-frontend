"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/cn";
import { isActive, resolveHref, type NavGroup } from "@/lib/navigation";

export function NavDropdown({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const hasActive = group.items.some((i) => isActive(i, pathname));

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const links = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") { e.preventDefault(); links[(i + 1) % links.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); links[(i - 1 + links.length) % links.length]?.focus(); }
    if (e.key === "Escape") { close(); buttonRef.current?.focus(); }
  };

  return (
    // Prototype NavDropdown: the menu opens on hover (and closes on leave); click / keyboard still work here for touch and a11y.
    <div ref={ref} className="relative" onKeyDown={onMenuKeyDown} onMouseEnter={() => setOpen(true)} onMouseLeave={close}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(true)}
        // Measured against the prototype: py-2 + text-sm (36 px tall), navy at .72 opacity, full opacity when active / open / hovered.
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all hover:opacity-100",
          hasActive ? "bg-primary-soft text-primary opacity-100" : open ? "bg-muted text-navy opacity-100" : "text-navy opacity-[.72]",
        )}
      >
        {group.label}
        <ChevronDown size={13} aria-hidden="true" className={cn("shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        // pt-2 bridges the gap under the button so moving the mouse down does not close the menu (as in the prototype).
        <div className="absolute left-0 top-full z-30 pt-2">
          <div id={menuId} role="menu" aria-label={group.label} className="w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop">
            {group.items.map((item) => {
              const { href, external } = resolveHref(item);
              const active = isActive(item, pathname);
              const className = cn(
                "flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-primary-soft hover:text-primary",
                active ? "bg-primary-soft text-primary" : "text-ink",
              );
              return external ? (
                <a key={item.label} role="menuitem" href={href} className={className} onClick={close}>{item.label}</a>
              ) : (
                <Link key={item.label} role="menuitem" href={href} aria-current={active ? "page" : undefined} className={className} onClick={close}>{item.label}</Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
