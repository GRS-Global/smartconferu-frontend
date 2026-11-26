import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { CountryFlag } from "@/components/ui/country-flag";
import { cn } from "@/lib/cn";
import { formatDateRange } from "@/lib/dates";
import { countryCodeOf } from "@/lib/country-codes";
import type { DashboardRow } from "../derive";

export interface Sort {
  key: string;
  dir: "asc" | "desc";
}

export const TH = "whitespace-nowrap px-4 py-3 text-left text-[12.5px] font-bold";
export const HEAD_BORDER = "border-b border-line";

export function HeaderCell({ label, filter, className }: { label: ReactNode; filter?: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1", className)}>{label}{filter}</span>;
}

/** Number columns sort instead of filter: first click high → low, second low → high, third off. */
export function SortHeader({ label, sortKey, sort, onSort, labels = ["Highest first", "Lowest first"] }: {
  label: string; sortKey: string; sort: Sort | null; onSort: (next: Sort | null) => void; labels?: [string, string];
}) {
  const on = sort?.key === sortKey;
  const Icon = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  const next: Sort | null = !on ? { key: sortKey, dir: "desc" } : sort.dir === "desc" ? { key: sortKey, dir: "asc" } : null;
  const [high, low] = labels;
  return (
    <button
      type="button"
      onClick={() => onSort(next)}
      aria-label={`Sort by ${label}`}
      title={!on ? `Sort by ${label}` : sort.dir === "desc" ? `${high} · click for ${low.toLowerCase()}` : `${low} · click to clear`}
      className={cn("inline-flex items-center gap-1 hover:text-navy", on && "text-primary")}
    >
      {label}
      <Icon size={12} strokeWidth={2.6} aria-hidden="true" className={cn("shrink-0", on ? "opacity-100" : "opacity-45")} />
    </button>
  );
}

/** A figure: a dash for zero, the number otherwise. */
export function NumberCell({ value, color, className, style }: { value: number; color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <td style={style} className={cn("px-2 py-3.5 text-center align-top", className)}>
      {value === 0
        ? <span className="text-[15px] font-bold text-line-strong" aria-label="0">–</span>
        : <span style={{ color }} className="text-[17px] font-extrabold">{value}</span>}
    </td>
  );
}

export function ConferenceCell({ row, note }: { row: DashboardRow; note?: ReactNode }) {
  const past = row.conf.status !== "active";
  return (
    <td className="px-4 py-3.5 align-top">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("font-extrabold", past ? "text-ink-soft" : "text-navy")}>{row.conf.acronym}</span>
        {row.hint.tone === "live" && <span className="rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-bold text-white">Live now</span>}
      </div>
      <div className="max-w-[200px] text-[12.5px] leading-snug text-ink-muted sm:max-w-[340px]">{row.conf.name}</div>
      {note}
    </td>
  );
}

/** Options A–C list the country only; Option D adds the city. */
export function LocationCell({ row, countryOnly }: { row: DashboardRow; countryOnly?: boolean }) {
  const c = row.conf;
  return (
    <td className={cn("px-4 py-3.5 align-top text-ink-soft", !countryOnly && "max-w-[170px]")}>
      <span className={cn("gap-1.5", countryOnly ? "inline-flex items-center whitespace-nowrap" : "flex items-start")}>
        <span className={cn("shrink-0", !countryOnly && "mt-0.5")}><CountryFlag code={countryCodeOf(c.country)} /></span>
        <span className="min-w-0">{!countryOnly && c.city ? `${c.city}, ${c.country}` : c.country}</span>
      </span>
    </td>
  );
}

export const TONE_COLOR: Record<string, string> = { live: "var(--danger)", soon: "var(--warning)", later: "var(--ink-muted)", past: "var(--ink-faint)" };

export function DatesCell({ row, withStatusPill }: { row: DashboardRow; withStatusPill?: boolean }) {
  const active = row.conf.status === "active";
  return (
    <td className={cn("whitespace-nowrap px-4 py-3.5 align-top font-semibold", active ? "text-ink" : "text-ink-muted")}>
      {formatDateRange(row.conf.startDate, row.conf.endDate)}
      {withStatusPill ? (
        <div className="mt-1">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", active ? "bg-success-soft text-[#15803D]" : "bg-muted text-ink-soft")}>{active ? "Active" : "Archived"}</span>
        </div>
      ) : (
        <div style={{ color: TONE_COLOR[row.hint.tone] }} className="text-xs font-semibold">{row.hint.text}</div>
      )}
    </td>
  );
}
