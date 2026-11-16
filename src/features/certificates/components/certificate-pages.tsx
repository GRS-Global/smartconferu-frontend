"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { Notice } from "../components";
import { certificatePath, type Go } from "../routes";
import { useCertificates } from "../use-certificates";
import { DesignBody } from "./design-body";
import { DesignerBody } from "./designer-body";
import { DistributeBody } from "./distribute-body";
import { RecipientsBody } from "./recipients-body";

/* The four pages of Chair › Certificates (Design, the designer, Distribute, one send). Each one loads the conference's designs and sends
   (use-certificates.ts), checks the account is a chair of it, wraps the page in the conference menu and hands the prototype's page
   (the *-body files, carried over line by line) its data. */

const GATE = (title: string, loadingLabel: string) => ({
  title, loadingLabel, missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the certificates.",
});

type Certs = ReturnType<typeof useCertificates>;

/** One state for workspaceGate: the conference first, then the certificates. */
function gateState(c: Certs) {
  if (c.state.status !== "ready") return c.state;
  if (c.loaded === "loading") return { status: "loading" as const };
  if (c.loaded === "error") return { status: "error" as const, message: c.loadError, config: false };
  return c.state;
}

function Frame({ c, active, children }: { c: Certs; active: string; children: ReactNode }) {
  if (!c.ready) return null;
  const { conference, roles, others, data } = c.ready;
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active={active} screening={data.screening}>
      {c.error && (
        <div className="px-4 pt-4 sm:px-8">
          <Notice tone="danger" icon={AlertTriangle} action={<button type="button" onClick={c.clearError} style={{ border: "1px solid var(--danger-border)", color: "var(--danger)" }} className="shrink-0 cursor-pointer rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-bold">Dismiss</button>}>{c.error}</Notice>
        </div>
      )}
      {children}
    </ConferenceShell>
  );
}

function useGo(slug: string): Go {
  const router = useRouter();
  return useCallback<Go>((page, ctx) => router.push(certificatePath(slug, page, ctx)), [router, slug]);
}

export function CertificatesDesignPage({ slug }: { slug: string }) {
  const c = useCertificates(slug);
  const go = useGo(slug);
  const gate = workspaceGate(gateState(c), c.retry, GATE("Design", "Loading the certificates"));
  if (gate || !c.ready) return gate;
  return (
    <Frame c={c} active="certificates/design">
      <DesignBody conference={c.ready.conference} certificates={c.designs} distributions={c.distributions} actions={c.actions} go={go} />
    </Frame>
  );
}

export function CertificateDesignerPage({ slug, certId }: { slug: string; certId: string }) {
  const c = useCertificates(slug);
  const go = useGo(slug);
  const cert = c.designs.find((d) => d.id === certId);
  const state = gateState(c);
  const gate = workspaceGate(state.status === "ready" && !cert ? { status: "missing" } : state, c.retry, { ...GATE("Design", "Loading the designer"), missingTitle: "We couldn't find that certificate.", missingText: "It doesn't exist, or it was deleted. Go back to Design to pick another." });
  if (gate || !c.ready || !cert) return gate;
  return (
    <Frame c={c} active="certificates/design">
      <DesignerBody key={cert.id} conference={c.ready.conference} cert={cert} actions={c.actions} go={go} />
    </Frame>
  );
}

// `?cert=<design>` (the "Send this one" buttons) opens the new-send dialog with that design chosen; like the prototype's presetCertId it is only the starting state, so it is read once and removed from the address.
function PresetReader({ onPreset }: { onPreset: (id: string) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cert = params.get("cert");
  useEffect(() => {
    if (cert === null) return;
    if (cert) onPreset(cert);
    router.replace(pathname, { scroll: false });
    // onPreset is a fresh function each render; only a new ?cert= should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cert]);
  return null;
}

export function CertificatesDistributePage({ slug }: { slug: string }) {
  const c = useCertificates(slug);
  const go = useGo(slug);
  const [preset, setPreset] = useState<string | null>(null);
  const gate = workspaceGate(gateState(c), c.retry, GATE("Distribute", "Loading the certificates"));
  if (gate || !c.ready || !c.audience) return gate;
  return (
    <Frame c={c} active="certificates/distribute">
      <Suspense fallback={null}><PresetReader onPreset={setPreset} /></Suspense>
      {/* A new key remounts the page, so a design chosen with "Send this one" opens the dialog straight away. */}
      <DistributeBody key={preset ?? "none"} conference={c.ready.conference} certificates={c.designs} distributions={c.distributions} audience={c.audience} presetCertId={preset} actions={c.actions} go={go} />
    </Frame>
  );
}

export function CertificateRecipientsPage({ slug, distId }: { slug: string; distId: string }) {
  const c = useCertificates(slug);
  const go = useGo(slug);
  const dist = c.distributions.find((d) => d.id === distId);
  const state = gateState(c);
  const gate = workspaceGate(state.status === "ready" && !dist ? { status: "missing" } : state, c.retry, { ...GATE("Distribute", "Loading the send"), missingTitle: "We couldn't find that send.", missingText: "It doesn't exist, or it was deleted. Go back to Distribute to pick another." });
  if (gate || !c.ready || !c.audience || !dist) return gate;
  const cert = c.designs.find((d) => d.id === dist.certId);
  // Certificate IDs carry on from the ones already issued for this type of certificate, so two sends never share one.
  const serialBase = c.distributions.filter((d) => c.designs.find((x) => x.id === d.certId)?.typeKey === cert?.typeKey).reduce((n, d) => n + d.issued.length, 0);
  return (
    <Frame c={c} active="certificates/distribute">
      <RecipientsBody conference={c.ready.conference} dist={dist} cert={cert} audience={c.audience} serialBase={serialBase} actions={c.actions} go={go} />
    </Frame>
  );
}
