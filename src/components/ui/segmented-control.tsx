import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** The prototype's All / Active / Archived switch: a navy pill on white, with counts. */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              on ? "bg-navy text-white" : "text-ink-soft hover:bg-canvas hover:text-navy",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("rounded-full px-1.5 py-px text-[10.5px]", on ? "bg-white/20 text-white" : "bg-muted text-ink-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
