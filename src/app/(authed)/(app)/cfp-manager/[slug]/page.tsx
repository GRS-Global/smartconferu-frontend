import type { Metadata } from "next";
import { LegacyRedirect } from "@/components/legacy-redirect";

export const metadata: Metadata = { title: "CFP Manager" };

// Any slug / label is valid (they are matched against the signed-in user's own conferences and papers on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

/** The older address: moves to /chair/<conference>/cfp. */
export default async function Legacy({ params }: PageProps<"/cfp-manager/[slug]">) {
  const { slug } = await params;
  return <LegacyRedirect to={`/chair/${encodeURIComponent(slug)}/cfp`} />;
}
