"use client";

import { Check, MessageSquare, Phone } from "lucide-react";
import { useRef, useState } from "react";
import { DialCodeSelect } from "@/components/ui/dial-code-select";
import { INPUT_CLASS } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { NOTIFY_CHANNELS } from "../fields";
import { joinPhone, parsePhoneValue } from "../phone";

interface PhoneFieldProps {
  id: string;
  phone: string;
  onPhoneChange: (v: string) => void;
  onBlur?: () => void;
  channels?: string[];
  onChannelsChange?: (v: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Classes of the number box; the standard input look by default. */
  inputClassName?: string;
  /** No phone icon inside the number box (the prototype's Mobile number window). */
  bare?: boolean;
}

/** "+<dial code> <number>" stored as one string; with a number entered, offers SMS / WhatsApp notifications.
 *  The number being typed is kept locally (the stored string is trimmed, which would eat a space typed between digit groups). */
export function PhoneField({ id, phone, onPhoneChange, onBlur, channels = [], onChannelsChange, invalid, describedBy, inputClassName, bare }: PhoneFieldProps) {
  const parsed = parsePhoneValue(phone);
  const [dial, setDial] = useState(parsed.dial);
  const [number, setNumber] = useState(parsed.number);
  const numberRef = useRef<HTMLInputElement>(null);
  // When the parent's value changes from outside (not by this field), re-split it — adjusting state during render, not in an effect.
  const [seen, setSeen] = useState(phone);
  if (phone !== seen) {
    setSeen(phone);
    if (phone !== joinPhone(dial, number)) { setDial(parsed.dial); setNumber(parsed.number); }
  }
  const emit = (nextDial: string, nextNumber: string) => {
    const value = joinPhone(nextDial, nextNumber);
    setSeen(value);
    onPhoneChange(value);
  };
  const toggle = (key: string) => onChannelsChange?.(channels.includes(key) ? channels.filter((c) => c !== key) : [...channels, key]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <DialCodeSelect value={dial} onChange={(d) => { setDial(d); emit(d, number); }} onSelect={() => numberRef.current?.focus()} />
        <div className="relative min-w-0 flex-1">
          {!bare && <Phone size={14} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />}
          <input
            ref={numberRef} id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={number} placeholder={bare ? "98765 43210" : "Mobile number (optional)"}
            aria-invalid={invalid || undefined} aria-describedby={describedBy}
            onChange={(e) => { setNumber(e.target.value); emit(dial, e.target.value); }}
            onBlur={onBlur}
            className={cn(inputClassName ?? INPUT_CLASS, !bare && "pl-9")}
          />
        </div>
      </div>
      {onChannelsChange && phone.trim() && (
        <div className="rounded-lg border border-line bg-canvas px-3.5 py-2.5">
          <div className="mb-2 text-xs font-semibold text-ink-soft">Also send me notifications by</div>
          <div className="flex flex-wrap gap-2">
            {NOTIFY_CHANNELS.map(({ key, label }) => {
              const on = channels.includes(key);
              return (
                <button
                  key={key} type="button" aria-pressed={on} onClick={() => toggle(key)}
                  className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors", on ? "border-primary bg-primary-soft text-primary" : "border-line bg-white text-ink-soft")}
                >
                  {on ? <Check size={13} aria-hidden="true" /> : <MessageSquare size={13} aria-hidden="true" />} {label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">Pick one, both, or neither — you&apos;ll still get every update by email.</p>
        </div>
      )}
    </div>
  );
}
