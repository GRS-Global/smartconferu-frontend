import type { Metadata } from "next";
import { ChairOverviewPage } from "@/features/chair/components/chair-overview-page";

export const metadata: Metadata = { title: "Dashboard" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairOverview({ params }: PageProps<"/conference/[slug]/chair">) {
  const { slug } = await params;
  return <ChairOverviewPage slug={slug} />;
}
