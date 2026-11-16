"use client";

import { Clock } from "lucide-react";
import { useId, type ReactNode } from "react";
import { INPUT_CLASS } from "@/components/ui/field";
import { PROFILE_MONTH_NAMES, PROFILE_MONTHS, profileYears } from "../entries";

const YEARS = profileYears();

/** Month + year selects ("From" / "To" / "Since"). */
export function MonthYearPicker({ label, month, year, onMonth, onYear, disabled }: { label: string; month: string; year: string; onMonth: (v: string) => void; onYear: (v: string) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className="mb-1 block text-xs font-bold text-ink-soft">{label}</span>
      <div className="flex gap-2">
        <select aria-label={`${label} month`} value={month || ""} onChange={(e) => onMonth(e.target.value)} disabled={disabled} className={INPUT_CLASS}>
          <option value="">Month</option>
          {PROFILE_MONTHS.map((m, i) => <option key={m} value={m}>{PROFILE_MONTH_NAMES[i]}</option>)}
        </select>
        <select aria-label={`${label} year`} value={year || ""} onChange={(e) => onYear(e.target.value)} disabled={disabled} className={INPUT_CLASS}>
          <option value="">Year</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}

/** The dashed box an "Other — not in the list" value is typed into. */
export function OtherBox({ children }: { children: ReactNode }) {
  return <div className="space-y-2.5 rounded-lg border border-dashed border-line-strong bg-white p-3.5">{children}</div>;
}

export function PendingNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] leading-normal text-ink-muted">
      <Clock size={14} className="mt-0.5 shrink-0 text-[#B45309]" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** "“X” is already in the list. [Use it]" — offered when what was typed under Other is a listed value. */
export function ListMatch({ match, onUse }: { match: string; onUse: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-soft-border bg-primary-soft px-3 py-2.5">
      <span className="text-[13px] font-semibold text-navy">“{match}” is already in the list.</span>
      <button type="button" onClick={onUse} className="h-8 rounded-lg border border-line-strong bg-white px-3 text-[13px] font-semibold text-navy hover:border-primary">Use it</button>
    </div>
  );
}

/** A radio-style choice ("Primary affiliation", "Primary — sign-in & notifications"). */
export function RadioChoice({ checked, disabled, onSelect, children }: { checked: boolean; disabled?: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={checked} disabled={disabled} onClick={onSelect} className={`inline-flex items-center gap-2 text-[13px] font-semibold disabled:cursor-not-allowed ${checked ? "text-primary" : disabled ? "text-ink-muted" : "text-ink-soft"}`}>
      <span className={`box-border h-4 w-4 shrink-0 rounded-full bg-white ${checked ? "border-[5px] border-primary" : "border-[1.5px] border-line-strong"}`} aria-hidden="true" />
      {children}
    </button>
  );
}

export const FieldError = ({ text }: { text: string }) => (text ? <p role="alert" className="text-[13px] font-medium text-danger">{text}</p> : null);
