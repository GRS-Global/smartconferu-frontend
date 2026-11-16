import type { Metadata } from "next";
import { Suspense } from "react";
import { PeerReviewPage } from "@/features/chair/components/peer-review-page";

export const metadata: Metadata = { title: "Peer Review" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairPeerReview({ params }: PageProps<"/chair/[slug]/peer-review">) {
  const { slug } = await params;
  return <Suspense><PeerReviewPage slug={slug} /></Suspense>;
}
