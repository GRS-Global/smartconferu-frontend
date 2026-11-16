import type { Metadata } from "next";
import { ReviewerOverviewPage } from "@/features/reviewer/components/reviewer-overview-page";

export const metadata: Metadata = { title: "Dashboard" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ReviewerOverview({ params }: PageProps<"/reviewer/[slug]/overview">) {
  const { slug } = await params;
  return <ReviewerOverviewPage slug={slug} />;
}
