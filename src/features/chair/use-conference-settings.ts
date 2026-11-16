"use client";

import { useCallback, useEffect, useState } from "react";
import { getChairService } from "@/services/chair";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import type { ChairConference, ConferenceInfo, ConferenceSettings, ReviewSetup } from "@/types/chair";
import type { SubmissionExtra } from "@/types/author-submission";
import type { Conference, ConferenceRole } from "@/types/conference";

export type ConferenceSettingsState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[]; data: ChairConference; settings: ConferenceSettings; setup: ReviewSetup; extras: SubmissionExtra[]; info: ConferenceInfo | null }
  /** The conference does not exist, or the account is not a chair of it. */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads the conference frame (with its screening switches and limits) and the settings the Conference Settings pages edit. `reload` reads them again after a save. */
export function useConferenceSettings(slug: string) {
  const [state, setState] = useState<ConferenceSettingsState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getChairService()])
      .then(async ([conferences, chair]): Promise<ConferenceSettingsState> => {
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === slug && c.roles.includes("chair"));
        if (!mine) return { status: "missing" };
        const [data, settings, setup, extras, info] = await Promise.all([chair.loadConference(slug), chair.loadSettings(slug), chair.loadReviewSetup(slug), chair.loadSubmissionForm(slug), chair.loadInfo(slug)]);
        return { status: "ready", conference: mine.conference, roles: mine.roles, others: source.conferences.filter((c) => c.conference.id !== slug && c.roles.includes("chair")).map((c) => c.conference), data, settings, setup, extras, info };
      })
      .then((next) => { if (!cancelled) setState(next); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [slug, tick]);
  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { state, retry, reload };
}
