import type { Metadata } from "next";
import { PreprintsPage } from "@/features/account/preprints-page";
import { FileText } from "lucide-react";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { ACCOUNT_EXTRAS_ENABLED } from "@/lib/config";

export const metadata: Metadata = { title: "My Preprints" };

export default function Preprints() {
  // Switched off for now (lib/config.ts ACCOUNT_EXTRAS_ENABLED).
  if (!ACCOUNT_EXTRAS_ENABLED) return <ComingSoonPage title="My Preprints" section="Publishing" icon={<FileText size={22} aria-hidden="true" />} description="Share your papers as preprints and keep them in one place. We're still building it — it will be here soon." />;
  return <PreprintsPage />;
}
