import type { Metadata } from "next";
import { ChairPaperPage } from "@/features/chair/components/chair-paper-page";

export const metadata: Metadata = { title: "Peer Review" };

// Any label is valid (it is matched against the papers the signed-in user chairs on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ paper: "PAPER-1" }];
}

/** The chair's second page for a paper (the prototype's /submissions/:id/chair/review): its reviewers, their reviews and the decision. */
export default async function ChairPaperReview({ params }: PageProps<"/submissions/[paper]/chair/review">) {
  const { paper } = await params;
  return <ChairPaperPage label={decodeURIComponent(paper)} view="review" />;
}
