import type { Metadata } from "next";
import { SubmissionSettingsPage } from "@/features/chair/components/submission-settings-page";

export const metadata: Metadata = { title: "Submissions" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairSubmissionSettings({ params }: PageProps<"/chair/[slug]/settings/submissions">) {
  const { slug } = await params;
  return <SubmissionSettingsPage slug={slug} />;
}
