import type { Metadata } from "next";
import { InitialCheckPage } from "@/features/chair/components/initial-check-page";

export const metadata: Metadata = { title: "Initial Check" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairInitialCheck({ params }: PageProps<"/chair/[slug]/initial-check">) {
  const { slug } = await params;
  return <InitialCheckPage slug={slug} />;
}
