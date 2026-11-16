"use client";

import { useState, type ReactNode } from "react";
import { Search, Sparkles, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { CountryFlag as Flag } from "@/components/ui/country-flag";
import { countryCodeOf } from "@/lib/country-codes";

/* The Analytics page's building blocks (the prototype's src/chair-analytics/components.jsx). */

export function CountryFlag({ country, size = 14 }: { country: string; size?: number }) {
  return <Flag code={countryCodeOf(country)} size={size} />;
}

export function AnalyticsCard({ title, subtitle, action, children, className = "" }: { title?: string; subtitle?: string | null; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className={`bg-white rounded-2xl p-5 ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            {title && <h2 style={{ color: "var(--navy)" }} className="text-sm font-bold">{title}</h2>}
            {subtitle && <p style={{ color: "var(--ink-faint)" }} className="text-xs mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={title || subtitle ? "mt-3" : ""}>{children}</div>
    </div>
  );
}

const STAT_TONES = {
  primary: { bg: "var(--primary-soft)", fg: "var(--primary)" },
  secondary: { bg: "var(--secondary-soft)", fg: "var(--secondary)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  accent: { bg: "rgba(6,182,212,0.12)", fg: "var(--accent)" },
};

// `progress` (0–1) draws a thin coloured fill under the sublabel divider: for a stat that is a share of some total.
export function AnalyticsStatCard({ icon: Icon, value, label, sublabel, tone = "primary", progress }: { icon?: LucideIcon; value: ReactNode; label: string; sublabel?: string | null; tone?: string; progress?: number }) {
  // A tone this card has no colours for (the decision cards pass "neutral") falls back to primary, as in the prototype.
  const t = (STAT_TONES as Record<string, { bg: string; fg: string }>)[tone] || STAT_TONES.primary;
  return (
    <div
      style={{
        borderTop: `3px solid ${t.fg}`,
        borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
      className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div style={{ color: "var(--navy)" }} className="text-[26px] font-extrabold leading-none tracking-tight truncate"><AnimatedNumber value={value} /></div>
          <div style={{ color: "var(--ink-muted)" }} className="text-xs font-semibold mt-2 leading-snug">{label}</div>
        </div>
        {Icon && (
          <div style={{ background: t.bg, color: t.fg }} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
            <Icon size={18} />
          </div>
        )}
      </div>
      {sublabel && (
        <div style={{ color: "var(--ink-faint)", borderTop: "1px solid var(--muted)" }} className="text-[11px] mt-3 pt-2.5 leading-snug">
          {sublabel}
        </div>
      )}
      {progress != null && (
        <div className="h-1 rounded-full overflow-hidden mt-3" style={{ background: "var(--muted)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, background: t.fg }} />
        </div>
      )}
    </div>
  );
}

export interface Column<T> { key: string; label: string; align?: "right"; render?: (row: T, i: number) => ReactNode }

export function AnalyticsTable<T extends object>({ columns, rows, rowKey = (_row, i) => i, initialCount = 10 }: { columns: Column<T>[]; rows: T[]; rowKey?: (row: T, i: number) => string | number; initialCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, initialCount);
  return (
    <div>
      <div className="overflow-x-auto -mx-1">
        <table className="ui-table w-full text-xs min-w-[480px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ color: "var(--ink-muted)" }}
                  className={`px-2 py-2 font-semibold whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={rowKey(row, i)} style={{ borderBottom: "1px solid var(--muted)" }} className="transition-colors">
                {columns.map((c) => (
                  <td key={c.key} style={{ color: "var(--ink)" }} className={`px-2 py-2.5 ${c.align === "right" ? "text-right" : "text-left"}`}>
                    {c.render ? c.render(row, i) : (row as Record<string, ReactNode>)[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > initialCount && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ color: "var(--primary)" }}
          className="text-xs font-semibold hover:underline mt-3 cursor-pointer"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

export function AnalyticsEmptyState({ icon: Icon = Sparkles, title, message }: { icon?: LucideIcon; title?: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <Icon size={22} style={{ color: "var(--ink-faint)" }} className="mb-3" />
      {title && <div style={{ color: "var(--navy)" }} className="text-sm font-bold mb-1">{title}</div>}
      {message && <p style={{ color: "var(--ink-faint)" }} className="text-xs max-w-sm">{message}</p>}
    </div>
  );
}

// Small bold heading with an icon: groups a run of cards under one label without the weight of a full card header.
export function SectionLabel({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon size={14} style={{ color: "var(--primary)" }} />}
      <h2 style={{ color: "var(--navy)" }} className="text-sm font-bold">{children}</h2>
    </div>
  );
}

// Compact tile for a KPI row sitting inside a card; `value` accepts a node, so a flag and text work too.
export function MiniTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-lg px-2 py-2.5 text-center">
      <div style={{ color: "var(--navy)" }} className="text-base font-extrabold truncate"><AnimatedNumber value={value} /></div>
      <div style={{ color: "var(--ink-faint)" }} className="text-[10px] font-semibold uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

export function StatChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]">
      <span style={{ color: "var(--ink-faint)" }} className="font-semibold uppercase tracking-wide">{label}</span>
      <span style={{ color: "var(--navy)" }} className="font-extrabold">{value}</span>
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={13} style={{ color: "var(--ink-faint)" }} className="absolute left-2.5 top-1/2 -translate-y-1/2" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
        className="pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none w-full sm:w-56 placeholder:text-slate-400 focus:border-[var(--primary)]"
      />
    </div>
  );
}

export function FilterChips<V extends string>({ options, value, onChange }: { options: Array<{ id: V; label: string }>; value: V; onChange: (v: V) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              background: active ? "var(--primary-soft)" : "transparent",
              color: active ? "var(--primary)" : "var(--ink-muted)",
              border: `1px solid ${active ? "var(--primary-soft-border)" : "var(--border)"}`,
            }}
            className="px-3 py-1 rounded-full text-[11px] font-semibold transition-colors hover:bg-[var(--canvas)] shrink-0 cursor-pointer"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type Scope = "all" | "domestic" | "international";

// A ranked list to browse: KPI chip row + optional All / Domestic / International filter + search + table with a Sr. No. column.
export function FilteredTable<T extends object>({ rows, query, setQuery, filter, matchDomestic, columns, chips, searchPlaceholder = "Search…" }: {
  rows: T[]; query: string; setQuery: (v: string) => void;
  filter?: { value: Scope; onChange: (v: Scope) => void }; matchDomestic?: (row: T) => boolean;
  columns: Column<T>[]; chips?: ReactNode; searchPlaceholder?: string;
}) {
  const filtered = rows
    .filter((r) => (!filter || filter.value === "all" || !matchDomestic ? true : filter.value === "domestic" ? matchDomestic(r) : !matchDomestic(r)))
    .filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {chips}
          {filter && (
            <FilterChips<Scope>
              options={[{ id: "all", label: "All" }, { id: "domestic", label: "Domestic" }, { id: "international", label: "International" }]}
              value={filter.value} onChange={filter.onChange}
            />
          )}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />
      </div>
      <AnalyticsTable<T>
        rowKey={(r, i) => { const o = r as Record<string, unknown>; return `${String(o.country ?? o.name ?? o.region ?? i)}-${i}`; }}
        columns={[{ key: "sr", label: "Sr. No.", align: "right", render: (_r, i) => i + 1 }, ...columns]}
        rows={filtered}
        initialCount={10}
      />
    </div>
  );
}
