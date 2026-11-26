import type { Metadata } from "next";
import { ChairOverviewPage } from "@/features/chair/components/chair-overview-page";

export const metadata: Metadata = { title: "Dashboard" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairDashboard({ params }: PageProps<"/chair/[slug]/dashboard">) {
  const { slug } = await params;
  return <ChairOverviewPage slug={slug} />;
}
