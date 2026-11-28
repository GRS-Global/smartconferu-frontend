"use client";

import { Globe2, MapPin, Plus, Trash2, type LucideIcon } from "lucide-react";
import { MAX_RANGES, addMoreRange, eventDays, removeMoreRange, setHybridDate, setMoreRange, type HybridDates } from "@/lib/hybrid-dates";

const SMALL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint";

type Event = "physical" | "virtual";

/** Start and end of the in-person and of the virtual event (hybrid conferences). An event that skips a day (15, 16 and 18, say)
 *  takes one range per stretch: "Add another date range". */
export function HybridDateFields({ idPrefix, value, onChange, inputClass, min, disabled, invalid }: {
  idPrefix: string; value: HybridDates; onChange: (next: HybridDates) => void; inputClass: string;
  /** Earliest day a start may take (e.g. today); undefined = any. */
  min?: string; disabled?: boolean; invalid?: boolean;
}) {
  const rows: Array<[string, LucideIcon, Event]> = [
    ["In-person event", MapPin, "physical"],
    ["Virtual event", Globe2, "virtual"],
  ];
  return (
    <div className="space-y-3">
      {rows.map(([label, Icon, ev]) => {
        const start = `${ev}Start` as const, end = `${ev}End` as const;
        const more = value[`${ev}More`] ?? [];
        const n = eventDays(value, ev);
        return (
          <fieldset key={ev} className="rounded-xl border border-line p-3">
            <legend className="flex w-full items-center justify-between gap-2 px-1 text-xs font-bold text-navy">
              <span className="inline-flex items-center gap-1.5"><Icon size={13} aria-hidden="true" className="text-primary" /> {label}</span>
              {n > 0 && <span className="font-semibold text-primary">{n} day{n > 1 ? "s" : ""}</span>}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className={SMALL}>Starts</span>
                <input id={`${idPrefix}-${start}`} type="date" aria-label={`${label} start date`} disabled={disabled} value={value[start]} min={min} onChange={(e) => onChange(setHybridDate(value, start, e.target.value))} aria-invalid={invalid && !value[start]} className={inputClass} />
              </div>
              <div>
                <span className={SMALL}>Ends</span>
                <input id={`${idPrefix}-${end}`} type="date" aria-label={`${label} end date`} disabled={disabled} value={value[end]} min={value[start] || min} onChange={(e) => onChange(setHybridDate(value, end, e.target.value))} aria-invalid={invalid && (!value[end] || value[end] < value[start])} className={inputClass} />
              </div>
            </div>
            {more.map((r, i) => (
              <div key={i} className="mt-3 border-t border-muted pt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Another range</span>
                  {!disabled && <button type="button" onClick={() => onChange(removeMoreRange(value, ev, i))} aria-label={`Remove ${label} range ${i + 2}`} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-danger-ink"><Trash2 size={13} aria-hidden="true" /> Remove</button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className={SMALL}>Starts</span>
                    <input id={`${idPrefix}-${ev}-more-${i}-start`} type="date" aria-label={`${label} range ${i + 2} start date`} disabled={disabled} value={r.start} min={value[end] || min} onChange={(e) => onChange(setMoreRange(value, ev, i, "start", e.target.value))} aria-invalid={invalid && !r.start} className={inputClass} />
                  </div>
                  <div>
                    <span className={SMALL}>Ends</span>
                    <input id={`${idPrefix}-${ev}-more-${i}-end`} type="date" aria-label={`${label} range ${i + 2} end date`} disabled={disabled} value={r.end} min={r.start || min} onChange={(e) => onChange(setMoreRange(value, ev, i, "end", e.target.value))} aria-invalid={invalid && (!r.end || r.end < r.start)} className={inputClass} />
                  </div>
                </div>
              </div>
            ))}
            {!disabled && more.length + 1 < MAX_RANGES && (
              <button type="button" onClick={() => onChange(addMoreRange(value, ev))} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline">
                <Plus size={14} aria-hidden="true" /> Add another date range
                <span className="font-normal text-ink-muted">(if the event skips a day)</span>
              </button>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
