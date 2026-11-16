import type { Metadata } from "next";
import { CertificateVerifyPage } from "@/features/certificates/components/verify-page";

export const metadata: Metadata = { title: "Verify a certificate" };

// The QR code on a certificate opens this page. Any certificate ID is valid (it is looked up on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ serial: "CERTIFICATE-ID" }];
}

export default async function VerifyCertificate({ params }: PageProps<"/verify/[serial]">) {
  const { serial } = await params;
  return <CertificateVerifyPage serial={decodeURIComponent(serial)} />;
}
