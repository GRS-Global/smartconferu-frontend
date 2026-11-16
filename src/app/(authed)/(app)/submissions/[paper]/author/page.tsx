import type { Metadata } from "next";
import { AuthorPaperPage } from "@/features/author/components/author-paper-page";

export const metadata: Metadata = { title: "Submission" };

// Any label is valid (it is matched against the signed-in user's own papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ paper: "PAPER-1" }];
}

export default async function AuthorPaper({ params }: PageProps<"/submissions/[paper]/author">) {
  const { paper } = await params;
  return <AuthorPaperPage label={decodeURIComponent(paper)} />;
}
