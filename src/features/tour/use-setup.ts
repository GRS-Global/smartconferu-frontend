"use client";

import { useCallback, useEffect, useState } from "react";
import { getChairService } from "@/services/chair";
import type { ConferenceInfo } from "@/types/chair";
import { missingDetails } from "./tour-steps";

/* What a chair has to set up before the Call for Papers can be published (the prototype's getConferenceSetup + CONFERENCE_SETUP_TASKS). Whether a task is
   done always comes from what is saved, never from the guide. Once the Call for Papers is published or closed there is nothing left to set up. */

export type SetupInput = "date" | "language" | "text" | "url" | "topics" | null;
export type SetupStatus = "not_started" | "in_progress" | "attention" | "completed";
export interface SetupTask {
  key: string; label: string; hint: string; why: string; minutes: number; input: SetupInput;
  /** The page (under /chair/<conference>) the task's field sits on, and the tour anchor to point at. */
  at: string; tour: string;
  done: boolean; status: SetupStatus; issue: string;
}
export interface ConferenceSetup { ready: boolean; tasks: SetupTask[]; done: number; total: number; left: number; published: boolean; minutesLeft: number; info: ConferenceInfo | null }

const DEFS: Array<Omit<SetupTask, "done" | "status" | "issue">> = [
  { key: "abstractDeadline", label: "Set the abstract deadline", hint: "When authors must send their abstract.", why: "Shown on your Call for Papers so authors know when abstracts are due.", minutes: 0.5, input: "date", at: "settings", tour: "cd-abstract-deadline" },
  { key: "submissionDeadline", label: "Set the submission deadline", hint: "The last day authors can submit a paper.", why: "The last day authors can submit; the Call for Papers and the emails use this date too.", minutes: 0.5, input: "date", at: "settings", tour: "cd-submission-deadline" },
  { key: "language", label: "Choose the language", hint: "The language papers are written and reviewed in.", why: "Tells authors and reviewers which language papers are written and reviewed in.", minutes: 0.5, input: "language", at: "settings", tour: "cd-language" },
  { key: "about", label: "Describe the conference", hint: "Scope and audience, shown on the Call for Papers.", why: "The scope and audience text readers see on your Call for Papers.", minutes: 2, input: "text", at: "settings", tour: "cd-about" },
  { key: "areas", label: "Choose research area and topics", hint: "The area, then at least 4 topics.", why: "Helps researchers see whether their work fits your conference.", minutes: 2, input: null, at: "settings", tour: "cd-topics" },
  { key: "tracks", label: "Tracks", hint: "Choose the tracks authors submit to.", why: "Authors pick one of these tracks when they submit.", minutes: 1, input: null, at: "settings/submissions", tour: "ss-tracks" },
  { key: "webPage", label: "Website", hint: "Where authors can read more.", why: "Linked from your Call for Papers so authors can read more.", minutes: 0.5, input: "url", at: "settings", tour: "cd-identity" },
];
// The tour and the missing-details list call the research area + topics task "areas" and "topics": here they are one task, as in the prototype.
const OPEN_KEYS: Record<string, string[]> = { areas: ["areas", "topics"] };

export const SETUP_EVENT = "conference-setup-change";
/** Tell the shell (the locked menu, the checklist) that something saved may have changed what is still to do. */
export const setupChanged = () => window.dispatchEvent(new Event(SETUP_EVENT));

export function useConferenceSetup(slug: string, enabled: boolean): ConferenceSetup & { reload: () => void } {
  const [state, setState] = useState<ConferenceSetup>({ ready: false, tasks: [], done: 0, total: DEFS.length, left: 0, published: false, minutesLeft: 0, info: null });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!enabled) return undefined;
    const on = () => reload();
    window.addEventListener(SETUP_EVENT, on);
    return () => window.removeEventListener(SETUP_EVENT, on);
  }, [enabled, reload]);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    void getChairService().then((c) => Promise.all([c.loadConference(slug), c.loadInfo(slug), c.loadSettings(slug)])).then(([data, info, settings]) => {
      if (cancelled) return;
      const hasTracks = settings.tracks.length > 0 && !(settings.tracks.length === 1 && settings.tracks[0].name === "General Track");
      const open = missingDetails(info, hasTracks);
      const clash = Boolean(info?.abstractDeadline && info.submissionDeadline && info.abstractDeadline > info.submissionDeadline);
      const tasks: SetupTask[] = DEFS.map((d) => {
        const done = !(OPEN_KEYS[d.key] ?? [d.key]).some((k) => open.includes(k));
        const attention = done && clash && (d.key === "abstractDeadline" || d.key === "submissionDeadline");
        const partial = !done && d.key === "areas" && Boolean(info && (info.primaryArea || info.secondaryArea || info.topics.length));
        return { ...d, done, status: attention ? "attention" : done ? "completed" : partial ? "in_progress" : "not_started", issue: attention ? "The abstract deadline is after the submission deadline." : "" };
      });
      const doneCount = tasks.filter((t) => t.done).length;
      const published = data.cfpStatus === "published" || data.cfpStatus === "closed";
      setState({ ready: true, tasks, done: doneCount, total: tasks.length, left: tasks.length - doneCount, published, minutesLeft: Math.max(1, Math.round(tasks.filter((t) => !t.done).reduce((n, t) => n + t.minutes, 0))), info });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [slug, enabled, tick]);
  return { ...state, reload };
}

/** Whether the menu is locked: required details are open and the Call for Papers is not out yet. */
export const setupLocked = (s: ConferenceSetup) => s.ready && !s.published && s.left > 0;
