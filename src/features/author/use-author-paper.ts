"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import type { AuthorPaper } from "@/types/author-submission";
import type { Conference, ConferenceRole } from "@/types/conference";

export type AuthorPaperState =
  | { status: "loading" }
  | { status: "ready"; paper: AuthorPaper; conference: Conference; roles: ConferenceRole[]; others: Conference[] }
  /** There is no such paper of this user's (it does not exist, or they are not one of its authors). */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads one of the user's own papers by its label ("ISBM-680") and the conference frame around it (the same read that
 *  builds My Conferences, so the conference's name, dates and "archived" state read the same everywhere). */
export function useAuthorPaper(label: string) {
  const [state, setState] = useState<AuthorPaperState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getAuthorSubmissionService()])
      .then(async ([conferences, papers]) => {
        const paper = await papers.paperByLabel(label);
        if (!paper) return { status: "missing" } as const;
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === paper.conferenceId);
        if (!mine) return { status: "missing" } as const;
        return {
          status: "ready", paper, conference: mine.conference, roles: mine.roles,
          others: source.conferences.filter((c) => c.conference.id !== paper.conferenceId && c.roles.includes("author")).map((c) => c.conference),
        } as const;
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
  /** Reads the paper again after a change; what is on screen stays until the new data arrives. */
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, retry, reload };
}
