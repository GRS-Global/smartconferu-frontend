import type { Metadata } from "next";
import { ConferenceDetailsPage } from "@/features/chair/components/conference-details-page";

export const metadata: Metadata = { title: "Conference Details" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairConferenceDetails({ params }: PageProps<"/chair/[slug]/settings">) {
  const { slug } = await params;
  return <ConferenceDetailsPage slug={slug} />;
}
