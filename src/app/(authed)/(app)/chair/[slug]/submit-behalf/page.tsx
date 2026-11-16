import type { Metadata } from "next";
import { SubmitPaperPage } from "@/features/author/components/submit-paper-page";

export const metadata: Metadata = { title: "Submit on behalf" };

// Any slug is valid (the conference is read on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function SubmitOnBehalf({ params }: PageProps<"/chair/[slug]/submit-behalf">) {
  const { slug } = await params;
  return <SubmitPaperPage slug={slug} behalf />;
}
