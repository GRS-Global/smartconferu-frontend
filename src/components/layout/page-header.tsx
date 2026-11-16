import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  href?: string;
  /** A crumb that switches a view inside the page instead of going to another address. */
  onClick?: () => void;
  /** The last crumb of a Conference Settings page: semibold, navy (the prototype's current-page crumb there). */
  strong?: boolean;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}

/** Page title on the canvas (no white bar) with an optional breadcrumb and right-aligned actions. */
export function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 pb-0 pt-6 sm:px-8 sm:pt-8">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-[13px] font-medium text-ink-muted">
              {breadcrumbs.map((c, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <li key={c.label} className="flex items-center gap-1">
                    {c.onClick && !last ? (
                      <button type="button" onClick={c.onClick} className="cursor-pointer underline-offset-2 transition-colors hover:text-primary hover:underline">{c.label}</button>
                    ) : c.href && !last ? (
                      <Link href={c.href} className="underline-offset-2 transition-colors hover:text-primary hover:underline">{c.label}</Link>
                    ) : (
                      <span aria-current={last ? "page" : undefined} className={last && c.strong ? "font-semibold text-navy" : undefined}>{c.label}</span>
                    )}
                    {!last && <ChevronRight size={12} className="shrink-0" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <h1 className="text-balance text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-navy sm:text-[28px]">{title}</h1>
      </div>
      {actions}
    </div>
  );
}
