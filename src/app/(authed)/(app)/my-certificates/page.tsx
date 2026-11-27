import { Award } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { CERTIFICATES_ENABLED } from "@/lib/config";
import { MyCertificatesPage } from "@/features/certificates/components/my-certificates-pages";

export const metadata: Metadata = { title: "My certificates" };

export default function MyCertificates() {
  // Switched off for now (lib/config.ts CERTIFICATES_ENABLED).
  if (!CERTIFICATES_ENABLED) return <ComingSoonPage title="My Certificates" section="My Account" icon={<Award size={22} aria-hidden="true" />} description="Certificates for authors, reviewers and the committee: design, send and download them here. We're still building it — it will be here soon." />;
  return <MyCertificatesPage />;
}
