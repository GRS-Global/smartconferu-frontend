import type { Metadata } from "next";
import { AuthorOverviewPage } from "@/features/author/components/author-overview-page";

export const metadata: Metadata = { title: "Dashboard" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorDashboard({ params }: PageProps<"/author/[slug]/dashboard">) {
  const { slug } = await params;
  return <AuthorOverviewPage slug={slug} />;
}
