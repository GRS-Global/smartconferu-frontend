import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name (the visible label is usually beside it; pass its id with `labelledBy` instead if it has one). */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  id?: string;
}

/** An on/off switch (role="switch"): Space or Enter toggles it, and its state is announced. */
export function Switch({ checked, onChange, label, labelledBy, describedBy, disabled, id }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60", checked ? "bg-primary" : "bg-line")}
    >
      <span aria-hidden="true" className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked && "translate-x-4")} />
    </button>
  );
}
