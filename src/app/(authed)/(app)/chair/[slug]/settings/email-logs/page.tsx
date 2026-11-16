import type { Metadata } from "next";
import { EmailLogsPage } from "@/features/chair/components/email-logs-page";

export const metadata: Metadata = { title: "Email Logs" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairEmailLogs({ params }: PageProps<"/chair/[slug]/settings/email-logs">) {
  const { slug } = await params;
  return <EmailLogsPage slug={slug} />;
}
