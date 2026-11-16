import type { Metadata } from "next";
import { AuthorOverviewPage } from "@/features/author/components/author-overview-page";

export const metadata: Metadata = { title: "Dashboard" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorOverview({ params }: PageProps<"/conference/[slug]/author">) {
  const { slug } = await params;
  return <AuthorOverviewPage slug={slug} />;
}
