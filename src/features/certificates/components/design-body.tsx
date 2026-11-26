"use client";

import { useState } from "react";
import { Award, Plus, Copy, Trash2, Pencil, Send } from "lucide-react";
import { PageHero, HeroButton } from "@/features/workspace/components/hero";
import type { Conference } from "@/types/conference";
import { CertCard, Pill, EmptyState } from "../components";
import { NewCertificateModal, type NewCertificateInput } from "./template-gallery";
import { CertificateArtwork } from "../certificate-artwork";
import { getCertificateType, sampleRecipient, type CertificateDesign, type Distribution } from "../data";
import type { CertificateActions } from "../use-certificates";
import type { Go } from "../routes";

/* ---------------------------------------------------------------------------
   Certificates > Design — the gallery. One job: what the certificate looks like.
   Who receives it is the Distribute menu's business, and this page never asks.
   --------------------------------------------------------------------------- */

export function DesignBody({ conference, certificates, distributions, actions, go }: { conference: Conference; certificates: CertificateDesign[]; distributions: Distribution[]; actions: CertificateActions; go: Go }) {
  const [showNew, setShowNew] = useState(false);

  const create = async (input: NewCertificateInput) => {
    const cert = await actions.createDesign(input);
    setShowNew(false);
    if (cert) go("chair-certificate-design", { certId: cert.id });
  };

  const sendCount = (certId: string) => distributions
    .filter((d) => d.certId === certId && d.status === "sent")
    .reduce((n, d) => n + d.issued.length, 0);

  return (
    <div>
      <div className="px-4 sm:px-8 pt-8 pb-0">
        <PageHero
          label="Design"
          tile={<Award size={34} />}
          title="Design"
          badge={<span style={{ color: "var(--primary)", background: "var(--primary-soft)" }} className="text-[11.5px] font-bold px-2 py-0.5 rounded-full">{conference.acronym}</span>}
          subtitle={<>Make the certificate. When it looks right, hand it to <strong>Distribute</strong> to decide who gets it.</>}
          actions={<HeroButton icon={Plus} primary onClick={() => setShowNew(true)}>New certificate</HeroButton>}
        />
      </div>

      <div className="p-4 sm:p-8">
        {certificates.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No certificates yet"
            action={
              <button onClick={() => setShowNew(true)} style={{ background: "var(--primary)" }} className="px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                Design your first one
              </button>
            }
          >
            Pick a style, drag the pieces where you want them, drop in your own logo. Nothing here sends anything.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {certificates.map((cert) => {
              const type = getCertificateType(cert.typeKey);
              const sent = sendCount(cert.id);
              return (
                <CertCard key={cert.id} padded={false} className="overflow-hidden flex flex-col">
                  <button
                    onClick={() => go("chair-certificate-design", { certId: cert.id })}
                    style={{ background: "#E9EDF3" }}
                    className="p-4 flex justify-center hover:opacity-90 transition-opacity cursor-pointer"
                    aria-label={`Open ${cert.name} in the designer`}
                  >
                    <CertificateArtwork design={cert.design} recipient={sampleRecipient(conference, cert.typeKey)} conference={conference} width={300} />
                  </button>

                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="min-w-0">
                      <Pill tone={type.tone}>{type.short}</Pill>
                      <h2 style={{ color: "var(--navy)" }} className="text-sm font-bold mt-2 truncate">{cert.name}</h2>
                      <p style={{ color: "var(--ink-muted)" }} className="text-[11.5px] mt-0.5">
                        {sent > 0 ? `Issued to ${sent} ${sent === 1 ? "person" : "people"}` : "Not sent yet"}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => go("chair-certificate-design", { certId: cert.id })}
                        style={{ background: "var(--primary)" }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-white text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
                      >
                        <Pencil size={13} /> Edit design
                      </button>
                      <button
                        onClick={() => go("chair-certificates-distribute", { certId: cert.id })}
                        title="Send this one"
                        aria-label={`Send ${cert.name}`}
                        style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                      >
                        <Send size={14} />
                      </button>
                      <button
                        onClick={() => { void actions.duplicateDesign(cert.id); }}
                        title="Duplicate" aria-label={`Duplicate ${cert.name}`}
                        style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => { void actions.deleteDesign(cert.id); }}
                        title="Delete" aria-label={`Delete ${cert.name}`}
                        style={{ border: "1px solid var(--border)", color: "var(--danger)" }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--danger-soft)] transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CertCard>
              );
            })}
          </div>
        )}
      </div>

      {showNew && <NewCertificateModal conference={conference} onClose={() => setShowNew(false)} onCreate={create} />}
    </div>
  );
}
