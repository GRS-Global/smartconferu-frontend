"use client";

import { useMemo } from "react";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import { DIAL_COUNTRIES } from "@/features/profile/phone";

interface DialCodeSelectProps {
  /** Dial code digits without "+" (e.g. "91"). */
  value: string;
  onChange: (dial: string) => void;
  /** Where focus goes after a Tab/Enter pick: the number box next to it. */
  onSelect?: () => void;
  id?: string;
  disabled?: boolean;
}

/** The prototype's DialCodeSelect: flag + "+code" when closed; a search over country name or code digits when open
 *  (typing "91" finds India as fast as "ind"). */
export function DialCodeSelect({ value, onChange, onSelect, id, disabled }: DialCodeSelectProps) {
  const items = useMemo<SelectItem[]>(() => DIAL_COUNTRIES.map((c) => ({ key: `${c.iso}-${c.dial}`, label: c.name, flag: c.iso, detail: `+${c.dial}` })), []);
  const current = DIAL_COUNTRIES.find((c) => c.dial === value);
  return (
    <SearchableSelect
      id={id} ariaLabel="Country calling code" disabled={disabled}
      items={items} selectedKey={current ? `${current.iso}-${current.dial}` : ""}
      onPick={(i) => onChange(i.detail!.slice(1))}
      matches={(i, q) => i.label.toLowerCase().includes(q) || i.detail!.slice(1).includes(q)}
      triggerContent={`+${value}`} triggerFlag={current?.iso}
      searchPlaceholder="Search country or code..."
      triggerClassName="w-28 shrink-0 gap-1.5 rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2.5 text-sm transition-all"
      chevronSize={13}
      popoverClassName="left-0 mt-1.5 w-64"
      onAfterTabPick={onSelect}
      className="shrink-0"
    />
  );
}
