const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function tabbables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
}

/** Moves focus to the next tabbable element after `from` (a picker that handles Tab itself, so Tab never skips the next field). */
export function focusNextElement(from: HTMLElement | null) {
  if (!from) return;
  const list = tabbables();
  list[list.indexOf(from) + 1]?.focus();
}

export function focusPrevElement(from: HTMLElement | null) {
  if (!from) return;
  const list = tabbables();
  const i = list.indexOf(from);
  if (i > 0) list[i - 1]?.focus();
}
