"use client";

import { ArrowRight, Bell, Check, Clock, Info, Mail, UserCheck } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";

const PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(109,40,217,0.55)] transition-all hover:bg-primary-hover hover:shadow-[0_8px_20px_-6px_rgba(109,40,217,0.6)]";
const GHOST = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-white px-5 text-sm font-semibold text-ink-soft transition-colors hover:bg-canvas";

/** Why the email matters: one line each, with an icon tile. */
const REASONS: Array<{ icon: ReactNode; title: string; text: string }> = [
  { icon: <Check size={16} strokeWidth={3} aria-hidden="true" />, title: "Submission confirmation", text: "A copy goes to this author as soon as the paper is in." },
  { icon: <Bell size={16} aria-hidden="true" />, title: "Updates and the decision", text: "They hear about the outcome directly, without anyone forwarding it." },
  { icon: <UserCheck size={16} aria-hidden="true" />, title: "The paper in their account", text: "Once they sign in with this email, the paper shows up there." },
];

/** "Will add later" on an author's email: the first time it is ticked, a short note says why the email matters and asks once
 *  (add it now, or add it later anyway). Whatever is chosen is remembered for the other authors of the same form, so it is never asked twice.
 *  `setLater` ticks / unticks the box; `focusEmail` puts the cursor in that author's email box. */
export function useEmailLaterAsk(setLater: (key: number, on: boolean) => void, focusEmail: (key: number) => void) {
  const asked = useRef(false);
  const [pending, setPending] = useState<number | null>(null);

  /** The checkbox was clicked. `isLater` = it is ticked now (so this click unticks it). */
  const toggle = (key: number, isLater: boolean) => {
    if (isLater) setLater(key, false);
    else if (asked.current) setLater(key, true);
    else setPending(key);
  };
  const choose = (later: boolean) => {
    const key = pending;
    asked.current = true;
    setPending(null);
    if (key === null) return;
    if (later) setLater(key, true);
    else setTimeout(() => focusEmail(key), 0);
  };

  const dialog = (
    <Dialog open={pending !== null} onClose={() => setPending(null)} size="md" icon={Mail} title="Add this author's email now?" description="It only takes a few seconds, and it keeps everyone in the loop.">
      <ul className="space-y-2.5">
        {REASONS.map((r) => (
          <li key={r.title} className="flex items-start gap-3 rounded-xl border border-primary-soft-border bg-primary-soft px-3.5 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-[0_1px_2px_rgba(15,23,42,0.08)]">{r.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-navy">{r.title}</span>
              <span className="block text-[13px] leading-snug text-ink-muted">{r.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <div role="note" className="mt-3.5 flex items-start gap-2.5 rounded-xl bg-warning-soft px-3.5 py-3 text-[13px] leading-snug text-warning-ink">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>Without an email this author receives nothing until you add it. You can do that any time from <strong>Edit authors</strong> on the paper&apos;s page.</span>
      </div>
      <p className="mt-3 text-center text-xs text-ink-muted">We only ask this once: your choice applies to the other authors too.</p>
      <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => choose(true)} className={GHOST}><Clock size={15} aria-hidden="true" /> Add later anyway</button>
        <button type="button" onClick={() => choose(false)} className={PRIMARY}>Add email now <ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </Dialog>
  );
  return { toggle, dialog };
}
