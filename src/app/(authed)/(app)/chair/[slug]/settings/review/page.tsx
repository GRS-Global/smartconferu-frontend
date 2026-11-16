import type { Metadata } from "next";
import { ReviewSettingsPage } from "@/features/chair/components/review-settings-page";

export const metadata: Metadata = { title: "Review" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairReviewSettings({ params }: PageProps<"/chair/[slug]/settings/review">) {
  const { slug } = await params;
  return <ReviewSettingsPage slug={slug} />;
}
