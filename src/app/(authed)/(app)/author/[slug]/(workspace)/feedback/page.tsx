import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedbackPage } from "@/features/author/components/feedback-page";
import { FEEDBACK_ENABLED } from "@/lib/config";

export const metadata: Metadata = { title: "Feedback" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorFeedback({ params }: PageProps<"/author/[slug]/feedback">) {
  // Hidden until its backend exists (lib/config.ts FEEDBACK_ENABLED, GAP-REPORT.md "Module 1 — Feedback").
  if (!FEEDBACK_ENABLED) notFound();
  const { slug } = await params;
  return <FeedbackPage slug={slug} />;
}
