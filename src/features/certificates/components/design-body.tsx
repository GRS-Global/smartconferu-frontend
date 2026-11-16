"use client";

import { useState } from "react";
import { Award, Plus, Copy, Trash2, Pencil, Send } from "lucide-react";
import { PageHero, HeroButton } from "@/features/workspace/components/hero";
import type { Conference } from "@/types/conference";
import { CertCard, Pill, CertModal, EmptyState } from "../components";
import { CertificateArtwork, CertificateSwatch } from "../certificate-artwork";
import { inputStyle, inputClass } from "../form-styles";
import { CERTIFICATE_TYPES, CERTIFICATE_TEMPLATES, getCertificateType, getTemplate, defaultElements, sampleRecipient, type CertificateDesign, type CertTypeKey, type Design, type Distribution } from "../data";
import type { CertificateActions } from "../use-certificates";
import type { Go } from "../routes";

/* ---------------------------------------------------------------------------
   Certificates > Design — the gallery. One job: what the certificate looks like.
   Who receives it is the Distribute menu's business, and this page never asks.
   --------------------------------------------------------------------------- */

function NewCertificateModal({ conference, onClose, onCreate }: { conference: Conference; onClose: () => void; onCreate: (input: { name: string; typeKey: CertTypeKey; templateKey: string }) => void }) {
  const [typeKey, setTypeKey] = useState<CertTypeKey>(CERTIFICATE_TYPES[0].key);
  const [templateKey, setTemplateKey] = useState(CERTIFICATE_TEMPLATES[0].key);
  const [name, setName] = useState("");

  const type = getCertificateType(typeKey);
  const template = getTemplate(templateKey);

  const previewDesign: Design = {
    templateKey: template.key, layout: template.layout, palette: template.palette,
    orientation: "landscape", headline: "CERTIFICATE", typeLine: type.line,
    leadIn: "This certificate is proudly awarded to", bodyLine: type.body,
    // The signature is left for the chair to fill in (the database holds no sample person).
    signatories: [{ name: "", title: "Conference Chair" }],
    showQr: true, showLogo: true, logoSrc: null,
    elements: defaultElements("landscape", 1),
  };

  return (
    <CertModal
      title="New certificate"
      subtitle="Pick what it is for and how it should look. You can change everything afterwards."
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <>
          <div className="flex-1" />
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={() => onCreate({ name: name.trim() || `${conference?.acronym} — ${type.short}`, typeKey, templateKey })}
            style={{ background: "var(--gradient-primary)" }}
            className="px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Create &amp; open the designer
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-5">
        <div className="space-y-4">
          <div>
            <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">WHAT IS IT FOR?</div>
            <div className="space-y-1.5">
              {CERTIFICATE_TYPES.map((t) => {
                const active = t.key === typeKey;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTypeKey(t.key)}
                    style={active
                      ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)", color: "var(--primary)" }
                      : { border: "1px solid var(--border)", background: "#FFFFFF", color: "var(--navy)" }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold transition-colors cursor-pointer"
                  >
                    {t.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">STYLE</div>
            <div className="grid grid-cols-2 gap-2">
              {CERTIFICATE_TEMPLATES.map((t) => {
                const active = t.key === templateKey;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTemplateKey(t.key)}
                    style={active ? { border: "2px solid var(--primary)" } : { border: "1px solid var(--border)" }}
                    className="rounded-xl overflow-hidden bg-white transition-colors cursor-pointer"
                    title={t.name}
                  >
                    <div className="p-1.5 flex justify-center" style={{ background: "var(--canvas)" }}>
                      <CertificateSwatch design={{ palette: t.palette }} width={74} />
                    </div>
                    <div style={{ color: active ? "var(--primary)" : "var(--ink-muted)" }} className="text-[10.5px] font-bold px-1.5 py-1 truncate">{t.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl p-4 flex justify-center">
            <CertificateArtwork design={previewDesign} recipient={sampleRecipient(conference, type.key)} conference={conference} width={470} />
          </div>
          <div className="mt-4">
            <label htmlFor="cert-name" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Name it (only you see this)</label>
            <input
              id="cert-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={`${conference?.acronym} — ${type.short}`}
              style={inputStyle} className={inputClass}
            />
          </div>
        </div>
      </div>
    </CertModal>
  );
}

export function DesignBody({ conference, certificates, distributions, actions, go }: { conference: Conference; certificates: CertificateDesign[]; distributions: Distribution[]; actions: CertificateActions; go: Go }) {
  const [showNew, setShowNew] = useState(false);

  const create = async ({ name, typeKey, templateKey }: { name: string; typeKey: CertTypeKey; templateKey: string }) => {
    const cert = await actions.createDesign({ name, typeKey, templateKey });
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
