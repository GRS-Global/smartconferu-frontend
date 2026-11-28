"use client";

import { Mail } from "lucide-react";
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";

const PRIMARY = "h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover";
const GHOST = "h-10 rounded-lg border border-line-strong bg-white px-4 text-sm font-semibold text-ink-soft hover:bg-canvas";

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
    <Dialog open={pending !== null} onClose={() => setPending(null)} size="sm" icon={Mail} title="Why the email matters" description="Please add it now if you can.">
      <p className="text-sm leading-relaxed text-ink-soft">
        The email is how this author hears about the paper: the submission confirmation, and later updates such as the decision. Without it they receive nothing until you add it (you can do that from Edit authors).
      </p>
      <p className="mt-2 text-xs text-ink-muted">We ask this once; your choice applies to the other authors too.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2.5">
        <button type="button" onClick={() => choose(true)} className={GHOST}>Add later anyway</button>
        <button type="button" onClick={() => choose(false)} className={PRIMARY}>Add email now</button>
      </div>
    </Dialog>
  );
  return { toggle, dialog };
}
