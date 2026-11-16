"use client";

import { useCallback, useEffect, useState } from "react";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import { getReviewerService } from "@/services/reviewer";
import type { Conference, ConferenceRole } from "@/types/conference";
import type { ReviewDetail, ReviewerPaper } from "@/types/reviewer";

export type ReviewDetailState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[]; detail: ReviewDetail; queue: ReviewerPaper[] }
  /** There is no such paper assigned to this reviewer (it does not exist, or it is not theirs). */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads one assigned paper with the reviewer's saved answers, and the conference frame around it. `queue` is the reviewer's papers in
 *  the order the dashboard lists them to answer (waiting first, then accepted) so the page can step through them. */
export function useReviewDetail(slug: string, label: string) {
  const [state, setState] = useState<ReviewDetailState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getReviewerService()])
      .then(async ([conferences, reviewer]): Promise<ReviewDetailState> => {
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === slug && c.roles.includes("reviewer"));
        if (!mine) return { status: "missing" };
        const detail = await reviewer.loadReview(slug, label);
        if (!detail) return { status: "missing" };
        const { papers } = await reviewer.listAssignments(slug);
        const queue = [...papers.filter((p) => p.response === "pending"), ...papers.filter((p) => p.response === "accepted")];
        return { status: "ready", conference: mine.conference, roles: mine.roles, others: source.conferences.filter((c) => c.conference.id !== slug && c.roles.includes("reviewer")).map((c) => c.conference), detail, queue };
      })
      .then((next) => { if (!cancelled) setState(next); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [slug, label, tick]);

  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, retry, reload };
}
