import type { Metadata } from "next";
import { AuthorActivityLogsPage } from "@/features/chair/components/my-activity-logs-page";

export const metadata: Metadata = { title: "Activity Logs" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorActivityLogs({ params }: PageProps<"/author/[slug]/activity-logs">) {
  const { slug } = await params;
  return <AuthorActivityLogsPage slug={slug} />;
}
