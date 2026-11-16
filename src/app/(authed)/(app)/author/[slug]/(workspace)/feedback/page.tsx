import type { Metadata } from "next";
import { FeedbackPage } from "@/features/author/components/feedback-page";

export const metadata: Metadata = { title: "Feedback" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorFeedback({ params }: PageProps<"/author/[slug]/feedback">) {
  const { slug } = await params;
  return <FeedbackPage slug={slug} />;
}
