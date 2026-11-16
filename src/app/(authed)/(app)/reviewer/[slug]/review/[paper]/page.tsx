import type { Metadata } from "next";
import { ReviewFormPage } from "@/features/reviewer/components/review-form-page";

export const metadata: Metadata = { title: "Review" };

export function generateStaticParams() {
  return [{ slug: "your-conference", paper: "PAPER-1" }];
}

export default async function ReviewPaper({ params }: PageProps<"/reviewer/[slug]/review/[paper]">) {
  const { slug, paper } = await params;
  return <ReviewFormPage slug={slug} label={decodeURIComponent(paper)} />;
}
