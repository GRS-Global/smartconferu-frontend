import type { Metadata } from "next";
import { PlagiarismDetailPage } from "@/features/chair/components/plagiarism-detail-page";

export const metadata: Metadata = { title: "Plagiarism Check" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference", paper: "PAPER-1" }];
}

export default async function ChairPlagiarismPaper({ params }: PageProps<"/chair/[slug]/plagiarism/[paper]">) {
  const { slug, paper } = await params;
  return <PlagiarismDetailPage slug={slug} paperLabel={decodeURIComponent(paper)} />;
}
