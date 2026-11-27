import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPublicationPage } from "@/features/account/new-publication-page";
import { Presentation } from "lucide-react";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { ACCOUNT_EXTRAS_ENABLED } from "@/lib/config";

export const metadata: Metadata = { title: "New Slides" };

export default function NewSlides() {
  // Switched off for now (lib/config.ts ACCOUNT_EXTRAS_ENABLED).
  if (!ACCOUNT_EXTRAS_ENABLED) return <ComingSoonPage title="My Slides" section="Publishing" icon={<Presentation size={22} aria-hidden="true" />} description="Keep the slides of your talks together and share them. We're still building it — it will be here soon." />;
  return <Suspense><NewPublicationPage kind="slides" /></Suspense>;
}
