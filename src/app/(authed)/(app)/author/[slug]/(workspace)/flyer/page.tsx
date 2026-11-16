import type { Metadata } from "next";
import { FlyerAuthorPage } from "@/features/flyer/components/flyer-author-page";

export const metadata: Metadata = { title: "My speaker flyer" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorFlyer({ params }: PageProps<"/author/[slug]/flyer">) {
  const { slug } = await params;
  return <FlyerAuthorPage slug={slug} />;
}
