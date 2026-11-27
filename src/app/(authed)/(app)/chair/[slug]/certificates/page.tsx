import { Award } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { CERTIFICATES_ENABLED } from "@/lib/config";
import { CertificatesDesignPage } from "@/features/certificates/components/certificate-pages";

export const metadata: Metadata = { title: "Certificates · Design" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairCertificates({ params }: PageProps<"/chair/[slug]/certificates">) {
  const { slug } = await params;
  // Switched off for now (lib/config.ts CERTIFICATES_ENABLED).
  if (!CERTIFICATES_ENABLED) return <ComingSoonPage title="Certificates" icon={<Award size={22} aria-hidden="true" />} description="Certificates for authors, reviewers and the committee: design, send and download them here. We're still building it — it will be here soon." />;
  return <CertificatesDesignPage slug={slug} />;
}
