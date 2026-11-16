import type { Metadata } from "next";
import { PublicProfilePage } from "@/features/profile/components/public-profile-page";

export const metadata: Metadata = { title: "Author profile" };

// Any slug is valid (it is matched against the signed-in owner's own profile on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-name" }];
}

export default async function AuthorProfile({ params }: PageProps<"/author/[slug]">) {
  const { slug } = await params;
  return <PublicProfilePage slug={slug} />;
}
