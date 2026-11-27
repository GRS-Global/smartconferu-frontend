import { Image as ImageIcon } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";
import { FLYER_ENABLED } from "@/lib/config";
import { FlyerAuthorPage } from "@/features/flyer/components/flyer-author-page";

export const metadata: Metadata = { title: "My speaker flyer" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorFlyer({ params }: PageProps<"/author/[slug]/flyer">) {
  const { slug } = await params;
  // Switched off for now (lib/config.ts FLYER_ENABLED).
  if (!FLYER_ENABLED) return <ComingSoonPage title="My flyer" icon={<ImageIcon size={22} aria-hidden="true" />} description="A ready-to-share speaker flyer for every presented paper. We're still building it — it will be here soon." />;
  return <FlyerAuthorPage slug={slug} />;
}
