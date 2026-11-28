"use client";

import { Globe2, MapPin, type LucideIcon } from "lucide-react";
import { type HybridDates, setHybridDate } from "@/lib/hybrid-dates";

const SMALL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint";

/** Start and end of the in-person and of the virtual event (hybrid conferences). */
export function HybridDateFields({ idPrefix, value, onChange, inputClass, min, disabled, invalid }: {
  idPrefix: string; value: HybridDates; onChange: (next: HybridDates) => void; inputClass: string;
  /** Earliest day a start may take (e.g. today); undefined = any. */
  min?: string; disabled?: boolean; invalid?: boolean;
}) {
  const rows: Array<[string, LucideIcon, "physicalStart" | "virtualStart", "physicalEnd" | "virtualEnd"]> = [
    ["In-person event", MapPin, "physicalStart", "physicalEnd"],
    ["Virtual event", Globe2, "virtualStart", "virtualEnd"],
  ];
  const days = (a: string, b: string) => (a && b && b >= a ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1 : 0);
  return (
    <div className="space-y-3">
      {rows.map(([label, Icon, start, end]) => {
        const n = days(value[start], value[end]);
        return (
          <fieldset key={start} className="rounded-xl border border-line p-3">
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
          </fieldset>
        );
      })}
    </div>
  );
}
