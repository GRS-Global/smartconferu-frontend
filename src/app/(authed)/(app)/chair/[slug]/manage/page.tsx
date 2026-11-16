import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionsManagePage } from "@/features/chair/components/submissions-manage-page";

export const metadata: Metadata = { title: "Submissions" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function ChairSubmissionsManage({ params }: PageProps<"/chair/[slug]/manage">) {
  const { slug } = await params;
  return <Suspense><SubmissionsManagePage slug={slug} /></Suspense>;
}
