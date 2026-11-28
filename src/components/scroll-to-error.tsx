"use client";

import { useEffect } from "react";

/**
 * Scrolls to the first validation error whenever one shows up after the person presses a button or submits a form,
 * on every page (it watches the page, so no form has to call anything). An error is a field marked invalid
 * (`aria-invalid="true"`, or the red `border-danger` frame the forms use) or an inline message (`role="alert"`).
 *
 * - A click on a button, or a form submit, "arms" it for a moment. While armed, the first error that appears
 *   (or, after a submit-like press, the first error there is, so pressing Submit again still takes you to it) is brought
 *   into view, centred below the top bar, and an input is focused without a second jump.
 * - Errors already on screen when an unrelated button is pressed are left alone.
 * - Errors already in view don't make the page move.
 */
const ERROR = '[aria-invalid="true"], .border-danger, [role="alert"]';
const SUBMIT_LIKE = /submit|save|update|send|create|continue|next|finish|publish|register|sign|log ?in|confirm|apply|invite|upload|request|reset|verify|done|post|reply|resubmit/i;
const ARM_MS = 1800;
const TOP_GAP = 96; // the top bar

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
};

/** The thing to bring into view for an error element: the field itself, or the field its message belongs to. */
const fieldOf = (el: Element): HTMLElement => {
  if (el.matches("input, select, textarea, button")) return el as HTMLElement;
  if (el.getAttribute("role") === "alert") {
    const wrap = el.parentElement;
    const input = wrap?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
    if (input && visible(input)) return input;
  }
  return el as HTMLElement;
};

export function ScrollToError() {
  useEffect(() => {
    let armedUntil = 0;
    let submitLike = false;
    let before = new WeakSet<Element>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const errors = () => Array.from(document.querySelectorAll(ERROR)).filter((e) => visible(e) && !e.closest("[data-no-scroll-error]"));

    const arm = (like: boolean) => {
      armedUntil = Date.now() + ARM_MS;
      submitLike = like;
      before = new WeakSet(errors());
      clearTimeout(timer);
      timer = setTimeout(check, 200); // a submit that only repeats the same error still takes you to it
    };

    function check() {
      if (Date.now() > armedUntil) return;
      const found = errors().filter((e) => submitLike || !before.has(e));
      // A field's own frame (border-danger) comes before its message in the page, so the first one is the topmost problem.
      const first = found[0];
      if (!first) return;
      armedUntil = 0; // once per press
      const target = fieldOf(first);
      const r = target.getBoundingClientRect();
      const inView = r.top >= TOP_GAP && r.bottom <= window.innerHeight - 24;
      if (!inView) {
        target.style.scrollMarginTop = `${TOP_GAP}px`;
        target.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      }
      if (target.matches("input, select, textarea")) target.focus({ preventScroll: true });
    }

    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest("button, [type=submit]");
      if (!button) return;
      const text = `${button.textContent ?? ""} ${button.getAttribute("aria-label") ?? ""}`;
      arm(button.getAttribute("type") === "submit" || SUBMIT_LIKE.test(text));
    };
    const onSubmit = () => arm(true);
    const onEnter = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.target as Element | null)?.matches?.("input")) arm(true); };

    const observer = new MutationObserver(() => {
      if (Date.now() > armedUntil) return;
      clearTimeout(timer);
      timer = setTimeout(check, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-invalid", "class"] });

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("keydown", onEnter, true);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("keydown", onEnter, true);
    };
  }, []);
  return null;
}
