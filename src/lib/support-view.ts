/* A Super Admin's read-only "View as" in this tab (opened from the admin console). The view's token
   lives in this tab's sessionStorage only; the API refuses every change made with it. While it is on,
   the app never uses the browser's own sign-in (that cookie is the admin's): when the view ends or
   expires, the tab goes to /support-view?ended=1 instead of refreshing. */

const KEY = "sc.supportView";

export interface SupportView {
  token: string;
  /** Who the app is being viewed as. */
  name: string;
  /** When the view ends (ISO). */
  until: string;
}

export function readSupportView(): SupportView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const view = raw ? (JSON.parse(raw) as SupportView) : null;
    return view && new Date(view.until).getTime() > Date.now() ? view : null;
  } catch {
    return null;
  }
}

/** Was a view started in this tab (even if it has expired since)? */
export function hadSupportView(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function startSupportView(view: SupportView): void {
  window.sessionStorage.setItem(KEY, JSON.stringify(view));
}

/** Ends the view in this tab and shows the "view ended" page. */
export function endSupportView(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage off */
  }
  if (!window.location.pathname.startsWith("/support-view")) window.location.replace("/support-view?ended=1");
}
