"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthorSubmissions } from "@/features/author/use-author-submissions";
import { conferenceDest } from "@/features/author/links";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { openPrototypePage } from "@/lib/navigation";
import { getFlyerService } from "@/services/flyers";
import { getProfileService } from "@/services/profile";
import type { FlyerDesign } from "../data";
import { FlyerAuthorBody, type FlyerAuthor, type FlyerAuthorPaper } from "./flyer-author-body";

/* Author › My flyer (the prototype's FlyerPage): the speaker flyer the chair published, filled in for this author. It unlocks per paper once the
   chair's rule is met (registered, or simply accepted). Name, affiliation and photo come from the author's profile; the chair's template from the
   database (my_published_flyer, migration 0049). A conference with nothing published says so. */

const NO_AUTHOR: FlyerAuthor = { firstName: "", lastName: "", affiliation: "", photoUrl: null };

export function FlyerAuthorPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, retry } = useAuthorSubmissions(slug, { overview: true });
  const [design, setDesign] = useState<FlyerDesign | null | undefined>(undefined); // undefined while it loads
  const [author, setAuthor] = useState<FlyerAuthor | undefined>(undefined);
  const ready = state.status === "ready" ? state : null;

  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    getFlyerService().then((s) => s.loadPublished(slug)).then((d) => { if (alive) setDesign(d); }, () => { if (alive) setDesign(null); });
    // The profile fills in the name, affiliation and photo; without one (mock mode) the flyer says "Your name".
    getProfileService().then((s) => s.load()).then(
      (p) => { if (alive) setAuthor({ firstName: p.firstName, lastName: p.lastName, affiliation: p.affiliation, photoUrl: p.photoUrl || p.photo || null }); },
      () => { if (alive) setAuthor(NO_AUTHOR); },
    );
    return () => { alive = false; };
  }, [ready, slug]);

  const papers = useMemo<FlyerAuthorPaper[]>(() => (ready?.submissions ?? [])
    .filter((p) => !p.withdrawn && (p.result === "registered" || p.result === "not_registered"))
    .map((p) => ({ sub: { id: p.id, title: p.title, keywords: p.keywords ?? [] }, result: p.result as "registered" | "not_registered", schedule: null })), [ready]);

  const gate = workspaceGate(
    state.status === "ready" && (design === undefined || author === undefined) ? { status: "loading" } : state,
    retry,
    { title: "My speaker flyer", loadingLabel: "Loading your flyer", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you hold no author role in it. Pick one from My Conferences.", errorTitle: "Couldn't load your flyer." },
  );
  if (gate || !ready || design === undefined || author === undefined) return gate;
  const { conference, roles, others, details } = ready;
  const register = conferenceDest.registration(conference.id);

  return (
    <ConferenceShell role="author" conference={conference} roles={roles} others={others} active="flyer">
      <FlyerAuthorBody
        key={conference.id}
        conference={conference}
        webPage={details?.webPage ?? ""}
        design={design}
        papers={papers}
        author={author}
        hasOtherPapers={papers.some((p) => p.result === "not_registered")}
        onDownloaded={() => { void getFlyerService().then((s) => s.countDownload(slug)); }}
        onRegister={() => { if (register) openPrototypePage(register.href); }}
        onEditProfile={() => router.push("/profile")}
      />
    </ConferenceShell>
  );
}
