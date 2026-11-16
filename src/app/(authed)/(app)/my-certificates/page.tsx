import type { Metadata } from "next";
import { MyCertificatesPage } from "@/features/certificates/components/my-certificates-pages";

export const metadata: Metadata = { title: "My certificates" };

export default function MyCertificates() {
  return <MyCertificatesPage />;
}
