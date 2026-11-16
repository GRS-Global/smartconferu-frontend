"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChairConference } from "@/features/chair/use-chair-conference";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { getFlyerService } from "@/services/flyers";
import { AuthRequiredError } from "@/services/errors";
import { defaultFlyerDesign, type FlyerDesign, type SavedFlyer } from "../data";
import { FlyerDesignerBody, type FlyerPaper } from "./flyer-designer-body";

/* Chair › Speaker Flyer (the prototype's FlyerDesignerPage): the chair designs one template for the conference and every presenter who meets
   the rule gets their own copy. The template is one row of the database (migration 0048). Which papers are presenters comes from the
   conference's papers: "registered" is a paper whose registration the chair has confirmed, "accepted" one that is accepted but not registered. */

const messageOf = (e: unknown) => (e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");

export function FlyerPage({ slug }: { slug: string }) {
  const { state, retry } = useChairConference(slug, { info: true });
  const ready = state.status === "ready" ? state : null;
  const dbId = ready?.data.dbId ?? null;
  const [saved, setSaved] = useState<SavedFlyer | null | undefined>(undefined); // undefined while it loads
  const [loadError, setLoadError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!dbId) return undefined;
    let cancelled = false;
    getFlyerService()
      .then((s) => s.load(dbId))
      .then((f) => { if (!cancelled) setSaved(f ?? { design: defaultFlyerDesign(), published: false, downloads: 0 }); })
      .catch((e: unknown) => { if (!cancelled) setLoadError(messageOf(e)); });
    return () => { cancelled = true; };
  }, [dbId, tick]);

  const papers = useMemo<FlyerPaper[]>(() => (ready?.data.papers ?? []).filter((p) => !p.withdrawn).map((p) => ({
    sub: { id: p.id, title: p.title, authors: p.authors },
    result: p.outcome === "registered" ? "registered" : p.outcome === "accept" ? "not_registered" : "other",
    schedule: null,
  })), [ready]);

  const save = useCallback(async (design: FlyerDesign, published: boolean): Promise<string | null> => {
    if (!dbId) return "The conference isn't loaded yet.";
    try {
      setSaved(await (await getFlyerService()).save(dbId, design, published));
      return null;
    } catch (e) { return messageOf(e); }
  }, [dbId]);

  const gate = workspaceGate(
    state.status === "ready" && saved === undefined ? (loadError ? { status: "error", message: loadError, config: false } : { status: "loading" }) : state,
    () => { setLoadError(""); setSaved(undefined); setTick((t) => t + 1); retry(); },
    { title: "Speaker flyer", loadingLabel: "Loading the speaker flyer", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the speaker flyer." },
  );
  if (gate || !ready || !saved) return gate;
  const { conference, roles, others, data, info } = ready;

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="flyer" screening={data.screening}>
      {/* A new key restarts the editor from what is saved, as the prototype does when the conference changes. */}
      <FlyerDesignerBody key={conference.id} conference={conference} webPage={info?.webPage ?? ""} papers={papers} saved={saved} onSave={save} />
    </ConferenceShell>
  );
}
