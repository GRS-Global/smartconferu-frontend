"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState as StateMessage } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { useConferenceFrame } from "@/features/workspace/use-conference-frame";
import { getCertificateService, type MyCertificate } from "@/services/certificates";
import { AuthRequiredError } from "@/services/errors";
import { TriangleAlert } from "lucide-react";
import { MyCertificatesBody } from "./my-certificates-body";

/* The certificates issued to the signed-in person: the account-wide My Certificates page, and the Certificates item of the author's and the
   reviewer's conference menu (the prototype's MyCertificatesPage, in and out of a conference). The database matches a certificate to a person
   by the email address it was issued to (migration 0047). */

type Mine = { status: "loading" } | { status: "ready"; certs: MyCertificate[] } | { status: "error"; message: string };

function useMyCertificates() {
  const [state, setState] = useState<Mine>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getCertificateService()
      .then((s) => s.mine())
      .then((certs) => { if (!cancelled) setState({ status: "ready", certs }); })
      .catch((e: unknown) => { if (!cancelled) setState({ status: "error", message: e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong." }); });
    return () => { cancelled = true; };
  }, [tick]);
  const retry = useCallback(() => { setState({ status: "loading" }); setTick((t) => t + 1); }, []);
  return { state, retry };
}

function Loading() {
  return <div role="status" aria-label="Loading your certificates" className="p-4 sm:p-8"><div className="h-64 animate-pulse rounded-2xl border border-line bg-white" /></div>;
}
function Failed({ message, retry }: { message: string; retry: () => void }) {
  return <div className="p-8"><div className="rounded-2xl border border-line bg-white"><StateMessage icon={TriangleAlert} title="Couldn't load your certificates." description={message} action={<Button size="sm" onClick={retry}>Try again</Button>} /></div></div>;
}

/** /my-certificates: everything the person has earned across conferences. */
export function MyCertificatesPage() {
  const { state, retry } = useMyCertificates();
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <Failed message={state.message} retry={retry} />;
  return <MyCertificatesBody certs={state.certs} />;
}

/** The Certificates item of a conference menu, for one role: only that conference's certificates, and only the kind that role earns. */
export function ConferenceCertificatesPage({ slug, role }: { slug: string; role: "author" | "reviewer" }) {
  const frame = useConferenceFrame(slug, role);
  const { state, retry } = useMyCertificates();
  const gate = workspaceGate(frame.state.status === "ready" && state.status === "loading" ? { status: "loading" } : frame.state, frame.retry, {
    title: "Certificates", loadingLabel: "Loading your certificates", missingTitle: "We couldn't find that conference.",
    missingText: `It doesn't exist, or you hold no ${role} role in it. Pick one from My Conferences.`, errorTitle: "Couldn't load your certificates.",
  });
  if (gate || frame.state.status !== "ready") return gate;
  const { conference, roles, others } = frame.state;
  return (
    <ConferenceShell role={role} conference={conference} roles={roles} others={others} active="certificates">
      <PageHeader title="Certificates" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      {state.status === "error" ? <Failed message={state.message} retry={retry} /> : state.status === "ready" ? <MyCertificatesBody certs={state.certs} scope={conference} role={role} /> : null}
    </ConferenceShell>
  );
}
