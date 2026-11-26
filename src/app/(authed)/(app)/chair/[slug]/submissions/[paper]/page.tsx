import type { Metadata } from "next";
import { ChairPaperPage } from "@/features/chair/components/chair-paper-page";

export const metadata: Metadata = { title: "Submission" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference", paper: "PAPER-1" }];
}

/** The chair's first page for a paper: the paper itself and the actions on it. Its peer review is ./review. */
export default async function ChairPaper({ params }: PageProps<"/chair/[slug]/submissions/[paper]">) {
  const { paper } = await params;
  return <ChairPaperPage label={decodeURIComponent(paper)} view="details" />;
}
