import type { Metadata } from "next";
import { FlyerPage } from "@/features/flyer/components/flyer-page";

export const metadata: Metadata = { title: "Speaker flyer" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairFlyer({ params }: PageProps<"/chair/[slug]/flyer">) {
  const { slug } = await params;
  return <FlyerPage slug={slug} />;
}
