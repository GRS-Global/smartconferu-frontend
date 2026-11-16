import type { Metadata } from "next";
import { Suspense } from "react";
import { PeerReviewManagePage } from "@/features/chair/components/peer-review-manage-page";

export const metadata: Metadata = { title: "Peer Review" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairPeerReviewManage({ params }: PageProps<"/chair/[slug]/peer-review/manage">) {
  const { slug } = await params;
  return <Suspense><PeerReviewManagePage slug={slug} /></Suspense>;
}
