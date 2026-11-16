import type { Metadata } from "next";
import { PlagiarismCheckPage } from "@/features/chair/components/plagiarism-check-page";

export const metadata: Metadata = { title: "Plagiarism Check" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairPlagiarism({ params }: PageProps<"/chair/[slug]/plagiarism">) {
  const { slug } = await params;
  return <PlagiarismCheckPage slug={slug} />;
}
