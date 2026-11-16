import type { Metadata } from "next";
import { ChairAddReviewPage } from "@/features/chair/components/chair-add-review-page";

export const metadata: Metadata = { title: "Add your review" };

// Any label is valid (it is matched against the papers the signed-in user chairs on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ paper: "PAPER-1" }];
}

/** The chair's own review of a paper (the prototype's /submissions/:id/chair/review/add). */
export default async function ChairAddReview({ params }: PageProps<"/submissions/[paper]/chair/review/add">) {
  const { paper } = await params;
  return <ChairAddReviewPage label={decodeURIComponent(paper)} />;
}
