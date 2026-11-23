"use client";
/* Super Admin building blocks, ported from the prototype (src/super-admin/ui.jsx, format.js):
   same class names (super-admin.css) and token colours, typed for this app. */
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, Loader2, Search, User, X, type LucideProps } from "lucide-react";
import { ApiError } from "../api";

export type Icon = ComponentType<LucideProps>;

// ---------- formatting ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? `${fmtDate(iso)}, ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "—";
export const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
export const waitingLabel = (iso: string) => {
  const d = daysSince(iso);
  return d === 0 ? "Today" : d === 1 ? "1 day" : `${d} days`;
};
export const initials = (name: string) =>
  name
    .replace(/^(Dr\.|Prof\.)\s*/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
export const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

/** Days a request may wait before it counts as late (the prototype's review promise). */
export const SLA_DAYS = 2;

export type Tone = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "neutral";
export const TONES: Record<Tone, { bg: string; fg: string; solid: string }> = {
  primary: { bg: "var(--primary-soft)", fg: "var(--primary)", solid: "var(--primary)" },
  secondary: { bg: "var(--secondary-soft)", fg: "var(--secondary)", solid: "var(--secondary)" },
  accent: { bg: "color-mix(in srgb, var(--accent) 10%, #FFFFFF)", fg: "var(--cat-virtual)", solid: "var(--accent)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)", solid: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)", solid: "var(--warning)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)", solid: "var(--danger)" },
  neutral: { bg: "var(--muted)", fg: "var(--text-muted)", solid: "var(--text-faint)" },
};

// ---------- primitives ----------

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`sa-card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardTitle({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h3 className="text-[17px] font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

export function Badge({ tone = "primary", solid = false, children, className = "" }: { tone?: Tone; solid?: boolean; children: ReactNode; className?: string }) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${className}`}
      style={solid ? { background: t.solid, color: "#FFFFFF" } : { background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

const AVATAR_TONES: Tone[] = ["primary", "accent", "secondary", "success", "warning"];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const t = TONES[AVATAR_TONES[name.length % AVATAR_TONES.length]];
  const text = initials(name || "");
  return (
    <span className="inline-flex items-center justify-center rounded-full font-bold shrink-0" style={{ width: size, height: size, background: t.bg, color: t.fg, fontSize: size * 0.36 }}>
      {/^[A-Z0-9]/.test(text) ? text : <User size={Math.round(size * 0.5)} />}
    </span>
  );
}

export function WaitingBadge({ since }: { since: string }) {
  const d = daysSince(since);
  return <Badge tone={d > SLA_DAYS ? "danger" : d === SLA_DAYS ? "warning" : "neutral"}>{waitingLabel(since)}</Badge>;
}

/** Breadcrumb, icon + title (+ description), page actions on the right. */
export function PageTitle({ title, crumb, icon: IconC, description, actions, parent }: { title: ReactNode; crumb?: string; icon?: Icon; description?: ReactNode; actions?: ReactNode; parent?: { label: string; href: string } }) {
  return (
    <div className="sa-page-head">
      <div className="min-w-0">
        <nav className="sa-crumb" aria-label="Breadcrumb">
          <Link href="/super-admin" className="hover:underline hover:text-[var(--primary)]">
            Dashboard
          </Link>
          {parent && (
            <>
              <ChevronRight size={13} style={{ color: "var(--text-faint)" }} />
              <Link href={parent.href} className="hover:underline hover:text-[var(--primary)]">
                {parent.label}
              </Link>
            </>
          )}
          <ChevronRight size={13} style={{ color: "var(--text-faint)" }} />
          <span className="truncate" style={{ color: "var(--text-soft)" }}>
            {crumb || title}
          </span>
        </nav>
        <div className="flex items-center gap-3">
          {IconC && (
            <span className="sa-page-icon" aria-hidden="true">
              <IconC size={21} strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[24px] font-bold leading-tight tracking-tight truncate" style={{ color: "var(--text)" }}>
              {title}
            </h2>
            {description && (
              <p className="text-[13.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export type Sort<K extends string> = { key: K; dir: "asc" | "desc" };
export function SortTh<K extends string>({ label, sortKey, sort, onSort, className = "" }: { label: string; sortKey: K; sort: Sort<K>; onSort: (k: K) => void; className?: string }) {
  const on = sort.key === sortKey;
  const IconC = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} title={`Sort by ${label.toLowerCase()}`} className="inline-flex items-center gap-1 font-semibold hover:text-[var(--primary)]" style={{ color: on ? "var(--primary)" : "var(--text)" }}>
        {label}
        <IconC size={13} strokeWidth={2.4} style={{ opacity: on ? 1 : 0.4 }} />
      </button>
    </th>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; variant?: "solid" | "soft" | "outline"; busy?: boolean };
export function Button({ tone = "primary", variant = "solid", busy = false, children, className = "", disabled, ...rest }: ButtonProps) {
  const t = TONES[tone];
  const style = variant === "solid" ? { background: t.solid, color: "#FFFFFF" } : variant === "soft" ? { background: t.bg, color: t.fg } : { background: "transparent", color: t.fg, border: `1px solid ${t.fg}` };
  return (
    <button className={`sa-btn inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13.5px] font-semibold disabled:opacity-50 ${className}`} style={style} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy && <Loader2 size={15} className="sa-spin" />}
      {children}
    </button>
  );
}

function useEscape(onClose: () => void, capture = false) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (capture) e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, capture);
    return () => window.removeEventListener("keydown", onKey, capture);
  }, [onClose, capture]);
}

/** Right-hand panel for details and edit forms. */
export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <DrawerBody onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
      {children}
    </DrawerBody>
  );
}
function DrawerBody({ onClose, title, subtitle, children, footer }: { onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" style={{ background: "rgba(11,16,32,0.35)" }} onClick={onClose} />
      <aside className="absolute top-0 right-0 bottom-0 w-full max-w-[560px] bg-white flex flex-col" style={{ boxShadow: "var(--shadow-pop)" }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-start justify-between gap-3 px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button onClick={onClose} className="sa-icon-btn shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

/** Centred popup (e.g. "Approve this conference?"). */
export function Modal({ title, subtitle, children, footer, onClose }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  useEscape(onClose, true);
  return createPortal(
    <div className="sa-root fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "transparent", minHeight: 0 }}>
      <div className="absolute inset-0" style={{ background: "rgba(11,16,32,0.45)" }} onClick={onClose} />
      <div className="relative w-full max-w-[520px] max-h-[calc(100vh-2rem)] bg-white rounded-2xl flex flex-col" style={{ boxShadow: "var(--shadow-pop)" }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-start justify-between gap-3 px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button onClick={onClose} className="sa-icon-btn shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** How long a decision can be undone before it is sent (the prototype's UNDO_MS). */
export const UNDO_MS = 10_000;

/* `undo`: the toast offers Undo while a decision is held back (and stays for UNDO_MS). */
export function Toast({ text, onDone, undo }: { text: string | null; onDone: () => void; undo?: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(onDone, undo ? UNDO_MS : 3200);
    return () => clearTimeout(t);
  }, [text, onDone, undo]);
  if (!text) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] sa-rise" role="status">
      <div className="flex items-center gap-2.5 rounded-xl pl-4 pr-2 py-2 min-h-[46px] text-[13.5px] font-medium text-white" style={{ background: "var(--navy)", boxShadow: "var(--shadow-pop)" }}>
        <CheckCircle2 size={18} className="shrink-0" style={{ color: "#4ADE80" }} />
        <span className="pr-2">{text}</span>
        {undo && (
          <button type="button" onClick={undo} className="shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold hover:bg-white/10 cursor-pointer" style={{ color: "#C4B5FD" }}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

export function Fields({ rows }: { rows: ([string, ReactNode] | false | null)[] }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-[13.5px]">
      {rows.filter((r): r is [string, ReactNode] => Boolean(r)).map(([k, v]) => (
        <div key={k} className="contents">
          <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
          <dd className="font-medium break-words" style={{ color: "var(--text)" }}>
            {v || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h4 className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-faint)" }}>
        {title}
      </h4>
      {children}
    </section>
  );
}

export function ExtLink({ href }: { href: string | null }) {
  if (!href) return <>—</>;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="hover:underline break-all" style={{ color: "var(--primary)" }}>
      {href.replace(/^https?:\/\//, "")}
    </a>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, required, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode; required?: boolean; type?: string }) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
        {label}
        {required && <span style={{ color: "var(--danger)" }}> *</span>}
      </span>
      <input className="sa-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint && (
        <span className="block text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/** Loading / failed / empty states, so a page never shows invented data. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
      <Loader2 size={18} className="sa-spin" /> {label}
    </div>
  );
}
export function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card className="text-center">
      <p className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
        Couldn&apos;t load this page
      </p>
      <p className="text-[13px] mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
        {errorText(error)}
      </p>
      <Button variant="soft" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-center py-12 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

/** Tabs with counts (Active / Deactivated / All …), a search box and optional buttons (the prototype's Toolbar). */
export function Toolbar<K extends string>({ tabs, tab, setTab, query, setQuery, placeholder, right }: { tabs: [K, string, number][]; tab: K; setTab: (k: K) => void; query: string; setQuery: (q: string) => void; placeholder: string; right?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 pt-5 pb-4">
      <div className="flex gap-1 flex-wrap" role="tablist">
        {tabs.map(([k, label, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`sa-tab ${tab === k ? "active" : ""} cursor-pointer`} onClick={() => setTab(k)}>
            {label} <span className="ml-1 opacity-70">{n}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="relative flex-1 md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="sa-input !pl-9" />
        </label>
        {right}
      </div>
    </div>
  );
}

/* Header sorting (the prototype's sort.js): click a column to sort by it, again to flip. Each column
   says how to read its value and which way it sorts first (numbers and dates usually newest/largest first). */
/* Paging: ten rows a page. The page goes back to 1 when what is listed changes (`resetKey`: tab, search, sort). */
export const PAGE_SIZE = 10;
export function usePaging<T>(rows: T[], resetKey: string) {
  const [state, setState] = useState({ page: 1, key: resetKey });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = state.key === resetKey ? Math.min(state.page, pages) : 1;
  const setPage = (p: number) => setState({ page: Math.min(Math.max(p, 1), pages), key: resetKey });
  return { page, pages, total: rows.length, rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), setPage };
}

/** "Showing 11–20 of 48" with Previous / page numbers / Next. Nothing when everything fits on one page. */
export function Pagination({ paging }: { paging: { page: number; pages: number; total: number; setPage: (p: number) => void } }) {
  const { page, pages, total, setPage } = paging;
  if (total <= PAGE_SIZE) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  // 1 … 4 5 6 … 12: the first, the last and the neighbours of the current page.
  const shown = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  const items: (number | "gap")[] = [];
  shown.forEach((p, i) => { if (i > 0 && p - shown[i - 1] > 1) items.push("gap"); items.push(p); });
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t px-6 py-4 sm:flex-row" style={{ borderColor: "var(--border)" }}>
      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} style={{ color: "var(--text)" }} disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        {items.map((p, i) =>
          p === "gap" ? (
            <span key={`gap${i}`} className="px-1 text-[13px]" style={{ color: "var(--text-faint)" }} aria-hidden="true">…</span>
          ) : (
            <button key={p} type="button" aria-current={p === page ? "page" : undefined} className={btn} style={p === page ? { background: "var(--primary)", color: "#FFFFFF" } : { color: "var(--text)" }} onClick={() => setPage(p)}>
              {p}
            </button>
          ),
        )}
        <button type="button" className={btn} style={{ color: "var(--text)" }} disabled={page === pages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

export type SortSpec<T> = Record<string, { get: (row: T) => string | number | null; first?: "asc" | "desc" }>;
export function useSort<T>(rows: T[], spec: SortSpec<T>, initial: Sort<string> | null = null) {
  const [sort, setSort] = useState<Sort<string> | null>(initial);
  const sorted = useMemo(() => {
    if (!sort || !spec[sort.key]) return rows;
    const { get } = spec[sort.key];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" })) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: spec[key]?.first ?? "asc" }));
  return { sorted, sort: sort ?? { key: "", dir: "asc" as const }, toggle };
}
