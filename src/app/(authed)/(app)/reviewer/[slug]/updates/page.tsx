import type { Metadata } from "next";
import { ConferenceUpdatesPage } from "@/features/notifications/components/conference-updates-page";

export const metadata: Metadata = { title: "Updates" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ReviewerUpdates({ params }: PageProps<"/reviewer/[slug]/updates">) {
  const { slug } = await params;
  return <ConferenceUpdatesPage slug={slug} role="reviewer" />;
}
