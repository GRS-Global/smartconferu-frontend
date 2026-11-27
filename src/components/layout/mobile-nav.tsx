"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { isActive, NAV_GROUPS, resolveHref } from "@/lib/navigation";
import { SoonBadge } from "@/components/ui/soon-badge";

/** Below lg the four menus collapse behind this button. */
export function MobileNav() {
  const pathname = usePathname();
  // The panel is open for the page it was opened on, so navigating closes it without an effect.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the panel and returns focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpenPath(null); buttonRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenPath(open ? null : pathname)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-main-menu"
        className={cn("-ml-1.5 inline-flex h-10 w-10 items-center justify-center rounded-lg text-navy hover:bg-muted", open && "bg-muted")}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {open && (
        <nav id="mobile-main-menu" aria-label="Main" className="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-line bg-white px-4 pb-4 pt-2 shadow-pop">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="py-2">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{group.label}</p>
              {group.items.map((item) => {
                if (item.soon) {
                  return (
                    <div key={item.label} aria-disabled="true" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#A39AC0]">
                      <span className="flex-1">{item.label}</span>
                      <SoonBadge />
                    </div>
                  );
                }
                const { href, external } = resolveHref(item);
                const active = isActive(item, pathname);
                const className = cn("block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-canvas", active ? "bg-primary-soft text-primary" : "text-ink-soft");
                return external ? (
                  <a key={item.label} href={href} className={className}>{item.label}</a>
                ) : (
                  <Link key={item.label} href={href} aria-current={active ? "page" : undefined} className={className}>{item.label}</Link>
                );
              })}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
