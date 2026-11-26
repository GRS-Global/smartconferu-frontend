import type { Metadata } from "next";
import { ChairAddReviewPage } from "@/features/chair/components/chair-add-review-page";

export const metadata: Metadata = { title: "Add your review" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference", paper: "PAPER-1" }];
}

/** The chair's own review of a paper. */
export default async function ChairAddReview({ params }: PageProps<"/chair/[slug]/submissions/[paper]/review/add">) {
  const { paper } = await params;
  return <ChairAddReviewPage label={decodeURIComponent(paper)} />;
}
