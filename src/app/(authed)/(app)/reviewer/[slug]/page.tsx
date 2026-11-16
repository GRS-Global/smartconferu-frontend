import type { Metadata } from "next";
import { ReviewerOverviewPage } from "@/features/reviewer/components/reviewer-overview-page";

export const metadata: Metadata = { title: "Dashboard" };

// The prototype's /reviewer/<conference> is the same page as /reviewer/<conference>/overview.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ReviewerPapers({ params }: PageProps<"/reviewer/[slug]">) {
  const { slug } = await params;
  return <ReviewerOverviewPage slug={slug} />;
}
