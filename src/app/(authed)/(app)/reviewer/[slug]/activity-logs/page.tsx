import type { Metadata } from "next";
import { ReviewerActivityLogsPage } from "@/features/chair/components/my-activity-logs-page";

export const metadata: Metadata = { title: "Activity Logs" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ReviewerActivityLogs({ params }: PageProps<"/reviewer/[slug]/activity-logs">) {
  const { slug } = await params;
  return <ReviewerActivityLogsPage slug={slug} />;
}
