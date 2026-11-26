"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChairConference } from "@/features/chair/use-chair-conference";
import { designFromTemplate } from "./studio/templates";
import type { PaperSpec } from "./paper";
import { sendActionEmails } from "@/services/action-emails";
import { getCertificateService } from "@/services/certificates";
import { AuthRequiredError } from "@/services/errors";
import {
  defaultDistribution, reviewerRollup, type AudienceContext, type CertificateDesign, type CertTypeKey, type Design, type Distribution,
  type DistributionAudience, type DistributionEmail, type ManualPerson, type Orientation, type Recipient,
} from "./data";

/* Loads a conference's certificate designs and sends and keeps them in step with the database (services/certificates.ts). Changes show at
   once and are saved a moment later (the designer and the recipients page save as you type), so nothing waits on the network. */

const SAVE_DELAY = 700;

export interface DesignPatch { name?: string; design?: Design | ((d: Design) => Design) }
export interface DistributionPatch { audience?: DistributionAudience | ((a: DistributionAudience) => DistributionAudience); email?: DistributionEmail | ((e: DistributionEmail) => DistributionEmail); manual?: ManualPerson[]; overrides?: Distribution["overrides"] }

export interface CertificateActions {
  createDesign(input: { name: string; typeKey: CertTypeKey; templateKey: string; orientation?: Orientation; paper?: PaperSpec }): Promise<CertificateDesign | null>;
  updateDesign(id: string, patch: DesignPatch): void;
  deleteDesign(id: string): Promise<void>;
  duplicateDesign(id: string): Promise<void>;
  createDistribution(input: { certId: string; sourceKey: string; name: string }): Promise<Distribution | null>;
  updateDistribution(id: string, patch: DistributionPatch): void;
  deleteDistribution(id: string): Promise<void>;
  /** Issues the send and emails the certificates; resolves to a notice about the emails ("" when all went out), or null when issuing failed. */
  issue(distribution: Distribution, recipients: Recipient[]): Promise<string | null>;
  /** After sending (own backend and mock): withdraws an issued certificate, sends its email again, or replaces it with a corrected one. Each resolves to whether it worked. */
  revoke(serial: string, reason?: string): Promise<boolean>;
  resend(serial: string): Promise<boolean>;
  reissue(serial: string, changes: { name?: string; email?: string; affiliation?: string; roleLabel?: string; paperTitle?: string }): Promise<boolean>;
}

const messageOf = (e: unknown) => (e instanceof AuthRequiredError ? "Your session ended — please sign in again." : e instanceof Error ? e.message : "Something went wrong.");

export function useCertificates(slug: string) {
  const chair = useChairConference(slug, { board: true, info: true });
  const ready = chair.state.status === "ready" ? chair.state : null;
  const dbId = ready?.data.dbId ?? null;

  const [designs, setDesigns] = useState<CertificateDesign[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const designsRef = useRef(designs);
  const distsRef = useRef(distributions);
  useEffect(() => { designsRef.current = designs; distsRef.current = distributions; }, [designs, distributions]);
  const timers = useRef(new Map<string, { t: ReturnType<typeof setTimeout>; save: () => Promise<void> }>());

  useEffect(() => {
    if (!dbId) return undefined;
    let cancelled = false;
    getCertificateService()
      .then((s) => s.load(dbId))
      .then((d) => { if (!cancelled) { setDesigns(d.designs); setDistributions(d.distributions); setLoaded("ready"); } })
      .catch((e: unknown) => { if (!cancelled) { setLoadError(messageOf(e)); setLoaded("error"); } });
    return () => { cancelled = true; };
  }, [dbId, tick]);

  // Saves that are still waiting go out when the page is left.
  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(({ t, save }) => { clearTimeout(t); save().catch(() => undefined); }); pending.clear(); };
  }, []);

  const later = useCallback((key: string, save: () => Promise<void>) => {
    const old = timers.current.get(key);
    if (old) clearTimeout(old.t);
    timers.current.set(key, { t: setTimeout(() => { timers.current.delete(key); save().catch((e: unknown) => setError(messageOf(e))); }, SAVE_DELAY), save });
  }, []);

  /** Runs a change to an issued certificate, then reads the sends again so the list shows what the backend now holds. */
  const afterIssued = useCallback(async (job: (svc: Awaited<ReturnType<typeof getCertificateService>>) => Promise<void>) => {
    if (!dbId) return false;
    try {
      const svc = await getCertificateService();
      await job(svc);
      const fresh = await svc.load(dbId);
      setDesigns(fresh.designs);
      setDistributions(fresh.distributions);
      return true;
    } catch (e) { setError(messageOf(e)); return false; }
  }, [dbId]);

  const actions = useMemo<CertificateActions>(() => ({
    async createDesign({ name, typeKey, templateKey, orientation, paper }) {
      if (!dbId) return null;
      try {
        const made = await (await getCertificateService()).createDesign(dbId, { name, typeKey, design: designFromTemplate(templateKey, typeKey, orientation ?? "landscape", undefined, paper) });
        setDesigns((l) => [...l, made]);
        return made;
      } catch (e) { setError(messageOf(e)); return null; }
    },
    updateDesign(id, patch) {
      setDesigns((l) => l.map((d) => (d.id === id ? { ...d, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.design ? { design: typeof patch.design === "function" ? patch.design(d.design) : patch.design } : {}) } : d)));
      later(`design:${id}`, async () => {
        const d = designsRef.current.find((x) => x.id === id);
        if (d) await (await getCertificateService()).saveDesign(id, { name: d.name, design: d.design });
      });
    },
    async deleteDesign(id) {
      try {
        await (await getCertificateService()).deleteDesign(id);
        setDesigns((l) => l.filter((d) => d.id !== id));
        setDistributions((l) => l.filter((d) => d.certId !== id));
      } catch (e) { setError(messageOf(e)); }
    },
    async duplicateDesign(id) {
      const src = designsRef.current.find((d) => d.id === id);
      if (!dbId || !src) return;
      try {
        const made = await (await getCertificateService()).createDesign(dbId, { name: `${src.name} (copy)`, typeKey: src.typeKey, design: JSON.parse(JSON.stringify(src.design)) as Design });
        setDesigns((l) => [...l, made]);
      } catch (e) { setError(messageOf(e)); }
    },
    async createDistribution({ certId, sourceKey, name }) {
      const cert = designsRef.current.find((d) => d.id === certId);
      if (!dbId || !cert) return null;
      try {
        const base = defaultDistribution(cert, sourceKey, name);
        const made = await (await getCertificateService()).createDistribution(dbId, { designId: certId, name: base.name, audience: base.audience, email: base.email });
        setDistributions((l) => [...l, made]);
        return made;
      } catch (e) { setError(messageOf(e)); return null; }
    },
    updateDistribution(id, patch) {
      setDistributions((l) => l.map((d) => (d.id === id ? {
        ...d,
        ...(patch.audience ? { audience: typeof patch.audience === "function" ? patch.audience(d.audience) : patch.audience } : {}),
        ...(patch.email ? { email: typeof patch.email === "function" ? patch.email(d.email) : patch.email } : {}),
        ...(patch.manual ? { manual: patch.manual } : {}),
        ...(patch.overrides ? { overrides: patch.overrides } : {}),
      } : d)));
      later(`dist:${id}`, async () => {
        const d = distsRef.current.find((x) => x.id === id);
        if (d && d.status === "draft") await (await getCertificateService()).saveDistribution(id, { audience: d.audience, email: d.email, manual: d.manual, overrides: d.overrides });
      });
    },
    async deleteDistribution(id) {
      try {
        await (await getCertificateService()).deleteDistribution(id);
        setDistributions((l) => l.filter((d) => d.id !== id));
      } catch (e) { setError(messageOf(e)); }
    },
    async revoke(serial, reason) { return afterIssued(async (svc) => { if (!svc.revoke) throw new Error("Withdrawing certificates needs the own backend."); await svc.revoke(serial, reason); }); },
    async resend(serial) { return afterIssued(async (svc) => { if (!svc.resend) throw new Error("Sending a certificate again needs the own backend."); await svc.resend(serial); }); },
    async reissue(serial, changes) { return afterIssued(async (svc) => { if (!svc.reissue) throw new Error("Replacing a certificate needs the own backend."); await svc.reissue(serial, changes); }); },
    async issue(distribution, recipients) {
      const pending = timers.current.get(`dist:${distribution.id}`);
      try {
        const svc = await getCertificateService();
        // What the chair typed a moment ago is saved first, so the send that goes out is the one on screen.
        if (pending) { clearTimeout(pending.t); timers.current.delete(`dist:${distribution.id}`); const d = distsRef.current.find((x) => x.id === distribution.id) ?? distribution; await svc.saveDistribution(d.id, { audience: d.audience, email: d.email, manual: d.manual, overrides: d.overrides }); }
        await svc.issue(distribution.id, recipients);
        const fresh = await svc.load(distribution.conferenceId);
        setDesigns(fresh.designs);
        setDistributions(fresh.distributions);
        const mail = await sendActionEmails("certificate_issued", { distributionId: distribution.id });
        if (mail) return mail;
        // The email service may have refused some addresses: show them as bounced.
        const after = await svc.load(distribution.conferenceId);
        setDistributions(after.distributions);
        return "";
      } catch (e) { setError(messageOf(e)); return null; }
    },
  }), [dbId, later, afterIssued]);

  const reload = useCallback(() => { setLoaded("loading"); setTick((t) => t + 1); }, []);
  const retry = useCallback(() => { chair.retry(); reload(); }, [chair, reload]);

  const audience = useMemo<AudienceContext | null>(() => {
    if (!ready) return null;
    return { papers: ready.data.papers, reviewers: reviewerRollup(ready.board), conference: { ...ready.conference, contactEmail: ready.info?.contactEmail || "" } };
  }, [ready]);

  return { state: chair.state, ready, loaded, loadError, error, clearError: () => setError(""), retry, designs, distributions, audience, actions };
}
