import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackPage } from "@/features/author/components/feedback-page";
import { BackLinks } from "@/features/workspace/components/workspace-gate";
import { FEEDBACK_ENABLED } from "@/lib/config";

export const metadata: Metadata = { title: "Feedback" };

// Any slug is valid (it is matched against the signed-in user's own conferences on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ slug: "your-conference" }];
}

export default async function AuthorFeedback({ params }: PageProps<"/author/[slug]/feedback">) {
  // Read the params first, as every workspace page does: a page that never awaits them is rendered fully static, and the client-only
  // workspace layout then stops `next build` ("client rendering was requested outside a Suspense boundary").
  const { slug } = await params;
  // Hidden until its backend exists (lib/config.ts FEEDBACK_ENABLED, GAP-REPORT.md "Module 1 — Feedback").
  if (!FEEDBACK_ENABLED) {
    return (
      <div className="p-4 sm:p-8">
        <div className="max-w-4xl rounded-2xl border border-line bg-white">
          <EmptyState icon={TriangleAlert} title="This page isn't available." description="Feedback isn't open yet." action={<BackLinks />} />
        </div>
      </div>
    );
  }
  return <FeedbackPage slug={slug} />;
}
