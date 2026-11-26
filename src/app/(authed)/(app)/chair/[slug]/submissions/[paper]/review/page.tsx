import type { Metadata } from "next";
import { ChairPaperPage } from "@/features/chair/components/chair-paper-page";

export const metadata: Metadata = { title: "Peer Review" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference", paper: "PAPER-1" }];
}

/** The chair's second page for a paper: its reviewers, their reviews and the decision. */
export default async function ChairPaperReview({ params }: PageProps<"/chair/[slug]/submissions/[paper]/review">) {
  const { paper } = await params;
  return <ChairPaperPage label={decodeURIComponent(paper)} view="review" />;
}
