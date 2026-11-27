"use client";

import { useState } from "react";
import { Send, Plus, Trash2, Check, Users, AlertTriangle, Mail, ChevronUp, ChevronDown } from "lucide-react";
import { PageHero, HeroButton } from "@/features/workspace/components/hero";
import type { Conference } from "@/types/conference";
import { CertCard, Pill, CertModal, EmptyState, Notice } from "../components";
import { CertificateSwatch } from "../certificate-artwork";
import { inputStyle, inputClass } from "../form-styles";
import { getCertificateType, getAudienceSource, AUDIENCE_SOURCES, countAudience, deliveryStats, type AudienceContext, type CertificateDesign, type Distribution } from "../data";
import type { CertificateActions } from "../use-certificates";
import type { Go } from "../routes";

/* ---------------------------------------------------------------------------
   Certificates > Distribute — one row per send. Creating one asks two questions
   in a single dialog (which certificate, and who), then drops straight into the
   recipient list. The old four-page wizard is gone.
   --------------------------------------------------------------------------- */

function NewDistributionModal({ conference, certificates, presetCertId, audience, onClose, onCreate }: { conference: Conference; certificates: CertificateDesign[]; presetCertId: string | null; audience: AudienceContext; onClose: () => void; onCreate: (input: { certId: string; sourceKey: string; name: string }) => void }) {
  const [certId, setCertId] = useState(presetCertId || certificates[0]?.id || "");
  const cert = certificates.find((c) => c.id === certId);
  const type = getCertificateType(cert?.typeKey);
  const [sourceKey, setSourceKey] = useState(type.defaultSource);
  const [name, setName] = useState("");
  // "See How Email Looks" — shows the delivery email under the note (was used but never declared).
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const ctx = audience;
  const source = getAudienceSource(sourceKey);
  const count = source.blockedReason ? 0 : countAudience(sourceKey, ctx);

  const pickCert = (id: string) => {
    setCertId(id);
    // Re-point the audience at whatever the new certificate is for, unless the chair already
    // chose one that still makes sense.
    const t = getCertificateType(certificates.find((c) => c.id === id)?.typeKey);
    setSourceKey(t.defaultSource);
  };

  return (
    <CertModal
      title="Send a certificate"
      subtitle="Two choices: which certificate, and who gets it. The list comes from your conference data — no spreadsheet needed."
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <>
          <div className="flex-1" />
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--ink-muted)" }} className="px-4 py-2 rounded-lg text-sm font-semibold bg-white hover:bg-[var(--muted)] transition-colors cursor-pointer">Cancel</button>
          <button
            onClick={() => onCreate({ certId, sourceKey, name: name.trim() })}
            disabled={!certId || Boolean(source.blockedReason)}
            style={{ background: "var(--gradient-primary)" }}
            className="px-5 py-2 rounded-lg text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
          >
            {count === 0 ? "Start an empty list" : "Build the list"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">1 · WHICH CERTIFICATE</div>
          {certificates.length === 0 ? (
            <Notice tone="warning" icon={AlertTriangle}>
              There are no certificate designs yet. Make one under <strong>Certificates &gt; Design</strong> first.
            </Notice>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {certificates.map((c) => {
                const active = c.id === certId;
                const t = getCertificateType(c.typeKey);
                return (
                  <button
                    key={c.id}
                    onClick={() => pickCert(c.id)}
                    style={active ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)" } : { border: "1px solid var(--border)", background: "#FFFFFF" }}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-colors cursor-pointer"
                  >
                    <CertificateSwatch design={c.design} width={54} />
                    <div className="min-w-0">
                      <div style={{ color: active ? "var(--primary)" : "var(--navy)" }} className="text-xs font-bold truncate">{c.name}</div>
                      <div style={{ color: "var(--ink-muted)" }} className="text-[11px] truncate">{t.short}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider mb-2">2 · WHO GETS IT</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {AUDIENCE_SOURCES.map((s) => {
              const active = s.key === sourceKey;
              const n = s.blockedReason ? 0 : countAudience(s.key, ctx);
              return (
                <button
                  key={s.key}
                  onClick={() => !s.blockedReason && setSourceKey(s.key)}
                  disabled={!!s.blockedReason}
                  title={s.blockedReason || s.note}
                  style={active ? { border: "1.5px solid var(--primary)", background: "var(--primary-soft)" } : { border: "1px solid var(--border)", background: "#FFFFFF" }}
                  className="text-left px-3 py-2.5 rounded-xl transition-colors disabled:opacity-55 cursor-pointer disabled:cursor-not-allowed"
                >
                  <div style={{ color: active ? "var(--primary)" : "var(--navy)" }} className="text-lg font-extrabold leading-none">{n}</div>
                  <div style={{ color: active ? "var(--primary)" : "var(--ink-soft)" }} className="text-[11.5px] font-semibold mt-1 leading-snug">{s.label}</div>
                </button>
              );
            })}
          </div>
          {count === 0 && !source.blockedReason && (
            <p role="status" style={{ color: "var(--ink-muted)" }} className="text-xs leading-relaxed mt-3">Nobody is listed for this choice from your conference data yet. You can still start an empty list and add people by hand or import a file.</p>
          )}
          <p style={{ color: "var(--ink-muted)" }} className="text-xs mt-2.5 leading-relaxed">{source.blockedReason || source.note}</p>
        </div>

        <div>
          <label htmlFor="dist-name" style={{ color: "var(--ink-soft)" }} className="text-xs font-semibold mb-1 block">Name this send (optional)</label>
          <input
            id="dist-name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder={`${source.label} — ${type.short}`}
            style={inputStyle} className={inputClass}
          />
        </div>

        {/* Triggered Email Note Section */}
        <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)" }} className="rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mail size={14} style={{ color: "var(--primary)" }} className="shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: "var(--navy)" }} className="font-bold">Triggered Email Note</span>
                  <span style={{ background: "rgba(59,130,246,0.15)", color: "var(--primary)" }} className="text-[10px] font-bold px-1.5 py-0.5 rounded">Certificate Delivery</span>
                </div>
                <div style={{ color: "var(--ink-faint)" }} className="text-[11px] truncate">Recipient: {source.label} ({countAudience(sourceKey, ctx)} recipients)</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowEmailPreview(!showEmailPreview)}
              style={{ color: "var(--primary)" }}
              className="text-[11px] font-bold hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
            >
              {showEmailPreview ? "Hide Preview" : "See How Email Looks"}
              {showEmailPreview ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {showEmailPreview && (
            <div style={{ background: "#FFFFFF", border: "1px solid var(--border)" }} className="mt-2.5 rounded-lg p-3 space-y-1.5 text-[11px]">
              <div><span className="font-bold text-slate-500">From:</span> {conference.acronym} Secretariat &lt;certificates@smartconferu.com&gt;</div>
              <div><span className="font-bold text-slate-500">To:</span> {source.label}</div>
              <div><span className="font-bold text-slate-500">Subject:</span> Your Certificate of Participation for {conference.name}</div>
              <div style={{ borderTop: "1px solid var(--muted)" }} className="pt-2 text-slate-700 leading-relaxed space-y-1">
                <p>Dear Attendee / Author,</p>
                <p>We are pleased to present your official <strong>{type.short}</strong> for {conference.name} ({conference.acronym}).</p>
                <p>You can verify and download your high-resolution certificate directly from your dashboard.</p>
                <p>Best regards,<br />The {conference.acronym} Organizing Committee</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </CertModal>
  );
}

export function DistributeBody({ conference, certificates, distributions, audience, presetCertId, actions, go }: { conference: Conference; certificates: CertificateDesign[]; distributions: Distribution[]; audience: AudienceContext; presetCertId: string | null; actions: CertificateActions; go: Go }) {
  const [showNew, setShowNew] = useState(!!presetCertId);

  const create = async ({ certId, sourceKey, name }: { certId: string; sourceKey: string; name: string }) => {
    const dist = await actions.createDistribution({ certId, sourceKey, name });
    setShowNew(false);
    if (dist) go("chair-certificate-recipients", { distId: dist.id });
  };

  return (
    <div>
      <div className="px-4 sm:px-8 pt-8 pb-0">
        <PageHero level={1}
          label="Distribute"
          tile={<Send size={34} />}
          title="Distribute"
          badge={<span style={{ color: "var(--primary)", background: "var(--primary-soft)" }} className="text-[11.5px] font-bold px-2 py-0.5 rounded-full">{conference.acronym}</span>}
          subtitle="Send a certificate to a group, then watch it land. One row per send."
          actions={<HeroButton icon={Plus} primary onClick={() => setShowNew(true)} disabled={certificates.length === 0}>Send a certificate</HeroButton>}
        />
      </div>

      <div className="p-4 sm:p-8">
        {certificates.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Design a certificate first"
            action={
              <button onClick={() => go("chair-certificates")} style={{ background: "var(--primary)" }} className="px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                Go to Design
              </button>
            }
          >
            There is nothing to send yet. Make the artwork under Design, then come back here to choose who receives it.
          </EmptyState>
        ) : distributions.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nothing sent yet"
            action={
              <button onClick={() => setShowNew(true)} style={{ background: "var(--primary)" }} className="px-4 py-2.5 rounded-lg text-white text-sm font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
                Send a certificate
              </button>
            }
          >
            Pick a certificate and a group — accepted authors, reviewers who finished, people who registered — and Smartconferu builds the recipient list for you.
          </EmptyState>
        ) : (
          <CertCard padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ui-table w-full text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-5 py-3 whitespace-nowrap">Status</th>
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Send</th>
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Certificate</th>
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Recipients</th>
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Opened</th>
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-3 py-3 whitespace-nowrap">Downloaded</th>
                    <th className="px-3 py-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {distributions.map((d, i) => {
                    const cert = certificates.find((c) => c.id === d.certId);
                    const type = getCertificateType(cert?.typeKey);
                    const stats = deliveryStats(d.issued);
                    const rowBorder = i < distributions.length - 1 ? "1px solid var(--muted)" : "none";
                    const live = countAudience(d.audience.sourceKey, audience);
                    return (
                      <tr key={d.id} style={{ borderBottom: rowBorder }} className="transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          {d.status === "sent"
                            ? <Pill tone="success"><Check size={10} strokeWidth={3} /> Sent</Pill>
                            : <Pill tone="muted">Draft</Pill>}
                        </td>
                        <td className="px-3 py-3">
                          <button onClick={() => go("chair-certificate-recipients", { distId: d.id })} style={{ color: "var(--navy)" }} className="text-[13px] font-bold hover:text-[var(--primary)] transition-colors text-left cursor-pointer">
                            {d.name}
                          </button>
                          <div style={{ color: "var(--ink-muted)" }} className="text-[11px] mt-0.5">{getAudienceSource(d.audience.sourceKey).label}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            {cert && <CertificateSwatch design={cert.design} width={44} />}
                            <div className="min-w-0">
                              <div style={{ color: "var(--ink)" }} className="text-xs font-semibold truncate max-w-[150px]">{cert?.name || "Deleted design"}</div>
                              <div style={{ color: "var(--ink-muted)" }} className="text-[11px]">{type.short}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "var(--ink)" }} className="px-3 py-3 font-semibold whitespace-nowrap">
                          {d.status === "sent" ? stats.total : live}
                          {d.status !== "sent" && <span style={{ color: "var(--ink-muted)" }} className="font-normal text-[11px]"> waiting</span>}
                        </td>
                        <td style={{ color: d.status === "sent" ? "var(--ink)" : "var(--ink-faint)" }} className="px-3 py-3 whitespace-nowrap">
                          {d.status === "sent" ? `${stats.opened} (${stats.total ? Math.round((stats.opened / stats.total) * 100) : 0}%)` : "—"}
                        </td>
                        <td style={{ color: d.status === "sent" ? "var(--ink)" : "var(--ink-faint)" }} className="px-3 py-3 whitespace-nowrap">
                          {d.status === "sent" ? `${stats.downloaded} (${stats.total ? Math.round((stats.downloaded / stats.total) * 100) : 0}%)` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => go("chair-certificate-recipients", { distId: d.id })}
                              style={{ border: "1px solid var(--border)", color: "var(--primary)" }}
                              className="px-3 py-1.5 rounded-lg text-[11.5px] font-bold bg-white hover:bg-[var(--primary-soft)] transition-colors cursor-pointer"
                            >
                              {d.status === "sent" ? "Track" : "Open"}
                            </button>
                            <button
                              onClick={() => { void actions.deleteDistribution(d.id); }}
                              aria-label={`Delete ${d.name}`} title="Delete"
                              style={{ border: "1px solid var(--border)", color: "var(--danger-ink)" }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white hover:bg-[var(--danger-soft)] transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CertCard>
        )}
      </div>

      {showNew && certificates.length > 0 && (
        <NewDistributionModal
          conference={conference}
          certificates={certificates}
          presetCertId={presetCertId}
          audience={audience}
          onClose={() => setShowNew(false)}
          onCreate={create}
        />
      )}
    </div>
  );
}
