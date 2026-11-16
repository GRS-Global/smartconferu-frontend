import type { Metadata } from "next";
import { InitialCheckDetailPage } from "@/features/chair/components/initial-check-detail-page";

export const metadata: Metadata = { title: "Initial Check" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference", paper: "PAPER-1" }];
}

export default async function ChairInitialCheckPaper({ params }: PageProps<"/chair/[slug]/initial-check/[paper]">) {
  const { slug, paper } = await params;
  return <InitialCheckDetailPage slug={slug} paperLabel={decodeURIComponent(paper)} />;
}
