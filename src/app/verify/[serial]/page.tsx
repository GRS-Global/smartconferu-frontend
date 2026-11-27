import { Award } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CertificateVerifyPage } from "@/features/certificates/components/verify-page";
import { CERTIFICATES_ENABLED } from "@/lib/config";

export const metadata: Metadata = { title: "Verify a certificate" };

// The QR code on a certificate opens this page. Any certificate ID is valid (it is looked up on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ serial: "CERTIFICATE-ID" }];
}

export default async function VerifyCertificate({ params }: PageProps<"/verify/[serial]">) {
  const { serial } = await params;
  // Switched off for now (lib/config.ts CERTIFICATES_ENABLED). A public page (no app shell), so the card stands on its own.
  if (!CERTIFICATES_ENABLED) {
    return (
      <div style={{ background: "var(--canvas)", minHeight: "100vh" }} className="flex items-center justify-center px-5">
        <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="w-full max-w-[520px] rounded-2xl bg-white px-8 py-12 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary"><Award size={22} aria-hidden="true" /></span>
          <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">Coming soon</span>
          <h1 className="mt-3 text-lg font-bold text-navy">Certificate check</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">Checking a certificate online isn&apos;t available yet. We&apos;re still building it — it will be here soon.</p>
          <Link href="/" className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Go to home</Link>
        </div>
      </div>
    );
  }
  return <CertificateVerifyPage serial={decodeURIComponent(serial)} />;
}
