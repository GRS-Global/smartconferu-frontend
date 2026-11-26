import type { Metadata } from "next";
import { CfpManagerPage } from "@/features/cfp/components/cfp-manager-page";

export const metadata: Metadata = { title: "CFP Manager" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairCfp({ params }: PageProps<"/chair/[slug]/cfp">) {
  const { slug } = await params;
  return <CfpManagerPage slug={slug} />;
}
