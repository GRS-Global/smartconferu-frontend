import type { Metadata } from "next";
import { ReviewersPage } from "@/features/chair/components/reviewers-page";

export const metadata: Metadata = { title: "Reviewers" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairReviewers({ params }: PageProps<"/chair/[slug]/peer-review/reviewers">) {
  const { slug } = await params;
  return <ReviewersPage slug={slug} />;
}
