"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CountryFlag } from "@/components/ui/country-flag";
import { focusNextElement, focusPrevElement } from "@/lib/focus";
import { cn } from "@/lib/cn";

export interface SelectItem {
  key: string;
  label: string;
  /** ISO alpha-2 code of the flag shown before the label. */
  flag: string;
  /** Right-aligned secondary text (a dial code). */
  detail?: string;
  /** Extra lowercase text the search also matches (a timezone's offset spellings). */
  search?: string;
}

interface SearchableSelectProps {
  items: SelectItem[];
  selectedKey: string;
  onPick: (item: SelectItem) => void;
  /** Which items the typed text keeps. */
  matches: (item: SelectItem, query: string) => boolean;
  /** What the closed button shows after the flag (the prototype's CountrySelect / DialCodeSelect differ here). */
  triggerContent: ReactNode;
  /** Flag in the closed button (none while nothing is chosen). */
  triggerFlag?: string;
  searchPlaceholder: string;
  /** Accessible name of the search box when it differs from the placeholder. */
  searchAriaLabel?: string;
  /** Height cap of the list (the prototype's pickers differ: max-h-60 / max-h-64). */
  listClassName?: string;
  /** Classes of the closed button (the caller's input look, or the dial-code look). */
  triggerClassName: string;
  chevronSize?: number;
  popoverClassName: string;
  /** Called instead of focusing the next field after a Tab/Enter pick (the dial code hands focus to the number box). */
  onAfterTabPick?: () => void;
  id?: string;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  disabled?: boolean;
  /** Sets the closed button's text colour: faint while nothing is chosen. */
  muted?: boolean;
  /** Leave out the account-form focus treatment (brand ring + .smart-field); the caller's input classes supply the focus look. */
  bare?: boolean;
  className?: string;
}

/** The prototype's searchable popover select (CountrySelect and DialCodeSelect share this behaviour): a button that opens a
 *  search box + list. Enter picks and stays; Tab picks and moves on; Escape closes; typing on the closed button opens it
 *  with that letter already searched; arrows move the highlight. */
export function SearchableSelect({ items, selectedKey, onPick, matches, triggerContent, triggerFlag, searchPlaceholder, searchAriaLabel, listClassName = "max-h-60", triggerClassName, chevronSize = 14, popoverClassName, onAfterTabPick, id, ariaLabel, ariaInvalid, ariaDescribedBy, disabled, muted, bare, className }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => { if (open) (listRef.current?.children[highlight] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" }); }, [open, highlight]);

  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  const filtered = items.filter((i) => matches(i, q));
  const close = () => { setOpen(false); setQuery(""); };
  const toggle = () => {
    if (open) return close();
    setHighlight(Math.max(items.findIndex((i) => i.key === selectedKey), 0));
    setOpen(true);
  };
  const pick = (item: SelectItem, next = false) => {
    onPick(item);
    close();
    if (next) requestAnimationFrame(() => (onAfterTabPick ? onAfterTabPick() : focusNextElement(triggerRef.current)));
    else triggerRef.current?.focus();
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight], false);
      else { close(); triggerRef.current?.focus(); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight], !e.shiftKey);
      else {
        close();
        requestAnimationFrame(() => {
          if (e.shiftKey) focusPrevElement(triggerRef.current);
          else if (onAfterTabPick) onAfterTabPick();
          else focusNextElement(triggerRef.current);
        });
      }
    } else if (e.key === "Escape") { e.preventDefault(); close(); triggerRef.current?.focus(); }
  };
  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setQuery(e.key); setHighlight(0); setOpen(true); }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef} id={id} type="button" disabled={disabled} onClick={toggle} onKeyDown={onTriggerKey}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} data-invalid={ariaInvalid || undefined} aria-describedby={ariaDescribedBy}
        className={cn(triggerClassName, "flex cursor-pointer items-center bg-white text-left", !bare && "smart-field focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary", open && "!border-primary")}
        style={{ color: muted ? "var(--ink-faint)" : "var(--ink)" }}
      >
        {triggerFlag !== undefined && <CountryFlag code={triggerFlag} />}
        <span className="flex-1 truncate">{triggerContent}</span>
        <ChevronDown size={chevronSize} aria-hidden="true" className="shrink-0 text-ink-faint" />
      </button>
      {open && (
        <div className={cn("absolute z-30 overflow-hidden rounded-lg border border-line bg-white shadow-lg", popoverClassName)}>
          <div className="flex items-center gap-2 border-b border-muted px-3 py-2">
            <Search size={13} aria-hidden="true" className="text-ink-faint" />
            <input
              ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} onKeyDown={onSearchKey}
              placeholder={searchPlaceholder} aria-label={searchAriaLabel ?? searchPlaceholder.replace(/\.+$/, "")}
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
            />
          </div>
          <div ref={listRef} role="listbox" className={cn("overflow-y-auto py-1", listClassName)}>
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-ink-faint">No matches</div>}
            {filtered.map((item, i) => {
              const selected = item.key === selectedKey;
              return (
                <button
                  key={item.key} type="button" tabIndex={-1} role="option" aria-selected={selected}
                  onMouseEnter={() => setHighlight(i)} onClick={() => pick(item)}
                  className={cn("flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm", selected ? "bg-primary-soft text-primary" : i === highlight ? "bg-canvas text-ink" : "bg-transparent text-ink")}
                >
                  <CountryFlag code={item.flag} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.detail && <span className="shrink-0 text-ink-faint">{item.detail}</span>}
                  {selected && <Check size={14} aria-hidden="true" className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
