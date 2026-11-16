import type { FlowToastData } from "@/components/ui/flow-toast";

/* A message to show on the next page: the chair's own-review page sends the chair back to the paper's review page, which says what happened (the prototype's
   PENDING_REVIEW_TOAST). Kept for this tab only and read once. */

const KEY = "smartconferu.pendingToast";

export function setPendingToast(toast: FlowToastData): void {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(toast)); } catch { /* storage off */ }
}

export function takePendingToast(): FlowToastData | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as FlowToastData;
  } catch { return null; }
}
