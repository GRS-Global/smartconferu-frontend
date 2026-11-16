"use client";

import { useMemo } from "react";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import { countryCodeOf } from "@/lib/country-codes";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

/** Country -> its timezone label: a single-zone country, or a multi-zone one where the mainland clearly dominates (Spain, Portugal,
 *  Chile, Ecuador, New Zealand). No guessing for the US, Canada, Russia, Brazil, Australia… — the chair picks those by hand.
 *  Same rule as the prototype's countryTimezone. */
export function countryTimezone(country: string): string {
  const zones = TIMEZONE_OPTIONS.filter((o) => o.country === country);
  if (zones.length === 1 && !zones[0].label.includes("(")) return zones[0].label;
  return zones.find((o) => /\((Mainland|Continental)\)/.test(o.label))?.label ?? "";
}

/** The prototype builds each row's search text as "<label> utc<short> gmt<short> <short>" (short = "+5:30"). */
function searchText(o: { label: string; offset: number }): string {
  const h = Math.trunc(o.offset / 60), m = Math.abs(o.offset % 60);
  const short = `${o.offset < 0 ? "-" : "+"}${Math.abs(h)}${m ? `:${m}` : ""}`;
  return `${o.label} utc${short} gmt${short} ${short}`.toLowerCase();
}

const BROWSER = "browser";

interface TimezoneSelectProps {
  value: string;
  onChange: (label: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

/** The prototype's TimezoneSelect: a searchable list of "India | GMT +05:30" rows (flag per row); an empty value means "use my
 *  browser's timezone". A stored value no longer in the list still shows as-is on the button. */
export function TimezoneSelect({ value, onChange, placeholder = "Use my browser's timezone", id, className }: TimezoneSelectProps) {
  const items = useMemo<SelectItem[]>(() => [
    { key: BROWSER, label: placeholder, flag: "", search: "browser auto default" },
    ...TIMEZONE_OPTIONS.map((o) => ({ key: o.label, label: o.label, flag: countryCodeOf(o.country), search: o.label === "UTC" ? "utc gmt +00:00 coordinated universal time" : searchText(o) })),
  ], [placeholder]);
  const selected = TIMEZONE_OPTIONS.find((o) => o.label === value);
  return (
    <SearchableSelect
      id={id} ariaLabel="Timezone"
      items={items} selectedKey={value || BROWSER} onPick={(i) => onChange(i.key === BROWSER ? "" : i.key)}
      // With text typed, only real timezones match (the "browser" row is for the empty search).
      matches={(i, q) => !q || (i.key !== BROWSER && (i.search ?? "").includes(q))}
      triggerContent={value || placeholder} triggerFlag={selected ? countryCodeOf(selected.country) : ""} muted={!value} bare
      searchPlaceholder="Search a country or offset, e.g. India or +05:30" searchAriaLabel="Search timezones"
      triggerClassName={`${className ?? ""} gap-2`} listClassName="max-h-64"
      popoverClassName="left-0 right-0 mt-1.5 min-w-[18rem]"
    />
  );
}
