import type { Metadata } from "next";
import { AuthorPaperPage } from "@/features/author/components/author-paper-page";

export const metadata: Metadata = { title: "Submission" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference", paper: "PAPER-1" }];
}

export default async function AuthorPaper({ params }: PageProps<"/author/[slug]/submissions/[paper]">) {
  const { paper } = await params;
  return <AuthorPaperPage label={decodeURIComponent(paper)} />;
}
