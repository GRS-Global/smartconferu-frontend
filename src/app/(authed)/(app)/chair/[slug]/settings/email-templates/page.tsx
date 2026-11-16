import type { Metadata } from "next";
import { EmailTemplatesPage } from "@/features/chair/components/email-templates-page";

export const metadata: Metadata = { title: "Email Templates" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairEmailTemplates({ params }: PageProps<"/chair/[slug]/settings/email-templates">) {
  const { slug } = await params;
  return <EmailTemplatesPage slug={slug} />;
}
