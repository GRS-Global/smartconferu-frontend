import type { Metadata } from "next";
import { MySubmissionsPage } from "@/features/author/components/my-submissions-page";

export const metadata: Metadata = { title: "My Submissions" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function MySubmissions({ params }: PageProps<"/author/[slug]/submissions">) {
  const { slug } = await params;
  return <MySubmissionsPage slug={slug} />;
}
