"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import { getReviewerService } from "@/services/reviewer";
import type { ConferenceDetails } from "@/types/author-submission";
import type { Conference, ConferenceRole } from "@/types/conference";
import type { ReviewerAssignments } from "@/types/reviewer";

export type ReviewerWorkspaceState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[]; assignments: ReviewerAssignments; details: ConferenceDetails | null }
  /** The conference does not exist, or the account is not a reviewer in it. */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads the conference (with the account's roles in it) and the papers assigned to the signed-in reviewer there. The conference
 *  comes from the same read that builds My Conferences, so its name, dates and "archived" state read the same on both screens.
 *  `reload` reads the papers again after a change without clearing the page. */
export function useReviewerWorkspace(slug: string, { overview = false }: { overview?: boolean } = {}) {
  const [state, setState] = useState<ReviewerWorkspaceState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getReviewerService()])
      .then(async ([conferences, reviewer]): Promise<ReviewerWorkspaceState> => {
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === slug && c.roles.includes("reviewer"));
        if (!mine) return { status: "missing" };
        const assignments = await reviewer.listAssignments(slug);
        const details = overview ? await (await getAuthorSubmissionService()).conferenceDetails(slug) : null;
        return { status: "ready", conference: mine.conference, roles: mine.roles, others: source.conferences.filter((c) => c.conference.id !== slug && c.roles.includes("reviewer")).map((c) => c.conference), assignments, details };
      })
      .then((next) => { if (!cancelled) setState(next); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [slug, tick, overview]);

  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, retry, reload };
}
