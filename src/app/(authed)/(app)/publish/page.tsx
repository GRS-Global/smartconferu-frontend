import type { Metadata } from "next";
import { PublishPage } from "@/features/account/publish-page";
import { BookOpen } from "lucide-react";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { ACCOUNT_EXTRAS_ENABLED } from "@/lib/config";

export const metadata: Metadata = { title: "Publish with Us" };

export default function Publish() {
  // Switched off for now (lib/config.ts ACCOUNT_EXTRAS_ENABLED).
  if (!ACCOUNT_EXTRAS_ENABLED) return <ComingSoonPage title="Publish with Us" section="Publishing" icon={<BookOpen size={22} aria-hidden="true" />} description="Propose a proceedings volume or a new book series with us. We're still building it — it will be here soon." />;
  return <PublishPage />;
}
