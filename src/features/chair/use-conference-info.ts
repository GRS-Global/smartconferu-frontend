"use client";

import { useCallback, useEffect, useState } from "react";
import { getChairService } from "@/services/chair";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import type { ConferenceInfo, ConferenceSettings } from "@/types/chair";
import type { Conference, ConferenceRole } from "@/types/conference";
import type { Screening } from "./stage";

export type ConferenceInfoState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[]; screening: Screening; info: ConferenceInfo; settings: ConferenceSettings }
  /** The conference does not exist, or the account is not a chair of it. */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads the conference frame and the details a chair edits in Conference Settings › Conference Details. */
export function useConferenceInfo(slug: string) {
  const [state, setState] = useState<ConferenceInfoState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getChairService()])
      .then(async ([conferences, chair]): Promise<ConferenceInfoState> => {
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === slug && c.roles.includes("chair"));
        if (!mine) return { status: "missing" };
        const [data, info, settings] = await Promise.all([chair.loadConference(slug), chair.loadInfo(slug), chair.loadSettings(slug)]);
        if (!info) return { status: "missing" };
        return { status: "ready", conference: mine.conference, roles: mine.roles, others: source.conferences.filter((c) => c.conference.id !== slug && c.roles.includes("chair")).map((c) => c.conference), screening: data.screening, info, settings };
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
