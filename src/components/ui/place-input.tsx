"use client";

import { useId, useMemo, useState } from "react";
import { INPUT_CLASS } from "@/components/ui/field";
import { cn } from "@/lib/cn";

interface PlaceInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Suggestions (a state or city list). The person may still type anything else. */
  options: string[];
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  autoComplete?: string;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  onBlur?: () => void;
  className?: string;
}

const MAX_SHOWN = 60;

/** A text box with a list of suggestions under it (states, cities). Picking one fills the box; typing something that isn't listed is fine. */
export function PlaceInput({ value, onChange, options, placeholder, id, ariaLabel, autoComplete, invalid, describedBy, required, onBlur, className }: PlaceInputProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const shown = useMemo(() => {
    const q = value.trim().toLowerCase();
    const starts = options.filter((o) => o.toLowerCase().startsWith(q));
    const rest = q ? options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q)) : [];
    return [...starts, ...rest].filter((o) => o.toLowerCase() !== q).slice(0, MAX_SHOWN);
  }, [options, value]);
  const visible = open && shown.length > 0;

  const pick = (name: string) => { onChange(name); setOpen(false); setActive(-1); };

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setOpen(false); setActive(-1); onBlur?.(); } }}>
      <input
        id={id} role="combobox" aria-expanded={visible} aria-controls={listId} aria-autocomplete="list" aria-label={ariaLabel} aria-required={required || undefined}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} autoComplete={autoComplete ?? "off"} placeholder={placeholder} value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, shown.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && visible && active >= 0) { e.preventDefault(); pick(shown[active]); }
          else if (e.key === "Escape" && visible) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        }}
        className={cn(className ?? INPUT_CLASS, "data-[invalid=true]:border-danger")}
      />
      {visible && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {shown.map((o, i) => (
            <li key={o} role="option" aria-selected={i === active}>
              <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)} className={cn("block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-primary-soft", i === active && "bg-primary-soft")}>{o}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
