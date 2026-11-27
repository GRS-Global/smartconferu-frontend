"use client";
/* "Confirm it's you" (the prototype's StepUpDialog): a fresh 6-digit code before a high-risk action
   (extending a license, suspending, merging, resetting two-step, team changes…). One accepted code
   covers further high-risk actions for 10 minutes. The API decides when it is needed; the shell
   mounts this once and the API client opens it and retries the action. In development the emailed
   code is filled in (DEV_SHOW_EMAIL_CODES). */
import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { onStepUpRequired } from "../api";
import { requestStepUpCode, verifyStepUp } from "../services";
import { Button, errorText } from "./ui";

const LENGTH = 6;
const empty = () => Array<string>(LENGTH).fill("");

export function StepUpHost({ onConfirmed }: { onConfirmed?: () => void }) {
  const [open, setOpen] = useState(false);
  const [factor, setFactor] = useState<"email" | "totp">("email");
  const [digits, setDigits] = useState<string[]>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    onStepUpRequired(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve;
          setDigits(empty());
          setError(null);
          setOpen(true);
          requestStepUpCode()
            .then((r) => {
              setFactor(r.factor);
              if (r.devCode) setDigits(r.devCode.split("").slice(0, LENGTH));
            })
            .catch((e: unknown) => setError(errorText(e)));
        }),
    );
    return () => onStepUpRequired(null);
  }, []);

  const close = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };
  const set = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    setError(null);
    if (clean.length > 1) {
      const all = clean.slice(0, LENGTH).split("");
      setDigits(Array.from({ length: LENGTH }, (_, k) => all[k] ?? ""));
      refs.current[Math.min(all.length, LENGTH - 1)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, k) => (k === i ? clean : x)));
    if (clean && i < LENGTH - 1) refs.current[i + 1]?.focus();
  };
  const complete = digits.every(Boolean);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete || busy) return;
    setBusy(true);
    try {
      await verifyStepUp(digits.join(""));
      onConfirmed?.();
      close(true);
    } catch (err) {
      setError(errorText(err));
      setDigits(empty());
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onKeyDown={(e) => e.key === "Escape" && close(false)}>
      <div className="absolute inset-0" style={{ background: "rgba(11,16,32,0.45)" }} onClick={() => close(false)} />
      <form onSubmit={submit} className="relative w-full max-w-[420px] bg-white rounded-2xl p-6 sa-pop" style={{ boxShadow: "var(--shadow-pop)" }} role="dialog" aria-modal="true" aria-labelledby="sa-stepup-title">
        <button type="button" onClick={() => close(false)} className="sa-icon-btn absolute top-3 right-3 cursor-pointer" aria-label="Cancel">
          <X size={18} />
        </button>
        <span className="inline-flex w-11 h-11 rounded-xl items-center justify-center mb-4" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          <ShieldCheck size={22} />
        </span>
        <h2 id="sa-stepup-title" className="text-[19px] font-bold" style={{ color: "var(--text)" }}>
          Confirm it&apos;s you
        </h2>
        <p className="text-[13.5px] mt-1.5 mb-5" style={{ color: "var(--text-muted)" }}>
          This is a high-risk action. {factor === "totp" ? "Enter the 6-digit code from your authenticator app." : "Enter the 6-digit code we just emailed you."} It covers further high-risk actions for 10 minutes.
        </p>
        <div className="flex gap-2 mb-4" role="group" aria-label="6-digit code">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs.current[i - 1]?.focus()}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={LENGTH}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1} of ${LENGTH}`}
              className="sa-auth-input !h-[50px] !w-0 flex-1 !px-0 text-center !text-[19px] font-semibold"
            />
          ))}
        </div>
        {error && (
          <p role="alert" className="text-[13px] mb-4" style={{ color: "var(--danger-ink)" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" tone="neutral" variant="soft" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!complete || busy}>
            {busy ? <Loader2 size={15} className="sa-spin" /> : <ShieldCheck size={15} />}
            Confirm
          </Button>
        </div>
      </form>
    </div>
  );
}
