"use client";

import { Lock, Minus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PAD, placePopover, type Box, type Placement } from "./placement";
import { findTargets, focusField, isClipped, isComfortablyVisible, revealTarget, unionRect, waitForTargets } from "./reveal";

/* A spotlight + anchored popover for one tour step, pointed at real elements by `data-tour` attributes (never CSS classes or visible text, so restyling or
   translating the page cannot break it). The prototype's setup-tour/SpotlightTour.jsx.

   A step goes  finding → ready  (or → lost):
   - finding: wait for the target to exist (route change, loading, a section that has to open), scroll it into a comfortable spot, wait until everything has
     stopped moving. Nothing is shown yet: the popover never appears while its target is still off-screen.
   - ready: spotlight + popover beside the field, kept in place on scroll / resize / layout changes. A field step also puts the cursor in the field.
   - lost: the target never showed up within a bounded wait. The popover says so and offers Retry (and, where the step knows how, to open the right page).

   Never blocks the page: the dimmed overlay and the spotlight ignore the pointer, so the field stays usable. Keyboard: ← back, → next, Esc finish later
   (arrows are ignored while typing in a field). */

export interface TourAction { label: string; onClick: () => void; disabled?: boolean }
export interface TourStep {
  key: string;
  /** The route (under /chair/<conference>) the step lives on; the runner takes the chair there. */
  path?: string;
  targets?: string[];
  focus?: boolean;
  badge: "required" | "recommended" | "info";
  title: string;
  text: string;
  note?: string;
  /** Sidebar group to open (the menu item the step points at lives inside it). */
  openGroup?: string;
  /** A page's menu step: where its "Open …" button leads. */
  open?: { label: string; path: string };
  /** The page this step belongs to: skipping the menu step skips the whole page. */
  group?: string;
  /** A recommended item this page covers (kept in the tour state when it is skipped / opened). */
  rec?: string;
  /** The label of the "skip" button (what skipping does is up to the runner). */
  skip?: string;
  primary?: TourAction;
  noCounter?: boolean;
  hideSkipTour?: boolean;
  /** A required field step waits for its field: the runner reads the page and says what is still needed. */
  gate?: string;
  gateHint?: string;
  recover?: { label: string; onClick: () => void };
}

const BADGES = {
  required: { label: "Required", bg: "var(--danger-soft)", color: "var(--danger-ink)" },
  recommended: { label: "Recommended", bg: "var(--primary-soft)", color: "var(--primary)" },
  info: { label: "Good to know", bg: "var(--muted)", color: "var(--ink-muted)" },
} as const;
// A small rotated square on the popover's edge facing the target, lined up with the target's middle.
const ARROW = 6;
function arrowStyle(pos: Placement, rect: Box, popH: number): React.CSSProperties | null {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const edge = "1px solid var(--border)";
  const x = Math.max(18, Math.min(cx - pos.left, pos.width - 18)) - ARROW;
  const y = Math.max(18, Math.min(cy - pos.top, popH - 18)) - ARROW;
  if (pos.side === "above") return { left: x, bottom: -ARROW, transform: "rotate(45deg)", borderRight: edge, borderBottom: edge };
  if (pos.side === "below") return { left: x, top: -ARROW, transform: "rotate(45deg)", borderLeft: edge, borderTop: edge };
  if (pos.side === "right") return { left: -ARROW, top: y, transform: "rotate(45deg)", borderLeft: edge, borderBottom: edge };
  if (pos.side === "left") return { right: -ARROW, top: y, transform: "rotate(45deg)", borderRight: edge, borderTop: edge };
  return null;
}
const MAX_RE_REVEALS = 4; // after layout shifts, bring the target back into view at most this many times

/** A step as the popover draws it: the runner has turned `skip` and `open` into actions. */
export type ViewStep = Omit<TourStep, "skip" | "open"> & { skip?: TourAction; /** For a gated step: whether its field is filled in. */ gateOk?: boolean };
interface StepProps { step: ViewStep; index: number; total: number; onBack: () => void; onNext: () => void; onSkipTour: () => void; onFinishLater: () => void;
  /** Fold the card away into the "Setup tour paused" bar (the chair needs the page underneath, e.g. a button the card covers); the tour carries on from this step. */
  onMinimize?: () => void }

function TourStepView({ step, index, total, onBack, onNext, onSkipTour, onFinishLater, onMinimize }: StepProps) {
  const keyed = Boolean(step.targets?.length);
  const [phase, setPhase] = useState<"finding" | "ready" | "lost">(keyed ? "finding" : "ready");
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false); // still looking after a moment: say so instead of showing nothing
  const [rect, setRect] = useState<Box | null>(null);
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  const [popH, setPopH] = useState(260);
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const popRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const insetsRef = useRef({ top: 0, bottom: 0 }); // the sticky-bar insets the follow-up scrolls use

  // On a small screen the sidebar is a drawer, and a group may be collapsed: ask the shell to open them.
  useEffect(() => {
    if (step.openGroup) window.dispatchEvent(new CustomEvent("conference-sidebar-open-group", { detail: step.openGroup }));
    if ((step.targets ?? []).some((k) => k.startsWith("nav-"))) {
      window.dispatchEvent(new Event("conference-sidebar-expand")); // desktop: the menu may have been hidden
      if (window.innerWidth < 1024) window.dispatchEvent(new Event("conference-sidebar-open"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.key]);

  // Find the target, scroll it into place, wait for things to settle, then keep it in place.
  useEffect(() => {
    if (!keyed) return undefined;
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const targets = step.targets ?? [];
    void (async () => {
      let els: HTMLElement[] | null = await waitForTargets(targets, { signal, onMissing: () => window.dispatchEvent(new CustomEvent("setup-tour-reveal", { detail: targets })) });
      if (signal.aborted) return;
      if (!els) { setRect(null); setPhase("lost"); return; }
      let ins: { top: number; bottom: number } | null = null;
      for (let i = 0; i < 3; i++) { // the layout can still move after a scroll (images, auto-sized fields): re-check
        ins = await revealTarget(els[0], { signal });
        if (!ins) return;
        els = findTargets(targets);
        if (!els.length || (isComfortablyVisible(unionRect(els), ins) && !isClipped(els[0]))) break;
      }
      if (signal.aborted || !ins) return;
      if (!els.length) { setRect(null); setPhase("lost"); return; }
      setInsets(ins);
      setRect(unionRect(els));
      setPhase("ready");
      if (step.focus) focusField(els[0]);

      // Follow the target: scroll, resize and layout changes only move the popover; a layout shift that pushes the target out of view brings it back (a
      // couple of times at most, so it cannot fight the user).
      let frame = 0;
      let reveals = 0;
      const update = () => {
        frame = 0;
        const now = findTargets(targets);
        if (!now.length) { setRect(null); setPhase("lost"); return; }
        const box = unionRect(now);
        setRect((prev) => (prev && prev.left === box.left && prev.top === box.top && prev.width === box.width && prev.height === box.height ? prev : box));
        setView((prev) => (prev.w === window.innerWidth && prev.h === window.innerHeight ? prev : { w: window.innerWidth, h: window.innerHeight }));
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
      const onLayout = async () => {
        schedule();
        const now = findTargets(targets);
        if (!now.length || reveals >= MAX_RE_REVEALS || (isComfortablyVisible(unionRect(now), insetsRef.current) && !isClipped(now[0]))) return;
        reveals += 1;
        const next = await revealTarget(now[0], { signal });
        if (next) { insetsRef.current = next; setInsets(next); schedule(); }
      };
      insetsRef.current = ins;
      // The menu can still be settling (a group opening, the setup lock loading) without any scroll or resize: look again a few times a second so the spotlight never stays on the old spot.
      const poll = window.setInterval(() => { void onLayout(); }, 250);
      window.addEventListener("scroll", schedule, { capture: true, passive: true });
      window.addEventListener("resize", onLayout);
      const observer = new ResizeObserver(() => { void onLayout(); });
      observer.observe(document.body);
      signal.addEventListener("abort", () => {
        window.removeEventListener("scroll", schedule, { capture: true });
        window.removeEventListener("resize", onLayout);
        observer.disconnect();
        window.clearInterval(poll);
        cancelAnimationFrame(frame);
      }, { once: true });
    })();
    return () => ctrl.abort();
    // Re-runs per step (or Try again), not on every parent render, which hands over a fresh `step` object each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.key, keyed, attempt]);

  useEffect(() => {
    if (phase !== "finding") return undefined;
    const timer = setTimeout(() => setSlow(true), 900);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [phase, attempt]);

  // Keep the popover's real height (it changes with the text) for placement.
  useEffect(() => {
    const el = popRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => { const h = el.offsetHeight; if (h) setPopH((prev) => (prev === h ? prev : h)); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [phase]);

  // Focus lands on the popover's main button, except on a field step, where the cursor is already in the field.
  useEffect(() => {
    if (phase !== "finding" && !(phase === "ready" && step.focus)) primaryRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape") { onFinishLater(); return; }
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === "ArrowRight" && !(step.primary?.disabled && phase !== "lost")) onNext();
      else if (e.key === "ArrowLeft" && index > 0) onBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onFinishLater, index, step.primary?.disabled, phase]);

  if (phase === "finding") {
    return (
      <>
        <div className="sr-only" aria-live="polite">{`Step ${index + 1} of ${total}: ${step.title}`}</div>
        {slow && <div role="status" style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="fixed bottom-6 left-1/2 z-[61] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold shadow-lg">Finding “{step.title}” on the page…</div>}
      </>
    );
  }

  const lost = phase === "lost";
  const prefer = (step.targets ?? []).some((k) => k.startsWith("nav-")) ? "side" : "vertical";
  const pos = placePopover(lost ? null : rect, view.w, view.h, popH, { prefer, inset: insets.top });
  const arrow = !lost && rect ? arrowStyle(pos, rect, popH) : null;
  const badge = BADGES[step.badge] ?? BADGES.info;
  const last = index === total - 1;
  const primary: TourAction = step.primary ?? { label: last ? "Finish" : "Next", onClick: onNext };
  const blocked = Boolean(primary.disabled) && !lost;
  const skip = step.skip;
  const titleId = `tour-title-${step.key}`;
  const textId = `tour-text-${step.key}`;
  return (
    <>
      {/* Visual only (pointer-events: none): the page underneath stays usable. */}
      <div aria-hidden="true" data-tour-overlay="" className="pointer-events-none fixed inset-0 z-[60]" style={!lost && rect ? undefined : { background: "rgba(15,23,42,0.40)" }}>
        {!lost && rect && (
          <div data-tour-spotlight="" style={{ position: "absolute", left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, borderRadius: 12, boxShadow: "0 0 0 9999px rgba(15,23,42,0.40)", outline: "2px solid var(--primary)", transition: "left .15s, top .15s, width .15s, height .15s" }} />
        )}
      </div>
      {/* The outer box carries the position (and the arrow, which sticks out past the edge); the inner one scrolls. */}
      <div ref={popRef} role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={textId} data-tour-popover="" data-side={pos.side} data-phase={phase} style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width }} className="z-[61]">
        {arrow && <span aria-hidden="true" data-tour-arrow="" style={arrow} className="absolute h-3 w-3 bg-white" />}
        <div style={{ border: "1px solid var(--border)", boxShadow: "0 20px 40px -12px rgba(15,23,42,0.35)" }} className="relative max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl bg-white p-4">
          <div className="flex items-center gap-2">
            {!step.noCounter && <span className="text-[11px] font-bold tabular-nums text-ink-faint">Step {index + 1} of {total}</span>}
            <span style={{ background: badge.bg, color: badge.color }} className="rounded-full px-2 py-0.5 text-[10.5px] font-bold">{badge.label}</span>
            {onMinimize && <button type="button" onClick={onMinimize} aria-label="Minimise — keep the tour for later" title="Minimise: the page is free to use, the tour waits in the bar" className="ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-ink-faint hover:bg-canvas"><Minus size={14} aria-hidden="true" /></button>}
            <button type="button" onClick={onFinishLater} aria-label="Close — finish later" title="Close — finish later" className={`${onMinimize ? "" : "ml-auto "}flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-ink-faint hover:bg-canvas`}><X size={14} aria-hidden="true" /></button>
          </div>
          <h4 id={titleId} className="mt-2 text-[15px] font-bold text-navy">{step.title}</h4>
          <p id={textId} className="mt-1 text-[13px] leading-relaxed text-ink-soft">{step.text}</p>
          {step.note && <p className="mt-2 text-xs text-ink-muted">{step.note}</p>}
          {step.gateHint && !lost && (blocked
            ? <p style={{ color: "var(--warning-ink)" }} className="mt-2 flex items-start gap-1.5 text-xs font-semibold"><Lock size={12} aria-hidden="true" className="mt-0.5 shrink-0" /> {step.gateHint}</p>
            : <p style={{ color: "var(--success-ink)" }} className="mt-2 text-xs font-semibold">Looks good — you can continue.</p>)}
          {lost && (
            <div role="alert" style={{ background: "var(--warning-soft)", color: "var(--warning-ink)" }} className="mt-2 rounded-lg px-2.5 py-2 text-xs">
              <div className="font-semibold">We couldn&apos;t find this on the page.</div>
              <div className="mt-1.5 flex items-center gap-3">
                <button type="button" onClick={() => { setRect(null); setPhase("finding"); setAttempt((a) => a + 1); }} className="cursor-pointer font-bold underline">Try again</button>
                {step.recover && <button type="button" onClick={step.recover.onClick} className="cursor-pointer font-bold underline">{step.recover.label}</button>}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {index > 0 && <button type="button" onClick={onBack} className="cursor-pointer text-xs font-semibold text-ink-muted hover:underline">Back</button>}
            {!step.hideSkipTour && <button type="button" onClick={onSkipTour} className="cursor-pointer text-xs font-semibold text-ink-muted hover:underline">Skip tour</button>}
            <span className="flex-1" />
            {skip && <button type="button" onClick={skip.onClick} className="h-8 cursor-pointer whitespace-nowrap rounded-lg border border-line px-3 text-xs font-bold text-ink-soft hover:bg-canvas">{skip.label}</button>}
            <button ref={primaryRef} type="button" onClick={primary.onClick} disabled={blocked} aria-disabled={blocked} title={blocked ? step.gateHint : undefined} style={{ background: "var(--primary)", opacity: blocked ? 0.45 : 1 }} className={`h-8 whitespace-nowrap rounded-lg px-3.5 text-xs font-bold text-white ${blocked ? "cursor-not-allowed" : "cursor-pointer"}`}>{primary.label}</button>
          </div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">{`Step ${index + 1} of ${total}: ${step.title}`}</div>
    </>
  );
}

// `key` restarts the search, scroll and focus for each step.
export function SpotlightTour({ step, ...rest }: Omit<StepProps, "step"> & { step: ViewStep | undefined }) {
  if (!step) return null;
  return <TourStepView key={step.key} step={step} {...rest} />;
}
