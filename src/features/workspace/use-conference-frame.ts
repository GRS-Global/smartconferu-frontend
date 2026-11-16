"use client";

import { useCallback, useEffect, useState } from "react";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import type { Conference, ConferenceRole } from "@/types/conference";

export type ConferenceFrameState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[] }
  /** The conference does not exist, or the account holds no such role in it. */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** The conference around a workspace page, for one role: its details and "archived" state, every role the account holds in it
 *  and the account's other conferences in that role (for "Switch conference"). The same read that builds My Conferences, so the
 *  name, dates and status read the same on both screens. */
export function useConferenceFrame(slug: string, role: ConferenceRole) {
  const [state, setState] = useState<ConferenceFrameState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getConferenceService()
      .then((s) => s.loadDashboard())
      .then(({ source }): ConferenceFrameState => {
        const mine = source.conferences.find((c) => c.conference.id === slug && c.roles.includes(role));
        if (!mine) return { status: "missing" };
        return { status: "ready", conference: mine.conference, roles: mine.roles, others: source.conferences.filter((c) => c.conference.id !== slug && c.roles.includes(role)).map((c) => c.conference) };
      })
      .then((next) => { if (!cancelled) setState(next); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [slug, role, tick]);

  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  return { state, retry };
}
