import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; the field shows only a placeholder. */
  label: string;
}

export function SearchField({ value, onChange, label, className, ...rest }: SearchFieldProps) {
  return (
    <label className={cn("flex h-10 w-72 max-w-full items-center gap-2 rounded-lg border border-line bg-white px-3 focus-within:border-primary", className)}>
      <span className="sr-only">{label}</span>
      <Search size={15} className="shrink-0 text-ink-faint" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-slate-400"
        {...rest}
      />
    </label>
  );
}
