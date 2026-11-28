"use client";

import { useEffect } from "react";

/* When a form refuses to go ahead, the person should see why: this brings the first error into view and puts the cursor in its field, on every form of
   the app. Nothing is rendered and no form has to call anything.

   How it knows: a click on an action button (Submit, Save, Create, Send … or any submit button / Enter in a form) starts a short watch. The first error
   that appears after it, in page order, is scrolled to the middle of the screen — also one that comes back from the server a few seconds later (a
   duplicate title). If none appears but fields are still marked invalid from an earlier try, the first of those is shown instead. The watch ends as
   soon as the person types, so nothing ever jumps while they write.

   What counts as an error: a field marked aria-invalid="true", a message with role="alert", a control with the danger border, or anything carrying
   data-field-error. Hidden, aria-hidden and fixed (toast) elements are skipped. A button with data-no-error-scroll never starts a watch. */

const ERROR = '[aria-invalid="true"], [role="alert"], [data-field-error], .border-danger';
const FIELD_ERROR = '[aria-invalid="true"], [data-field-error], input.border-danger, select.border-danger, textarea.border-danger';
const CONTROL = "input:not([type=hidden]), select, textarea";
const ACTION = /\b(submit|save|create|send|continue|next|publish|update|confirm|add|invite|sign|register|apply|change|request|verify|finish|upload|post|reply|assign|pay|book)\b/i;
const WATCH_MS = 8000;
const SETTLE_MS = 350;

function shown(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[aria-hidden="true"], [data-no-error-scroll]')) return false;
  // offsetParent is null for hidden elements and for fixed ones (toasts, banners pinned to the screen): nothing to scroll to.
  if (el.offsetParent === null && getComputedStyle(el).position !== "sticky") return false;
  // A danger border on a card or a badge is decoration; on a control (or a box around one) it marks an error.
  if (el.matches(".border-danger") && !el.matches(CONTROL) && !el.querySelector(`${CONTROL}, label, [role=group], button`)) return false;
  return true;
}

const errorsIn = (scope: ParentNode, selector = ERROR) => Array.from(scope.querySelectorAll(selector)).filter(shown);

function reveal(el: Element) {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  // The cursor goes into the field the error is about: the element itself, or the nearest control around a message.
  const control = el.matches(CONTROL) ? el : el.querySelector(CONTROL) ?? el.parentElement?.querySelector(CONTROL) ?? null;
  if (control instanceof HTMLElement && !control.hasAttribute("disabled")) control.focus({ preventScroll: true });
}

function isAction(button: HTMLElement): boolean {
  if (button.hasAttribute("data-no-error-scroll") || button.matches(":disabled")) return false;
  if (button instanceof HTMLButtonElement || button instanceof HTMLInputElement) {
    if (button.type === "submit" && button.form) return true;
  }
  const words = `${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`;
  return ACTION.test(words);
}

export function ScrollToFirstError() {
  useEffect(() => {
    let stop: (() => void) | null = null;

    const watch = (scope: ParentNode) => {
      stop?.();
      const before = new Set(errorsIn(document));
      let frame = 0;
      const check = () => {
        frame = 0;
        const fresh = errorsIn(document).find((el) => !before.has(el));
        if (fresh) { reveal(fresh); stop?.(); }
      };
      const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(check); });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "aria-invalid", "role"] });
      // The same errors as last time: nothing new appears, so show the first field that is still wrong.
      const settle = window.setTimeout(() => {
        const still = errorsIn(scope, FIELD_ERROR)[0];
        if (still) { reveal(still); stop?.(); }
      }, SETTLE_MS);
      const end = window.setTimeout(() => stop?.(), WATCH_MS);
      const typed = () => stop?.();
      document.addEventListener("input", typed, true);
      stop = () => {
        observer.disconnect();
        if (frame) cancelAnimationFrame(frame);
        window.clearTimeout(settle);
        window.clearTimeout(end);
        document.removeEventListener("input", typed, true);
        stop = null;
      };
    };

    const onClick = (e: MouseEvent) => {
      const button = e.target instanceof Element ? e.target.closest<HTMLElement>("button, input[type=submit], [role=button]") : null;
      if (!button || !isAction(button)) return;
      watch(button.closest('[role="dialog"], form') ?? document);
    };
    // Enter in a form's field submits it without a click.
    const onSubmit = (e: SubmitEvent) => {
      if (e.submitter || !(e.target instanceof HTMLFormElement)) return;
      watch(e.target);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      stop?.();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
  return null;
}
