import type { Metadata } from "next";
import { MyReviewsPage } from "@/features/reviewer/components/my-reviews-page";

export const metadata: Metadata = { title: "My Reviews" };

export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function MyReviews({ params }: PageProps<"/reviewer/[slug]/reviews">) {
  const { slug } = await params;
  return <MyReviewsPage slug={slug} />;
}
