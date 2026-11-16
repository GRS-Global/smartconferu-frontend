import type { Metadata } from "next";
import { DecisionSettingsPage } from "@/features/chair/components/decision-settings-page";

export const metadata: Metadata = { title: "Decision" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairDecisionSettings({ params }: PageProps<"/chair/[slug]/settings/decision">) {
  const { slug } = await params;
  return <DecisionSettingsPage slug={slug} />;
}
