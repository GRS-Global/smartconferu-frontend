import { Hammer } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { COMING_SOON, type ComingSoonKey } from "@/lib/navigation";

export const metadata: Metadata = { title: "Coming soon" };

/** The screens that are announced but not built yet all open here (see COMING_SOON in lib/navigation.ts). */
export default async function ComingSoon({ searchParams }: { searchParams: Promise<{ feature?: string | string[] }> }) {
  const { feature } = await searchParams;
  const key = typeof feature === "string" && Object.prototype.hasOwnProperty.call(COMING_SOON, feature) ? (feature as ComingSoonKey) : null;
  const title = key ? COMING_SOON[key] : "This page";
  return <ComingSoonPage title={title} icon={<Hammer size={22} aria-hidden="true" />} description="We're still building it — it will be here soon." />;
}
