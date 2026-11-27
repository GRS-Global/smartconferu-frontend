"use client";

import { X } from "lucide-react";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface KeywordTagsProps {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Most keywords kept (the API keeps 20). */
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** Splits typed or pasted text into keywords: commas, semicolons and new lines separate them. */
const split = (text: string) => text.split(/[,;\n]/).map((k) => k.trim().replace(/\s+/g, " ")).filter(Boolean);

/** Keywords as tags inside one box: type and press Enter or a comma to add one, paste a list to add them all, × or Backspace (in the
 *  empty box) to remove. Duplicates are ignored, whatever the case. */
export function KeywordTags({ id, value, onChange, max = 20, placeholder = "Type a keyword and press Enter", disabled, invalid, describedBy }: KeywordTagsProps) {
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const full = value.length >= max;

  const add = (words: string[]) => {
    const seen = new Set(value.map((v) => v.toLowerCase()));
    const next = [...value];
    for (const w of words) {
      const word = w.slice(0, 100);
      if (next.length >= max) break;
      if (seen.has(word.toLowerCase())) continue;
      seen.add(word.toLowerCase());
      next.push(word);
    }
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };
  const remove = (word: string) => onChange(value.filter((v) => v !== word));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === "," || e.key === ";") && draft.trim()) { e.preventDefault(); add(split(draft)); return; }
    if (e.key === "Enter") e.preventDefault(); // never submits the form from here
    if (e.key === "Backspace" && !draft && value.length) remove(value[value.length - 1]);
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[,;\n]/.test(text)) return; // a single word pastes as usual
    e.preventDefault();
    add(split(`${draft} ${text}`.trim()));
  };

  return (
    <div>
      <div
        onClick={() => input.current?.focus()}
        className={cn(
          "flex min-h-[42px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border-[1.5px] bg-white px-2 py-1.5 transition-colors focus-within:border-primary",
          invalid ? "border-danger" : "border-line",
          disabled && "cursor-not-allowed bg-canvas",
        )}
      >
        <ul aria-label="Keywords" className="contents">
          {value.map((v) => (
            <li key={v} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft py-1 pl-2.5 pr-1 text-xs font-semibold text-primary">
              <span className="truncate">{v}</span>
              <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); remove(v); }} aria-label={`Remove keyword ${v}`} className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-white/70 disabled:opacity-40">
                <X size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={input} id={id} value={draft} disabled={disabled || full} maxLength={100}
          onChange={(e) => {
            const v = e.target.value;
            // A comma typed on a phone keyboard (no keydown key) still ends the keyword.
            if (/[,;]/.test(v)) add(split(v)); else setDraft(v);
          }}
          onKeyDown={onKeyDown} onPaste={onPaste}
          onBlur={() => { if (draft.trim()) add(split(draft)); }}
          placeholder={full ? `Up to ${max} keywords` : value.length ? "Add another…" : placeholder}
          aria-invalid={invalid || undefined} aria-describedby={describedBy}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>
      <p className="mt-1 text-xs text-ink-faint">{value.length}/{max} · press Enter or a comma after each keyword, or paste a list.</p>
    </div>
  );
}
