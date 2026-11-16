import type { Metadata } from "next";
import { CertificatesDesignPage } from "@/features/certificates/components/certificate-pages";

export const metadata: Metadata = { title: "Certificates · Design" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairCertificates({ params }: PageProps<"/chair/[slug]/certificates">) {
  const { slug } = await params;
  return <CertificatesDesignPage slug={slug} />;
}
