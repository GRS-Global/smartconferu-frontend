import type { Metadata } from "next";
import { PublicCfpPage } from "@/features/cfp/components/public-cfp-page";

export const metadata: Metadata = { title: "Call for Papers" };

// Any page address is valid (the CFP is looked up on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ page: "your-cfp" }];
}

export default async function PublicCfp({ params }: PageProps<"/cfp/[page]">) {
  const { page } = await params;
  return <PublicCfpPage page={page} />;
}
