"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { INPUT_CLASS } from "./field";

export interface ComboOption<T> {
  key: string;
  label: string;
  /** Secondary text on the right (a dial code, a country). */
  detail?: string;
  icon?: ReactNode;
  value: T;
}

interface ComboboxProps<T> {
  id: string;
  /** What is typed in the box. */
  text: string;
  onTextChange: (text: string) => void;
  /** Options for the current text; the caller filters. */
  options: ComboOption<T>[];
  onSelect: (option: ComboOption<T>) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  autoComplete?: string;
  /** Shown under the list when nothing matches (the typed text can still be used). */
  emptyHint?: string;
  className?: string;
  /** Classes of the text box; the standard input look by default. */
  inputClassName?: string;
}

/** An accessible combobox (ARIA 1.2 list autocomplete): type to filter, arrows to move, Enter to pick, Escape to close. */
export function Combobox<T>({ id, text, onTextChange, options, onSelect, placeholder, invalid, describedBy, disabled, emptyHint, className, inputClassName }: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = open && (options.length > 0 || Boolean(emptyHint && text.trim()));
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));

  const pick = (o: ComboOption<T>) => {
    onSelect(o);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => (i + 1) % Math.max(options.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive((i) => (i - 1 + options.length) % Math.max(options.length, 1)); }
    else if (e.key === "Enter" && shown && options[activeIndex]) { e.preventDefault(); pick(options[activeIndex]); }
    else if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        role="combobox"
        aria-expanded={shown}
        aria-controls={shown ? listId : undefined}
        aria-activedescendant={shown && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onChange={(e) => { onTextChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); }}
        onBlur={() => { closeTimer.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
        className={inputClassName ?? INPUT_CLASS}
      />
      {shown && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-pop">
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px]", i === activeIndex ? "bg-primary-soft text-primary" : "text-ink-soft")}
            >
              {o.icon}
              <span className="min-w-0 flex-1 truncate font-semibold">{o.label}</span>
              {o.detail && <span className="shrink-0 text-[11px] text-ink-faint">{o.detail}</span>}
            </li>
          ))}
          {options.length === 0 && emptyHint && <li role="presentation" className="px-3 py-2 text-xs text-ink-muted">{emptyHint}</li>}
        </ul>
      )}
    </div>
  );
}
