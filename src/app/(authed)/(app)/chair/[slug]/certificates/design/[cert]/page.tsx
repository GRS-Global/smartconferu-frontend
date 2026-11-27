import { Award } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { CERTIFICATES_ENABLED } from "@/lib/config";
import { CertificateDesignerPage } from "@/features/certificates/components/certificate-pages";

export const metadata: Metadata = { title: "Certificate designer" };

export function generateStaticParams() {
  return [{ slug: "your-conference", cert: "your-certificate" }];
}

export default async function ChairCertificateDesigner({ params }: PageProps<"/chair/[slug]/certificates/design/[cert]">) {
  const { slug, cert } = await params;
  // Switched off for now (lib/config.ts CERTIFICATES_ENABLED).
  if (!CERTIFICATES_ENABLED) return <ComingSoonPage title="Certificates" icon={<Award size={22} aria-hidden="true" />} description="Certificates for authors, reviewers and the committee: design, send and download them here. We're still building it — it will be here soon." />;
  return <CertificateDesignerPage slug={slug} certId={cert} />;
}
