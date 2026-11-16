"use client";

import { useCallback, useEffect, useState } from "react";
import { getChairService } from "@/services/chair";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import type { ChairPaperDetail } from "@/types/chair";
import type { Conference, ConferenceRole } from "@/types/conference";

export type ChairPaperState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[]; detail: ChairPaperDetail }
  /** There is no such paper, or the account is not a chair of its conference. */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads one paper (by its label) with its reviewers and reviews, and the conference frame around it. `reload` reads it again after a
 *  change without clearing the page. */
export function useChairPaper(label: string) {
  const [state, setState] = useState<ChairPaperState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getChairService()])
      .then(async ([conferences, chair]): Promise<ChairPaperState> => {
        const detail = await chair.loadPaper(label);
        if (!detail) return { status: "missing" };
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === detail.paper.conferenceId && c.roles.includes("chair"));
        if (!mine) return { status: "missing" };
        return { status: "ready", conference: mine.conference, roles: mine.roles, others: source.conferences.filter((c) => c.conference.id !== mine.conference.id && c.roles.includes("chair")).map((c) => c.conference), detail };
      })
      .then((next) => { if (!cancelled) setState(next); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [label, tick]);

  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, retry, reload };
}
