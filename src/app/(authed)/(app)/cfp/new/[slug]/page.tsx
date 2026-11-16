import type { Metadata } from "next";
import { NewCfpWizard } from "@/features/cfp/components/new-cfp-wizard";

export const metadata: Metadata = { title: "New Call for Papers" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function NewCfpFor({ params }: PageProps<"/cfp/new/[slug]">) {
  const { slug } = await params;
  return <NewCfpWizard slug={slug} />;
}
