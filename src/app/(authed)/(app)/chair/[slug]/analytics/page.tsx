import type { Metadata } from "next";
import { AnalyticsPage } from "@/features/analytics/components/analytics-page";

export const metadata: Metadata = { title: "Analytics" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairAnalytics({ params }: PageProps<"/chair/[slug]/analytics">) {
  const { slug } = await params;
  return <AnalyticsPage slug={slug} />;
}
