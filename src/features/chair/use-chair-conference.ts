"use client";

import { useCallback, useEffect, useState } from "react";
import { getChairService } from "@/services/chair";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import type { ChairConference, ChairEmailLog, ConferenceInfo, ConferenceSettings, ReviewBoard, ReviewerPool, ReviewSetup, ScreeningFile } from "@/types/chair";
import type { ConferenceDetails } from "@/types/author-submission";
import type { Conference, ConferenceRole } from "@/types/conference";

export type ChairConferenceState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[]; data: ChairConference; board: ReviewBoard | null; pool: ReviewerPool | null; details: ConferenceDetails | null; files: Record<string, ScreeningFile[]> | null; setup: ReviewSetup | null; info: ConferenceInfo | null; settings: ConferenceSettings | null; logs: ChairEmailLog[] | null }
  /** The conference does not exist, or the account is not a chair of it. */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads the conference (with the account's roles in it) and what its chair works with: the submitted papers, the decision types and
 *  the screening steps (and, with `withBoard`, every paper's reviewers). The conference comes from the same read that builds My
 *  Conferences, so its name, dates and "archived" state read the same on both screens. `reload` reads it again after a change
 *  without clearing the page. */
export function useChairConference(slug: string, { board: withBoard = false, pool: withPool = false, details: withDetails = false, files: withFiles = false, setup: withSetup = false, info: withInfo = false, settings: withSettings = false, logs: withLogs = false }: { board?: boolean; pool?: boolean; details?: boolean; files?: boolean; setup?: boolean; info?: boolean; settings?: boolean; logs?: boolean } = {}) {
  const [state, setState] = useState<ChairConferenceState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getChairService()])
      .then(async ([conferences, chair]): Promise<ChairConferenceState> => {
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === slug && c.roles.includes("chair"));
        if (!mine) return { status: "missing" };
        const [data, board, pool, details, files, setup, info, settings, logs] = await Promise.all([chair.loadConference(slug), withBoard ? chair.loadReviewBoard(slug) : Promise.resolve(null), withPool ? chair.loadReviewerPool(slug) : Promise.resolve(null), withDetails ? getAuthorSubmissionService().then((a) => a.conferenceDetails(slug)) : Promise.resolve(null), withFiles ? chair.loadScreeningFiles(slug) : Promise.resolve(null), withSetup ? chair.loadReviewSetup(slug) : Promise.resolve(null), withInfo ? chair.loadInfo(slug) : Promise.resolve(null), withSettings ? chair.loadSettings(slug) : Promise.resolve(null), withLogs ? chair.loadEmailLogs(slug) : Promise.resolve(null)]);
        return { status: "ready", conference: mine.conference, roles: mine.roles, others: source.conferences.filter((c) => c.conference.id !== slug && c.roles.includes("chair")).map((c) => c.conference), data, board, pool, details, files, setup, info, settings, logs };
      })
      .then((next) => { if (!cancelled) setState(next); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [slug, tick, withBoard, withPool, withDetails, withFiles, withSetup, withInfo, withSettings, withLogs]);

  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, retry, reload };
}
