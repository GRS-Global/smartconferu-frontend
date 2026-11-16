/* eslint-disable @next/next/no-img-element -- the platform mark is a fixed file */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, XCircle, Download, Info } from "lucide-react";
import { getCertificateService, type VerifiedCertificate } from "@/services/certificates";
import { getCertificateType, formatConferenceDates } from "../data";

// Display serif: used only on printed artefacts and this page's name line, never in the app's own screens.
const SERIF_FAMILY = "var(--font-cormorant), 'Cormorant Garamond', 'Times New Roman', serif";
const LOGO_SRC = "/smartconferu-mark.png";

/* ---------------------------------------------------------------------------
   The public end of the QR code. No sign-in, no app chrome, and deliberately
   phone-shaped column-first: almost everyone who lands here got here by pointing
   a camera at a printed page.

   It answers one question — is this real — and then shows the record it was
   checked against, because "verified" with nothing behind it is just a green tick.
   --------------------------------------------------------------------------- */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider">{label}</div>
      <div style={{ color: "var(--ink)" }} className="text-[13px] font-semibold mt-0.5 leading-snug">{children}</div>
    </div>
  );
}

export function CertificateVerifyPage({ serial }: { serial: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "done"; found: VerifiedCertificate | null } | { status: "error"; message: string }>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    getCertificateService()
      .then((s) => s.verify(serial))
      .then((found) => { if (!cancelled) setState({ status: "done", found }); })
      .catch((e: unknown) => { if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." }); });
    return () => { cancelled = true; };
  }, [serial]);

  if (state.status === "loading") return <div style={{ background: "var(--canvas)", minHeight: "100vh" }} role="status" aria-label="Checking the certificate" />;
  if (state.status === "error") {
    return (
      <div style={{ background: "var(--canvas)", minHeight: "100vh" }} className="flex items-center justify-center px-5">
        <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-5 max-w-sm text-center">
          <p style={{ color: "var(--navy)" }} className="text-sm font-bold">We couldn&apos;t check that certificate.</p>
          <p style={{ color: "var(--ink-muted)" }} className="text-[13px] leading-relaxed mt-1.5">{state.message}</p>
        </div>
      </div>
    );
  }
  const found = state.found;

  return (
    <div style={{ background: "var(--canvas)", minHeight: "100vh" }}>
      <div style={{ background: "var(--gradient-header)" }} className="px-5 pt-6 pb-10">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5 mb-8 cursor-pointer">
            <img src={LOGO_SRC} alt="" className="h-6 w-auto brightness-0 invert opacity-90" />
            <span style={{ color: "var(--on-dark)" }} className="text-[13px] font-bold">Smartconferu Verify</span>
          </Link>

          <div className="flex flex-col items-center text-center">
            {found ? (
              <>
                <div style={{ background: "var(--success)", boxShadow: "0 0 0 9px rgba(22,163,74,0.18)" }} className="w-16 h-16 rounded-full flex items-center justify-center">
                  <Check size={30} strokeWidth={3} className="text-white" />
                </div>
                <h1 className="text-white text-[22px] font-extrabold mt-4" style={{ letterSpacing: "-0.02em" }}>Certificate verified</h1>
                <p style={{ color: "var(--on-dark-soft)" }} className="text-[13px] mt-1.5 leading-relaxed max-w-xs">
                  This certificate is genuine and matches the record held by the conference.
                </p>
              </>
            ) : (
              <>
                <div style={{ background: "var(--danger)", boxShadow: "0 0 0 9px rgba(220,38,38,0.18)" }} className="w-16 h-16 rounded-full flex items-center justify-center">
                  <XCircle size={30} strokeWidth={2.5} className="text-white" />
                </div>
                <h1 className="text-white text-[22px] font-extrabold mt-4" style={{ letterSpacing: "-0.02em" }}>No certificate found</h1>
                <p style={{ color: "var(--on-dark-soft)" }} className="text-[13px] mt-1.5 leading-relaxed max-w-xs">
                  Nothing on Smartconferu carries the ID <strong className="text-white">{serial || "—"}</strong>. Check it against the printed copy — the letters and digits have to match exactly.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 -mt-5 pb-10">
        {found ? (
          <VerifiedCard found={found} serial={serial} />
        ) : (
          <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-5">
            <p style={{ color: "var(--ink-muted)" }} className="text-[13px] leading-relaxed">
              If you were handed this link by someone claiming a certificate from a Smartconferu conference and it does not resolve, contact the conference organisers directly before accepting the document.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VerifiedCard({ found, serial }: { found: VerifiedCertificate; serial: string }) {
  const recipient = found;
  const conference = found.conference;
  const type = getCertificateType(found.typeKey);
  const signatory = found.signatory;

  return (
    <>
      <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--muted)" }}>
          <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider">AWARDED TO</div>
          <div style={{ fontFamily: SERIF_FAMILY, color: "var(--navy)" }} className="text-[26px] font-bold mt-1 leading-tight">{recipient.name}</div>
          {recipient.affiliation && <div style={{ color: "var(--ink-muted)" }} className="text-xs mt-0.5">{recipient.affiliation}</div>}
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <Field label="CERTIFICATE">{type.label}</Field>
          {recipient.paperTitle && (
            <Field label="FOR">
              {recipient.paperTitle}
              {recipient.paperId && <span style={{ color: "var(--ink-muted)" }} className="block text-xs font-normal mt-0.5">Paper {recipient.paperId}</span>}
            </Field>
          )}
          {!recipient.paperTitle && recipient.roleLabel && <Field label="ROLE">{recipient.roleLabel}</Field>}
          <Field label="CONFERENCE">
            {conference?.name}
            <span style={{ color: "var(--ink-muted)" }} className="block text-xs font-normal mt-0.5">
              {formatConferenceDates({ startDate: conference.startDate ?? undefined, endDate: conference.endDate ?? undefined })}{conference?.city ? ` · ${[conference.city, conference.country].filter(Boolean).join(", ")}` : ""}
            </span>
          </Field>
          {signatory?.name && (
            <Field label="SIGNED BY">
              {signatory.name}
              <span style={{ color: "var(--ink-muted)" }} className="block text-xs font-normal mt-0.5">{signatory.title}</span>
            </Field>
          )}
        </div>

        <div style={{ background: "var(--canvas)", borderTop: "1px solid var(--muted)" }} className="px-5 py-3.5">
          <div style={{ color: "var(--ink-faint)" }} className="text-[10.5px] font-bold tracking-wider">CERTIFICATE ID</div>
          <div style={{ color: "var(--navy)" }} className="text-[13px] font-extrabold tracking-wide mt-0.5">{serial}</div>
          <div style={{ color: "var(--ink-muted)" }} className="text-[11.5px] mt-0.5">
            Issued {new Date(recipient.issuedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
      </div>

      <button style={{ background: "var(--primary)" }} className="w-full mt-4 py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
        <Download size={16} /> Download a copy
      </button>

      <div style={{ border: "1px solid var(--border)" }} className="bg-white rounded-xl px-4 py-3 mt-4 flex items-start gap-2.5">
        <Info size={15} style={{ color: "var(--ink-faint)" }} className="shrink-0 mt-0.5" />
        <p style={{ color: "var(--ink-muted)" }} className="text-[11.5px] leading-relaxed">
          Checked just now against {conference?.acronym}&apos;s own records. If any detail here looks wrong, contact the organisers at{" "}
          {conference?.contactEmail
            ? <a href={`mailto:${conference.contactEmail}`} style={{ color: "var(--primary)" }} className="font-semibold">{conference.contactEmail}</a>
            : "the address on the conference website"}.
        </p>
      </div>
    </>
  );
}
