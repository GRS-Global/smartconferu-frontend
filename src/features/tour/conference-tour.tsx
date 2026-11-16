"use client";

import { ArrowRight, Sparkles, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getChairService } from "@/services/chair";
import { SpotlightTour, type TourAction, type ViewStep } from "./spotlight-tour";
import { SetupGuideModal } from "./setup-guide-modal";
import { buildTourSteps, DETAIL_LABELS, gateOpen, missingDetails } from "./tour-steps";
import type { ConferenceSetup, SetupTask } from "./use-setup";
import { readTourState, writeTourState } from "./tour-state";

/* The chair's guided tour of Conference Settings (the prototype's SetupTourRunner + SetupTourPausedBar). "Take a tour" in the sidebar opens a short welcome,
   then a spotlight walks through the settings pages: the menu item first (with an "Open …" button), then the cards that matter on the page itself. Opening
   a page pauses the tour (a "Continue tour" pill stays at the bottom) so the chair can look around; Skip tour / Esc / × leave it and it can be taken again.
   Progress is kept in this browser. Nothing here marks a setup item done or publishes anything. */

const START_EVENT = "conference-tour-start";
/** Starts the tour from anywhere (the sidebar's "Take a tour" button). */
export const startConferenceTour = () => window.dispatchEvent(new Event(START_EVENT));

const SETUP_OPEN_EVENT = "conference-setup-open";
/** Opens the setup checklist from anywhere (the menu's "Finish setup" card). */
export const openSetupGuide = () => window.dispatchEvent(new Event(SETUP_OPEN_EVENT));

type Mode = "off" | "tour" | "paused" | "checklist" | "focus";

export function ConferenceTour({ slug, acronym, setup }: { slug: string; acronym: string; setup: ConferenceSetup & { reload: () => void } }) {
  const router = useRouter();
  const path = usePathname();
  const [mode, setModeState] = useState<Mode>("off");
  const [focusTask, setFocusTask] = useState<SetupTask | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const base = `/chair/${encodeURIComponent(slug)}`;
  const go = useCallback((to?: string) => { if (to) router.push(`${base}/${to}`); }, [router, base]);
  // Every page draws its own shell, so the running tour is kept for this tab (it follows the chair from one settings page to the next).
  const memo = `grs_tour_run_${slug}`;
  const setMode = useCallback((m: Mode, open: string[] = missing, task: SetupTask | null = null) => {
    setModeState(m);
    try { if (m === "off" || m === "checklist") window.sessionStorage.removeItem(memo); else window.sessionStorage.setItem(memo, JSON.stringify({ mode: m, missing: open, task })); } catch { /* storage off: the tour ends with the page */ }
  }, [memo, missing]);

  // A tour (or a "show me") running on the previous page carries on here.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(memo);
      if (raw) { const s = JSON.parse(raw) as { mode: Mode; missing: string[]; task: SetupTask | null }; if (s.mode !== "off") { setMissing(s.missing); setFocusTask(s.task); setModeState(s.mode); } } // eslint-disable-line react-hooks/set-state-in-effect
    } catch { /* unreadable: no tour running */ }
  }, [memo]);
  useEffect(() => {
    const start = () => {
      // What the field steps ask about is what is saved right now.
      void getChairService().then((c) => Promise.all([c.loadInfo(slug), c.loadSettings(slug)])).then(([i, s]) => missingDetails(i, s.tracks.length > 0 && !(s.tracks.length === 1 && s.tracks[0].name === "General Track"))).catch(() => [] as string[]).then((open) => { setMissing(open); setMode("tour", open); });
    };
    const checklist = () => setMode("checklist");
    window.addEventListener(START_EVENT, start);
    window.addEventListener(SETUP_OPEN_EVENT, checklist);
    return () => { window.removeEventListener(START_EVENT, start); window.removeEventListener(SETUP_OPEN_EVENT, checklist); };
  }, [slug, setMode]);

  if (mode === "off") return null;
  const exit = () => setMode("off");
  if (mode === "checklist") return <SetupGuideModal slug={slug} acronym={acronym} setup={setup} go={go} onClose={exit} onStartTour={startConferenceTour} onShow={(t) => { setFocusTask(t); setMode("focus", missing, t); go(t.at); }} />;
  if (mode === "focus" && focusTask) {
    // "Show me in Conference Details": the page the field lives on, that field highlighted, the cursor in it.
    const step: ViewStep = { key: `focus-${focusTask.key}`, path: focusTask.at, targets: [focusTask.tour], focus: focusTask.key !== "tracks", badge: "required", hideSkipTour: true, noCounter: true, title: focusTask.label, text: focusTask.why, note: focusTask.done ? "Saved — this item is complete." : "Fill it in here and save, then come back to your checklist.", primary: { label: "Back to checklist", onClick: () => setMode("checklist") }, recover: { label: "Open the page", onClick: () => go(focusTask.at) } };
    return <SpotlightTour step={step} index={0} total={1} onBack={() => setMode("checklist")} onNext={() => setMode("checklist")} onSkipTour={exit} onFinishLater={exit} />;
  }
  if (mode === "paused") return <PausedBar next={readTourState(slug).tourStep + 1} total={buildTourSteps(missing).length} onResume={() => setMode("tour")} onClose={() => { writeTourState(slug, { welcomed: true, finishLater: true }); exit(); }} />;
  return <Runner key={`${slug}-${mode}`} slug={slug} open={missing} here={path} go={go} onExit={exit} onPause={() => setMode("paused")} />;
}

function Runner({ slug, open, here, go, onExit, onPause }: { slug: string; open: string[]; here: string; go: (to?: string) => void; onExit: () => void; onPause: () => void }) {
  const steps = useMemo(() => buildTourSteps(open), [open]);
  const [index, setIndex] = useState(() => { const s = readTourState(slug); return s.tourDone ? 0 : Math.min(s.tourStep, steps.length - 1); });
  const step = steps[index];
  // A required field step waits for its field: the page is read as the chair types (saved or not) and the answer is checked again on every change.
  const [domOk, setUnlocked] = useState(true);
  // The "Update Conference" step waits until what was missing is really saved (read again from the database every moment).
  const initialMissing = useMemo(() => open.filter((k) => k !== "areas" && k !== "tracks"), [open]);
  const [saved, setSaved] = useState(false);
  const [recap, setRecap] = useState<string[] | null>(null);
  useEffect(() => {
    if (step?.gate !== "saved") return undefined;
    let off = false;
    const read = () => { void getChairService().then((c) => c.loadInfo(slug)).then((i) => { if (!off) setSaved(missingDetails(i, true).every((k) => !initialMissing.includes(k))); }).catch(() => undefined); };
    read();
    const t = setInterval(read, 1500);
    return () => { off = true; clearInterval(t); };
  }, [step?.gate, slug, initialMissing]);
  const unlocked = step?.gate === "saved" ? saved : domOk;
  useEffect(() => {
    const gate = step?.gate;
    if (!gate || gate === "saved") { setUnlocked(true); return undefined; } // eslint-disable-line react-hooks/set-state-in-effect
    const check = () => setUnlocked(gateOpen(gate));
    check();
    document.addEventListener("input", check, true); document.addEventListener("change", check, true); document.addEventListener("click", check, true);
    const timer = setInterval(check, 500);
    return () => { document.removeEventListener("input", check, true); document.removeEventListener("change", check, true); document.removeEventListener("click", check, true); clearInterval(timer); };
  }, [step?.gate, step?.key]);
  const base = `/chair/${encodeURIComponent(slug)}`;
  // A step that lives on a page takes the chair there if they are elsewhere.
  useEffect(() => { if (step?.path && `${base}/${step.path}` !== here) go(step.path); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!step) return null;
  const last = index === steps.length - 1;
  const goTo = (i: number) => { setIndex(i); writeTourState(slug, { tourStep: i }); };
  // The end of the tour: if required details are still open, say which instead of just closing.
  const finish = () => {
    writeTourState(slug, { welcomed: true, tourDone: true, tourStep: 0 });
    void getChairService().then((c) => Promise.all([c.loadInfo(slug), c.loadSettings(slug)])).then(([i, s]) => {
      const open = missingDetails(i, s.tracks.length > 0 && !(s.tracks.length === 1 && s.tracks[0].name === "General Track"));
      if (open.length) setRecap(open); else onExit();
    }).catch(onExit);
  };
  const next = () => (last ? finish() : goTo(index + 1));
  const primary: TourAction = step.open
    ? {
      label: step.open.label,
      onClick: () => {
        if (step.rec) writeTourState(slug, { reviewed: { [step.rec]: true } });
        const open = step.open!;
        go(open.path);
        // The chair came here to look at that page, so do not whisk them on to the next step: pause the tour (a "Continue tour" pill stays), unless the
        // next step is a card on this very page, which just carries on.
        const upcoming = steps[index + 1];
        if (upcoming && !upcoming.path) { writeTourState(slug, { welcomed: true, tourStep: index + 1 }); onPause(); } else next();
      },
    }
    : { label: last ? "Finish" : "Next", onClick: next, disabled: Boolean(step.gate) && !unlocked };
  const skip: TourAction | undefined = step.skip
    ? {
      label: step.skip,
      onClick: () => {
        if (step.rec) writeTourState(slug, { skipped: { [step.rec]: true } });
        // Skipping a page's menu step (or "Skip this section") also skips that page's own steps.
        if (step.group) { const after = steps.findIndex((s, i) => i > index && s.group !== step.group); if (after === -1) finish(); else goTo(after); } else next();
      },
    }
    // A required step cannot be waved through, but the chair is not trapped either: move on and the next steps carry on.
    : step.gate && !unlocked ? { label: "I'll do this later", onClick: () => goTo(index + 1) } : undefined;
  if (recap) {
    const recapStep: ViewStep = {
      key: "recap", badge: "required", noCounter: true, hideSkipTour: true, title: "Almost there",
      text: `${recap.length} required item${recap.length === 1 ? " is" : "s are"} still open: ${recap.map((k) => DETAIL_LABELS[k] ?? k).join(", ")}.`,
      note: "The menu unlocks once they're done. Pick them up from the setup checklist whenever you like.",
      primary: { label: "Open checklist", onClick: () => { onExit(); openSetupGuide(); } },
      skip: { label: "Close", onClick: onExit },
    };
    return <SpotlightTour step={recapStep} index={0} total={1} onBack={onExit} onNext={() => { onExit(); openSetupGuide(); }} onSkipTour={onExit} onFinishLater={onExit} />;
  }
  const { open: _open, skip: _skip, ...rest } = step;
  void _open; void _skip;
  const view: ViewStep = { ...rest, primary, skip, gateOk: step.gate ? unlocked : undefined, recover: step.path ? { label: "Open the page", onClick: () => go(step.path) } : undefined };
  return (
    <SpotlightTour step={view} index={index} total={steps.length} onBack={() => goTo(Math.max(0, index - 1))} onNext={next}
      onSkipTour={() => { writeTourState(slug, { welcomed: true, dismissed: true, tourStep: index }); onExit(); }}
      onFinishLater={() => { writeTourState(slug, { welcomed: true, finishLater: true, tourStep: index }); onExit(); }} />
  );
}

/** While the chair looks at a page the tour opened, the tour waits in this bar (the prototype's SetupTourPausedBar): full width under the top nav, sticky, one click carries on. */
function PausedBar({ next, total, onResume, onClose }: { next: number; total: number; onResume: () => void; onClose: () => void }) {
  return (
    <div role="status" data-setup-tour-paused="" style={{ background: "linear-gradient(90deg, var(--primary), #8B5CF6)", boxShadow: "0 6px 16px -8px rgba(124, 58, 237, 0.7)" }} className="fixed inset-x-0 top-16 z-20 flex flex-wrap items-center gap-3 px-4 py-2.5 text-white sm:px-6 lg:left-72">
      <Sparkles size={16} aria-hidden="true" className="shrink-0" />
      <span className="min-w-[12rem] flex-1 text-[13.5px] font-semibold">Setup tour paused <span className="font-medium opacity-90">— pick up where you left off{next <= total ? ` (step ${next} of ${total})` : ""}</span></span>
      <button type="button" onClick={onResume} className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-white px-4 text-[13px] font-extrabold text-primary shadow-sm transition-colors hover:bg-primary-soft">Continue tour <ArrowRight size={14} aria-hidden="true" /></button>
      <button type="button" onClick={onClose} aria-label="Close — finish later" title="Close — finish later" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/90 hover:bg-white/15"><X size={15} aria-hidden="true" /></button>
    </div>
  );
}
