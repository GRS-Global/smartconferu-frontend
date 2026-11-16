import type { Metadata } from "next";
import { CertificateDesignerPage } from "@/features/certificates/components/certificate-pages";

export const metadata: Metadata = { title: "Certificate designer" };

export function generateStaticParams() {
  return [{ slug: "your-conference", cert: "your-certificate" }];
}

export default async function ChairCertificateDesigner({ params }: PageProps<"/chair/[slug]/certificates/design/[cert]">) {
  const { slug, cert } = await params;
  return <CertificateDesignerPage slug={slug} certId={cert} />;
}
