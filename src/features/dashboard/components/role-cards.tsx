import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/cn";
import { ROLE_META, type RoleFilter } from "../roles";

/** Compact role switcher shown once a role is picked, and in Option B. */
export function RoleTile({ role, count, active, onSelect }: { role: RoleFilter; count: number; active: boolean; onSelect: () => void }) {
  const m = ROLE_META[role];
  const Icon = m.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        background: active ? m.soft : "#fff",
        border: active ? `2px solid ${m.accent}` : "1px solid var(--border)",
        padding: active ? "13px 15px" : "14px 16px",
      }}
      className="relative flex items-center gap-3 rounded-2xl text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span style={{ background: m.accent }} className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[0.7rem] text-white">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span style={{ color: m.accent }} className="text-2xl font-extrabold leading-none tracking-[-0.03em]"><AnimatedNumber value={count} /></span>
        <span style={active ? { color: m.accent } : undefined} className={cn("text-[13px] font-semibold", !active && "text-ink-muted")}>{m.label}</span>
      </span>
      {role === "committee" && <span className="ml-auto rounded-full bg-cat-virtual-soft px-2 py-0.5 text-[11px] font-bold text-cat-virtual">New</span>}
    </button>
  );
}

export interface RoleStat {
  label: string;
  value: number;
  color?: string;
  /** Glows amber while above zero. */
  attention?: boolean;
  on?: boolean;
  onClick?: () => void;
}

interface RoleStatCardProps {
  role: RoleFilter;
  count: number;
  stats: RoleStat[];
  active: boolean;
  onSelectRole: () => void;
}

/** One card per role: header with its conference count, then the figures that role works with.
 *  Lines with an onClick filter the list. */
export function RoleStatCard({ role, count, stats, active, onSelectRole }: RoleStatCardProps) {
  const m = ROLE_META[role];
  const Icon = m.icon;
  const tint = role === "all" ? "var(--muted)" : m.soft;
  const edge = active ? `2px solid ${m.accent}` : "1px solid var(--border)";
  return (
    <div
      style={{ borderTop: `${active ? 4 : 3}px solid ${m.accent}`, borderLeft: edge, borderRight: edge, borderBottom: edge, boxShadow: active ? "0 8px 24px rgba(15,23,42,0.08)" : "var(--shadow-card)" }}
      className="flex flex-col overflow-hidden rounded-2xl bg-white transition-shadow"
    >
      <button
        type="button"
        onClick={onSelectRole}
        aria-pressed={active}
        // Padding as in the prototype: 1px less on each side on the picked card, whose border is 1px thicker.
        style={{ background: `linear-gradient(180deg, ${tint} 0%, #fff ${active ? "100%" : "85%"})`, padding: active ? "13px 15px" : "14px 16px" }}
        className="group flex items-start gap-3 text-left transition-[filter] hover:brightness-[0.985]"
      >
        <span style={{ background: m.accent, boxShadow: "0 6px 14px rgba(15,23,42,0.14)" }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-transform group-hover:scale-105">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span style={{ color: m.accent, border: `1px solid ${m.accent}` }} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 text-[12.5px] font-extrabold leading-none shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <span style={{ background: m.accent }} className="h-1.5 w-1.5 shrink-0 rounded-full" />
            <span className="truncate">{m.label}</span>
          </span>
          <span className="mt-1.5 flex items-baseline gap-1.5">
            {/* The rolling digits are 1.15em tall, taller than this line (28px); the negative margin keeps the line at 28px as in the prototype. */}
            <span className="text-[28px] font-extrabold leading-none tracking-[-0.03em] text-navy [&>.odo]:-my-[0.075em]"><AnimatedNumber value={count} /></span>
            <span className="text-xs font-semibold text-ink-muted">conference{count === 1 ? "" : "s"}</span>
          </span>
        </span>
        {active ? (
          <span style={{ color: m.accent, border: `1px solid ${m.accent}` }} className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold">Showing</span>
        ) : role === "committee" ? (
          <span className="shrink-0 rounded-full bg-cat-virtual-soft px-2 py-0.5 text-[10.5px] font-bold text-cat-virtual">New</span>
        ) : null}
      </button>
      {stats.length > 0 && (
        <ul className="flex flex-1 flex-col border-t border-muted py-1.5">
          {stats.map((st) => {
            const warn = st.attention && st.value > 0;
            const body = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <span style={{ background: st.color || "var(--border-strong)" }} className="h-1.5 w-1.5 shrink-0 rounded-full" />
                  <span className={cn("text-[12.5px] leading-snug", warn ? "font-bold text-[#92400E]" : "font-semibold text-ink-soft")}>{st.label}</span>
                </span>
                <b style={{ color: st.value === 0 ? "var(--border-strong)" : st.color || "var(--navy)" }} className="shrink-0 text-[15px] tabular-nums">{st.value}</b>
              </>
            );
            const rowStyle = { background: st.on ? "var(--primary-soft)" : warn ? "var(--warning-soft)" : "transparent", boxShadow: st.on ? "inset 3px 0 0 var(--primary)" : "none" };
            return (
              <li key={st.label}>
                {st.onClick ? (
                  <button type="button" onClick={st.onClick} aria-pressed={Boolean(st.on)} style={rowStyle} className="flex w-full items-center justify-between gap-3 px-4 py-[7px] text-left transition-colors hover:bg-canvas">{body}</button>
                ) : (
                  <div style={rowStyle} className="flex items-center justify-between gap-3 px-4 py-[7px]">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export interface GlanceItem {
  label: string;
  value: number;
  color?: string;
  tone?: "warning";
  /** The accepted sub-columns of the author strip. */
  sub?: boolean;
  on?: boolean;
  apply?: () => void;
}

/** The picked role's own numbers; each is a toggle that filters the list to the conferences behind it. */
export function GlanceStrip({ role, items, yearFilter }: { role: Exclude<RoleFilter, "all">; items: GlanceItem[]; yearFilter: React.ReactNode }) {
  const m = ROLE_META[role];
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white lg:flex-row">
      <div style={{ background: m.accent }} className="flex shrink-0 flex-row items-center justify-between gap-2 rounded-t-2xl px-5 py-3.5 text-white lg:w-[200px] lg:flex-col lg:items-start lg:justify-center lg:rounded-l-2xl lg:rounded-tr-none">
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold">{m.label}</span>
          <span className="mt-0.5 block text-xs font-semibold opacity-85">at a glance</span>
        </span>
        {yearFilter}
      </div>
      <div className="ui-strip flex min-w-0 flex-1 overflow-hidden rounded-b-2xl lg:rounded-bl-none">
        {items.map((it, i) => {
          const Tag = it.apply ? "button" : "div";
          return (
            <Tag
              key={it.label}
              {...(it.apply ? { type: "button" as const, onClick: it.apply, "aria-pressed": it.on, title: it.on ? "Click again to show all" : `Show only conferences with ${it.label.toLowerCase()}` } : {})}
              style={{
                borderLeft: i ? "1px solid var(--muted)" : "none",
                background: it.on ? "var(--primary-soft)" : it.tone === "warning" && it.value ? "var(--warning-soft)" : it.sub ? "rgba(238,242,255,0.45)" : "#fff",
                boxShadow: it.on ? "inset 0 -3px 0 var(--primary)" : "none",
              }}
              className={cn("flex min-w-0 flex-1 basis-0 flex-col items-start justify-center gap-0.5 px-3.5 py-3 text-left transition-colors", it.apply && "hover:brightness-[0.97]", i === items.length - 1 && "lg:rounded-r-2xl")}
            >
              {it.sub && <span className="text-[10px] font-bold uppercase leading-none tracking-wide text-ink-faint">Accepted</span>}
              <b style={{ color: it.color || "var(--navy)" }} className="text-xl leading-tight"><AnimatedNumber value={it.value} /></b>
              <span className={cn("text-xs font-semibold leading-tight", it.on ? "text-primary" : "text-ink-muted")}>{it.label}</span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
