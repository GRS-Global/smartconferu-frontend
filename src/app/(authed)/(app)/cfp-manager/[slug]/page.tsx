import type { Metadata } from "next";
import { CfpManagerPage } from "@/features/cfp/components/cfp-manager-page";

export const metadata: Metadata = { title: "CFP Manager" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function CfpManager({ params }: PageProps<"/cfp-manager/[slug]">) {
  const { slug } = await params;
  return <CfpManagerPage slug={slug} />;
}
