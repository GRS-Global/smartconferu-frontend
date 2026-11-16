import type { Metadata } from "next";
import { CertificateRecipientsPage } from "@/features/certificates/components/certificate-pages";

export const metadata: Metadata = { title: "Certificates · Send" };

export function generateStaticParams() {
  return [{ slug: "your-conference", dist: "your-send" }];
}

export default async function ChairCertificateSend({ params }: PageProps<"/chair/[slug]/certificates/distribute/[dist]">) {
  const { slug, dist } = await params;
  return <CertificateRecipientsPage slug={slug} distId={dist} />;
}
