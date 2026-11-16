"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAccountExtrasService } from "@/services/account-extras";
import type { PaperCandidate } from "@/types/account";
import { CreatePreprintForm } from "./create-preprint-form";
import { CreateSlidesForm } from "./create-slides-form";
import { PageLoading, PageProblem } from "./page-states";

/* New Preprint / New Slides: with ?paper=<id> the form starts from that paper of the person's (its authors, title, abstract and keywords); without it,
   from scratch. */

export function NewPublicationPage({ kind }: { kind: "preprint" | "slides" }) {
  const paperId = useSearchParams().get("paper");
  const title = kind === "preprint" ? "New Preprint" : "New Slides";
  const crumbs = [{ label: kind === "preprint" ? "My Preprints" : "My Slides", href: kind === "preprint" ? "/preprints" : "/slides" }, { label: title }];
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; prefill: PaperCandidate | null }>(paperId ? { status: "loading" } : { status: "ready", prefill: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!paperId) return undefined;
    let alive = true;
    getAccountExtrasService().then((svc) => svc.myPapers()).then(
      (papers) => { if (alive) setState({ status: "ready", prefill: papers.find((p) => p.id === paperId) ?? null }); },
      (e: unknown) => { if (alive) setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." }); },
    );
    return () => { alive = false; };
  }, [paperId, tick]);

  if (state.status === "loading") return <PageLoading title={title} label="Loading your paper" breadcrumbs={crumbs} />;
  if (state.status === "error") return <PageProblem title={title} heading="Couldn't load your paper." message={state.message} onRetry={() => { setState({ status: "loading" }); setTick((t) => t + 1); }} breadcrumbs={crumbs} />;
  return kind === "preprint" ? <CreatePreprintForm key={paperId ?? "new"} prefill={state.prefill} /> : <CreateSlidesForm key={paperId ?? "new"} prefill={state.prefill} />;
}
