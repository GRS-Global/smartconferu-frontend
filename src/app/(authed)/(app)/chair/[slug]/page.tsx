import type { Metadata } from "next";
import { ChairSubmissionsPage } from "@/features/chair/components/chair-submissions-page";

export const metadata: Metadata = { title: "Submissions" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairSubmissions({ params }: PageProps<"/chair/[slug]">) {
  const { slug } = await params;
  return <ChairSubmissionsPage slug={slug} />;
}
