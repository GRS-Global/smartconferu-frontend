import type { Metadata } from "next";
import { ConferenceCertificatesPage } from "@/features/certificates/components/my-certificates-pages";

export const metadata: Metadata = { title: "Certificates" };

export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ReviewerCertificates({ params }: PageProps<"/reviewer/[slug]/certificates">) {
  const { slug } = await params;
  return <ConferenceCertificatesPage slug={slug} role="reviewer" />;
}
