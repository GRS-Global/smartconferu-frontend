import type { Metadata } from "next";
import { CertificatesDistributePage } from "@/features/certificates/components/certificate-pages";

export const metadata: Metadata = { title: "Certificates · Distribute" };

export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairCertificatesDistribute({ params }: PageProps<"/chair/[slug]/certificates/distribute">) {
  const { slug } = await params;
  return <CertificatesDistributePage slug={slug} />;
}
