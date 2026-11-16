/* eslint-disable react/no-unescaped-entities -- the page text is the prototype's, word for word */
"use client";

import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

/* Terms of Service (the prototype's TermsOfServicePage): the Terms with a "On this page" rail. Download PDF has no file behind it in the prototype
   either; here it prints the page ("Save as PDF"). */

const TERMS_VERSION = "3";
const TERMS_UPDATED = "August 15, 2026";

const TERMS_SECTIONS: Array<{ id: string; title: string; body: string[] }> = [
  {
    id: "acceptance",
    title: "1. Acceptance of these Terms",
    body: [
      "Using Smartconferu's conference and publishing tools means you agree to the terms on this page. If you're acting on behalf of an institution, a program committee, or an organizing team, you're confirming that you have the authority to accept these terms on their behalf.",
      "We may update these Terms from time to time. When a change is significant, we'll flag it in your dashboard notifications rather than expecting you to check back here on your own.",
    ],
  },
  {
    id: "service",
    title: "2. What Smartconferu Provides",
    body: [
      "Smartconferu gives organizers a shared workspace to run submissions, reviews, programs, registrations, and correspondence for conferences, workshops, and journals.",
      "Separately, our publishing tools help authors host preprints, slides, and other conference materials, and help organizers request full event hosting once a call for papers is ready to go live.",
    ],
  },
  {
    id: "account",
    title: "3. Your Account",
    body: [
      "Keep your login credentials to yourself, and let us know right away if you think someone else has accessed your account.",
      "You're responsible for the accuracy of what you submit under your account — author details, affiliations, and conflict-of-interest disclosures included. Reviewers and chairs may rely on this information when making decisions.",
    ],
  },
  {
    id: "content",
    title: "4. Content You Submit",
    body: [
      "You keep ownership of the manuscripts, preprints, slides, and other material you upload. By submitting, you give Smartconferu the rights needed to host, display, and distribute that content within the platform for review, program-building, and publication.",
      "Don't upload anything you don't have the rights to share, or anything that infringes someone else's copyright — we may remove content that violates this without notice.",
    ],
  },
  {
    id: "payments",
    title: "5. Payments, Licenses & Refunds",
    body: [
      "Fees for hosting requests or publishing packages are shown to you before you confirm a purchase. Every payment generates a receipt you can review any time under My Receipts.",
      "Refund requests are handled case by case within a reasonable window of the original charge — reach out to our billing team and we'll take it from there.",
    ],
  },
  {
    id: "privacy",
    title: "6. Privacy",
    body: [
      "We only use the personal information you give us to run the conferences and publishing services you're part of. We don't sell it, and we don't share it outside what's needed to operate the Service.",
    ],
  },
  {
    id: "changes",
    title: "7. Changes to the Service",
    body: [
      "We occasionally improve or retire features as the platform evolves. Where a change could affect how you already use Smartconferu, we'll surface it in-app ahead of time rather than switching it on silently.",
    ],
  },
  {
    id: "termination",
    title: "8. Suspension & Termination",
    body: [
      "We may suspend or close an account that's used to abuse the platform, violate these Terms, or leave fees unpaid for an extended period.",
      "You're free to close your own account at any time from your account settings — your submitted content stays available to the conferences it was already part of, as is standard for academic record-keeping.",
    ],
  },
  {
    id: "liability",
    title: "9. Limitation of Liability",
    body: [
      "Smartconferu is provided as-is. We work hard to keep it available and accurate, but we're not liable for indirect losses arising from outages, delays, or issues outside our reasonable control — including on the day of a live event.",
    ],
  },
  {
    id: "contact",
    title: "10. Governing Law & Contact",
    body: [
      "These Terms are governed by the laws of the jurisdiction in which Smartconferu is registered. If anything here is unclear, our support team is happy to walk through it with you before you accept.",
    ],
  },
];

/* ---------------- Help ---------------- */

export function TermsPage() {
  const [activeId, setActiveId] = useState(TERMS_SECTIONS[0].id);

  const scrollToSection = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <PageHeader title="Terms of Service" />
      <div className="p-8">
        <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div style={{ background: "var(--primary-soft)" }} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck size={19} style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <p style={{ color: "var(--ink)" }} className="text-sm font-semibold">Version {TERMS_VERSION} · Last updated {TERMS_UPDATED}</p>
              <p style={{ color: "var(--ink-muted)" }} className="text-xs mt-0.5">These Terms apply to everyone using Smartconferu's conference and publishing tools.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ background: "var(--primary)" }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold hover:bg-[var(--primary-hover)] transition-colors shrink-0 cursor-pointer"
          >
            <Download size={15} />
            Download PDF
          </button>
        </div>

        <div className="flex items-start gap-8">
          <div style={{ top: 24 }} className="hidden lg:block w-56 shrink-0 sticky self-start">
            <p style={{ color: "var(--ink-faint)" }} className="text-xs font-semibold mb-2 px-3">On this page</p>
            <nav className="flex flex-col gap-0.5">
              {TERMS_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  style={{
                    color: activeId === s.id ? "var(--primary)" : "var(--ink-muted)",
                    background: activeId === s.id ? "var(--primary-soft)" : "transparent",
                  }}
                  className="text-left text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                >
                  {s.title}
                </button>
              ))}
            </nav>
          </div>

          <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-8 flex-1 min-w-0">
            {TERMS_SECTIONS.map((s, i) => (
              <div key={s.id} id={s.id} className={i > 0 ? "mt-8 pt-8" : ""} style={i > 0 ? { borderTop: "1px solid var(--muted)" } : undefined}>
                <h2 style={{ color: "var(--navy)" }} className="text-base font-bold mb-3">{s.title}</h2>
                {s.body.map((p, j) => (
                  <p key={j} style={{ color: "var(--ink-soft)" }} className="text-sm leading-relaxed mb-3 last:mb-0">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
