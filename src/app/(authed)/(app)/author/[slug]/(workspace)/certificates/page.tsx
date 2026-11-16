import type { Metadata } from "next";
import { ConferenceCertificatesPage } from "@/features/certificates/components/my-certificates-pages";

export const metadata: Metadata = { title: "Certificates" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorCertificates({ params }: PageProps<"/author/[slug]/certificates">) {
  const { slug } = await params;
  return <ConferenceCertificatesPage slug={slug} role="author" />;
}
