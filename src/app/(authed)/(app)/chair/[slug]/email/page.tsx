import type { Metadata } from "next";
import { EmailCommunicationPage } from "@/features/chair/components/email-communication-page";

export const metadata: Metadata = { title: "Email Communication" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairEmailCommunication({ params }: PageProps<"/chair/[slug]/email">) {
  const { slug } = await params;
  return <EmailCommunicationPage slug={slug} />;
}
