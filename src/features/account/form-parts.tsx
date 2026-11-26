import { Fragment, type ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { RESEARCH_AREA_GROUPS, RESEARCH_SUBAREAS } from "@/lib/research-areas";

/* Pieces the prototype's long forms share (New Preprint, New Slides, Publish with Us): the step bar, a card's heading, and the research-area options. */

export function FormStepper({ steps, current, onStepClick }: { steps: Array<{ key: string; label: string }>; current: number; onStepClick: (i: number) => void }) {
  return (
    <div className="mb-8 w-full">
    <div className="flex items-center w-full">
      {steps.map((s, i) => {
        const reached = i <= current;
        return (
          <Fragment key={s.key}>
            {/* On a phone the six labels do not fit in one row: only the numbered circles show, and the current step is named below the bar. */}
            <button
              type="button"
              onClick={() => onStepClick(i)}
              aria-label={`Step ${i + 1}: ${s.label}`}
              aria-current={i === current ? "step" : undefined}
              className="flex flex-col items-center shrink-0 cursor-pointer sm:min-w-[88px]"
            >
              <div
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: i < current ? "var(--primary)" : "#FFFFFF",
                  border: `2.5px solid ${reached ? "var(--primary)" : "var(--border-strong)"}`,
                  color: i < current ? "#FFFFFF" : reached ? "var(--primary)" : "var(--ink-faint)",
                }}
                className="flex items-center justify-center text-xs font-bold shrink-0"
              >
                {i < current ? <Check size={13} strokeWidth={3} /> : i + 1}
              </div>
              <span
                style={{ color: reached ? "var(--navy)" : "var(--ink-faint)" }}
                className="mt-1.5 hidden text-[11px] font-semibold text-center leading-tight sm:block"
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="mb-0 sm:mb-5" style={{ flex: 1, height: 2.5, background: i < current ? "var(--primary)" : "var(--border)" }} />
            )}
          </Fragment>
        );
      })}
    </div>
    <p className="mt-3 text-center text-xs font-semibold text-navy sm:hidden">Step {current + 1} of {steps.length}: {steps[current]?.label}</p>
    </div>
  );
}

export function CardHeader({ icon: Icon, title, step, action }: { icon?: LucideIcon; title: string; step?: number | string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        {step ? (
          <div style={{ background: "var(--navy)", color: "#FFFFFF" }} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold">
            {step}
          </div>
        ) : (
          <div style={{ background: "var(--primary-soft)", color: "var(--primary)" }} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
            {Icon && <Icon size={15} />}
          </div>
        )}
        <h3 style={{ color: "var(--navy)" }} className="text-sm font-bold">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/** Primary-area <option>s, grouped (Computing & Engineering, Natural Sciences, …). */
export function ResearchAreaOptions() {
  return RESEARCH_AREA_GROUPS.map((g) => (
    <optgroup key={g.label} label={g.label}>
      {g.areas.map((a) => <option key={a} value={a}>{a}</option>)}
    </optgroup>
  ));
}

/** Secondary-area options for a primary; keeps an already-saved value that isn't in the list. */
export const secondaryAreaOptions = (primary: string, current: string): string[] => {
  const list = RESEARCH_SUBAREAS[primary] || [];
  return current && !list.includes(current) ? [current, ...list] : list;
};

export const inputStyle = { border: "1.5px solid var(--border)", color: "var(--ink)" } as const;
export const inputClass = "w-full px-3.5 py-2.5 rounded-lg text-sm outline-none focus:border-[var(--primary)] placeholder:text-slate-400";
export const labelStyle = { color: "var(--ink-soft)" } as const;
export const labelClass = "text-xs font-semibold mb-1 block";
