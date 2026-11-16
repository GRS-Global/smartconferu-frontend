import type { Metadata } from "next";
import { TermsPage } from "@/features/account/terms-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Terms() {
  return <TermsPage />;
}
