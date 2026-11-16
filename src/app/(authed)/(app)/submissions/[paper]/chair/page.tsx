import type { Metadata } from "next";
import { ChairPaperPage } from "@/features/chair/components/chair-paper-page";

export const metadata: Metadata = { title: "Submission" };

// Any label is valid (it is matched against the papers the signed-in user chairs on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ paper: "PAPER-1" }];
}

/** The chair's first page for a paper: the paper itself and the actions on it. Its peer review is /chair/review. */
export default async function ChairPaper({ params }: PageProps<"/submissions/[paper]/chair">) {
  const { paper } = await params;
  return <ChairPaperPage label={decodeURIComponent(paper)} view="details" />;
}
