// Getting a tour target onto the screen, reliably, wherever it sits (the prototype's setup-tour/reveal.js): wait for the element to exist and have a size
// (asking the page to open a collapsed section if it is not there yet), scroll every container that owns it (nested panels first, then the window) clear of
// sticky bars, then wait until the scrolling has stopped. Nothing here assumes the page scrolls the window.
import type { Box } from "./placement";

const TARGET = (key: string) => `[data-tour="${key}"]`;
const sized = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

export const prefersReducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

/** The first laid-out element for each key (hidden or collapsed ones have no size, so they do not count). */
export function findTargets(keys: string[] | undefined): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const key of keys ?? []) {
    const el = [...document.querySelectorAll<HTMLElement>(TARGET(key))].find((e) => e.isConnected && sized(e));
    if (el) found.push(el);
  }
  return found;
}

export function unionRect(els: Element[]): Box {
  const rs = els.map((e) => e.getBoundingClientRect());
  const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
  const right = Math.max(...rs.map((r) => r.right)), bottom = Math.max(...rs.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** Resolves with the elements once every target exists and has a size; with whatever was found (or null) after `timeout`, so a missing target can never leave the tour waiting. */
export function waitForTargets(keys: string[], { signal, timeout = 4000, onMissing }: { signal?: AbortSignal; timeout?: number; onMissing?: () => void } = {}): Promise<HTMLElement[] | null> {
  return new Promise((resolve) => {
    // eslint-disable-next-line prefer-const -- the timer is set after `finish`, which clears it
    let finished = false; let asked = false; let frame = 0; let timer: ReturnType<typeof setTimeout> | undefined; let observer: MutationObserver | null = null;
    const finish = (value: HTMLElement[] | null) => {
      if (finished) return;
      finished = true; observer?.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule); signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => finish(null);
    const check = () => {
      frame = 0;
      const els = findTargets(keys);
      if (els.length === keys.length) { finish(els); return; }
      if (!asked) { asked = true; onMissing?.(); }
    };
    function schedule() { if (!frame && !finished) frame = requestAnimationFrame(check); }
    if (signal?.aborted) { resolve(null); return; }
    signal?.addEventListener("abort", onAbort);
    window.addEventListener("resize", schedule);
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden", "open", "aria-expanded"] });
    timer = setTimeout(() => { const els = findTargets(keys); finish(els.length ? els : null); }, timeout);
    check();
  });
}

// Scrollable ancestors of an element, innermost first. The window is handled separately.
function scrollParents(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 1) out.push(p);
  }
  return out;
}

/** How much of the top / bottom of the screen is covered by sticky or fixed bars (only wide, short bars count, not the sidebar, a modal or a toast). */
export function stuckBarInsets(): { top: number; bottom: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  const bars: DOMRect[] = [];
  for (const el of document.body.querySelectorAll("*")) {
    const pos = getComputedStyle(el).position;
    if (pos !== "sticky" && pos !== "fixed") continue;
    if (el.closest("[data-tour-overlay],[data-tour-popover]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= vw * 0.6 && r.height > 0 && r.height <= vh * 0.35) bars.push(r);
  }
  let top = 0;
  for (let i = 0; i < 4; i++) { let grew = false; for (const r of bars) if (r.top <= top + 2 && r.bottom > top) { top = r.bottom; grew = true; } if (!grew) break; }
  let bottom = 0;
  for (let i = 0; i < 4; i++) { let grew = false; for (const r of bars) if (r.bottom >= vh - bottom - 2 && r.top < vh - bottom) { bottom = vh - r.top; grew = true; } if (!grew) break; }
  return { top: Math.max(0, Math.round(top)), bottom: Math.max(0, Math.round(bottom)) };
}

const MARGIN = 24; // breathing room between the target and the edge of the visible area

// How far to scroll so `rect` sits comfortably inside `view` (0 when it already does).
function scrollDelta(rect: DOMRect, view: { top: number; bottom: number }) {
  const viewH = view.bottom - view.top;
  if (rect.top >= view.top && rect.bottom <= view.bottom) return 0;
  if (rect.height >= viewH) return rect.top - view.top; // taller than the view: start at its top
  return rect.top - (view.top + (viewH - rect.height) * 0.35); // a third of the way down, leaving room for the popover
}

export function isComfortablyVisible(rect: Box, insets = { top: 0, bottom: 0 }) {
  const vh = window.innerHeight;
  const top = insets.top + 8, bottom = vh - insets.bottom - 8;
  if (rect.height >= bottom - top) return rect.top >= top && rect.top < vh * 0.6;
  return rect.top >= top && rect.bottom <= bottom;
}

/** True when a panel that scrolls (the menu, a dialog) hides part of `el`: being inside the window is not enough if the panel around it cuts it off. */
export function isClipped(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return scrollParents(el).some((sp) => { const c = sp.getBoundingClientRect(); return r.top < c.top - 1 || r.bottom > c.bottom + 1; });
}

type Container = HTMLElement | Window;
const position = (c: Container) => (c === window ? window.scrollY : (c as HTMLElement).scrollTop);

// Waits until scrolling has actually stopped (a few frames with no movement), or `scrollend`, bounded.
function settle(container: Container, el: HTMLElement, signal?: AbortSignal, timeout = 1500): Promise<void> {
  return new Promise((resolve) => {
    let still = 0; let done = false;
    let last = `${position(container)}|${Math.round(el.getBoundingClientRect().top)}`;
    const start = performance.now();
    const target: EventTarget = container === window ? document : container;
    const end = () => { if (done) return; done = true; target.removeEventListener("scrollend", onEnd); resolve(); };
    const onEnd = () => { still = 3; };
    target.addEventListener("scrollend", onEnd);
    const step = () => {
      if (done) return;
      if (signal?.aborted) { end(); return; }
      const now = `${position(container)}|${Math.round(el.getBoundingClientRect().top)}`;
      if (now === last) still += 1; else { still = 0; last = now; }
      if (still >= 3 || performance.now() - start > timeout) end(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function scrollBy(container: Container, dy: number, el: HTMLElement, smooth: boolean, signal?: AbortSignal) {
  if (Math.abs(dy) < 1 || signal?.aborted) return;
  const options: ScrollToOptions = { top: dy, left: 0, behavior: smooth ? "smooth" : "auto" };
  if (container === window) window.scrollBy(options); else (container as HTMLElement).scrollBy(options);
  await settle(container, el, signal);
}

/** Scrolls `el` into a comfortable place, every container that owns it and then the window, clear of sticky bars; resolves once it has stopped moving, with the bar insets (null if cancelled). */
export async function revealTarget(el: HTMLElement, { signal }: { signal?: AbortSignal } = {}): Promise<{ top: number; bottom: number } | null> {
  const smooth = !prefersReducedMotion();
  for (const sp of scrollParents(el)) {
    if (signal?.aborted) return null;
    const c = sp.getBoundingClientRect();
    await scrollBy(sp, scrollDelta(el.getBoundingClientRect(), { top: c.top + MARGIN, bottom: c.bottom - MARGIN }), el, smooth, signal);
  }
  if (signal?.aborted) return null;
  const insets = stuckBarInsets();
  await scrollBy(window, scrollDelta(el.getBoundingClientRect(), { top: insets.top + MARGIN, bottom: window.innerHeight - insets.bottom - MARGIN }), el, smooth, signal);
  return signal?.aborted ? null : stuckBarInsets();
}

/** Puts the cursor in the field a step is about, without opening a dropdown or changing anything. */
export function focusField(root: HTMLElement) {
  const field = root.matches("input,select,textarea") ? root : root.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable=true]");
  if (!field) return;
  // The prototype shows no focus ring here (the spotlight already marks the field): the cursor is in it, the border stays as it was until the person clicks away.
  field.setAttribute("data-tour-quiet", "");
  field.addEventListener("blur", () => field.removeAttribute("data-tour-quiet"), { once: true });
  field.focus({ preventScroll: true });
}
