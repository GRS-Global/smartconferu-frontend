"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { getConferenceService } from "@/services/conferences";
import { AuthRequiredError, ServiceConfigError } from "@/services/errors";
import { getProfileService } from "@/services/profile";
import type { AuthorSubmission, ConferenceDetails } from "@/types/author-submission";
import type { Conference, ConferenceRole } from "@/types/conference";

export type AuthorWorkspaceState =
  | { status: "loading" }
  | { status: "ready"; conference: Conference; roles: ConferenceRole[]; others: Conference[]; submissions: AuthorSubmission[];
      /** Only loaded for the Overview (`overview: true`). */
      details: ConferenceDetails | null; hasPhoto: boolean }
  /** The conference does not exist, or the account holds no author role in it. */
  | { status: "missing" }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** Loads the conference (with the account's roles in it) and the account's own papers there. The conference comes from the
 *  same read that builds My Conferences, so its name, dates and "archived" state read the same on both screens. */
export function useAuthorSubmissions(slug: string, { overview = false }: { overview?: boolean } = {}) {
  const [state, setState] = useState<AuthorWorkspaceState>({ status: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConferenceService(), getAuthorSubmissionService()])
      .then(async ([conferences, papers]) => {
        const { source } = await conferences.loadDashboard();
        const mine = source.conferences.find((c) => c.conference.id === slug && c.roles.includes("author"));
        if (!mine) return { status: "missing" } as const;
        const submissions = await papers.listForConference(slug);
        // The Overview also shows the conference's place / website and whether the account has a photo (for the flyer to-do).
        const details = overview ? await papers.conferenceDetails(slug) : null;
        // Without the profile the "add your photo" prompt would be a guess, so it is left out.
        const hasPhoto = overview ? await getProfileService().then((p) => p.load()).then((p) => Boolean(p.photoUrl || p.photo), () => true) : true;
        return {
          status: "ready", conference: mine.conference, roles: mine.roles,
          others: source.conferences.filter((c) => c.conference.id !== slug && c.roles.includes("author")).map((c) => c.conference),
          submissions, details, hasPhoto,
        } as const;
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
  return { state, retry };
}
