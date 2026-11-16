"use client";

import { useMemo } from "react";
import { INPUT_CLASS } from "@/components/ui/field";
import { SearchableSelect, type SelectItem } from "@/components/ui/searchable-select";
import { COUNTRIES, countryCodeOf } from "@/lib/country-codes";

interface CountrySelectProps {
  value: string;
  onChange: (country: string) => void;
  placeholder?: string;
  /** Defaults to every country plus "Other" (the prototype's COUNTRIES). */
  options?: string[];
  id?: string;
  ariaLabel?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** Classes of the closed button; the standard input look by default. */
  className?: string;
  wrapperClassName?: string;
}

/** The prototype's CountrySelect: a button showing flag + country, opening a searchable list ("Search countries..."). Shared by
 *  Register, Create Conference and every other form that asks for a country. */
export function CountrySelect({ value, onChange, placeholder = "Select a country", options = COUNTRIES, id, ariaLabel, invalid, describedBy, disabled, className, wrapperClassName }: CountrySelectProps) {
  const items = useMemo<SelectItem[]>(() => options.map((c) => ({ key: c, label: c, flag: countryCodeOf(c) })), [options]);
  return (
    <SearchableSelect
      id={id} ariaLabel={ariaLabel ?? placeholder.replace(/\s*\*$/, "")} ariaInvalid={invalid} ariaDescribedBy={describedBy} disabled={disabled}
      items={items} selectedKey={value} onPick={(i) => onChange(i.key)}
      matches={(i, q) => i.label.toLowerCase().includes(q)}
      triggerContent={value || placeholder} triggerFlag={value ? countryCodeOf(value) : undefined} muted={!value}
      searchPlaceholder="Search countries..."
      triggerClassName={`${className ?? INPUT_CLASS} gap-2 data-[invalid=true]:border-danger`}
      popoverClassName="left-0 right-0 mt-1.5 min-w-[16rem]"
      className={wrapperClassName}
    />
  );
}
