"use client";

import { ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { Conference, ConferenceRole } from "@/types/conference";
import type { DashboardRow } from "../derive";
import { ROLE_META } from "../roles";

interface RoleChoiceDialogProps {
  row: DashboardRow | null;
  onClose: () => void;
  onEnter: (conf: Conference, role: ConferenceRole) => void;
}

/** A conference where the user holds several roles: pick the one to continue as. */
export function RoleChoiceDialog({ row, onClose, onEnter }: RoleChoiceDialogProps) {
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      title={row ? `Continue with ${row.conf.acronym}` : ""}
      description="You have more than one role here. Pick one. (Tip: choose a role tile first and we won't ask.)"
    >
      <ul className="space-y-2">
        {row?.roles.map((r) => {
          const m = ROLE_META[r];
          return (
            <li key={r}>
              <button
                type="button"
                onClick={() => { onClose(); onEnter(row.conf, r); }}
                className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left hover:bg-canvas"
              >
                <span style={{ background: m.soft, color: m.accent }} className="rounded-full px-2.5 py-1 text-xs font-bold">Continue as {m.chip}</span>
                <ChevronRight size={16} className="text-line-strong" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
