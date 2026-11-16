"use client";

import { useCallback, useEffect, useState } from "react";
import { getConferenceService, type DashboardData } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";

export type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads the dashboard data and exposes `reload` (kept data stays on screen while it refreshes). */
export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getConferenceService()
      .then((service) => service.loadDashboard())
      .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  return { state, reload, retry };
}

/** Answers a committee invitation through the configured service. */
export async function answerInvitation(id: string, accept: boolean, reason?: string): Promise<void> {
  const service = await getConferenceService();
  await service.respondToInvitation(id, accept, reason);
}
