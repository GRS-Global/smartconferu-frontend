import type { Metadata } from "next";
import { ReceiptsPage } from "@/features/account/receipts-page";
import { Receipt } from "lucide-react";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { ACCOUNT_EXTRAS_ENABLED } from "@/lib/config";

export const metadata: Metadata = { title: "My Receipts" };

export default function Receipts() {
  // Switched off for now (lib/config.ts ACCOUNT_EXTRAS_ENABLED).
  if (!ACCOUNT_EXTRAS_ENABLED) return <ComingSoonPage title="My Receipts" section="My Account" icon={<Receipt size={22} aria-hidden="true" />} description="Your payment receipts for registrations and fees, in one place. We're still building it — it will be here soon." />;
  return <ReceiptsPage />;
}
