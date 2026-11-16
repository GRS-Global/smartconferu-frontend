import { TriangleAlert } from "lucide-react";
import { PageHeader, type Crumb } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/* Loading and "couldn't load" states of the account pages (My Receipts, Watchlist, Preprints, Slides, Publish with Us). */

export function PageLoading({ title, label, breadcrumbs }: { title: string; label: string; breadcrumbs?: Crumb[] }) {
  return (
    <>
      <PageHeader title={title} breadcrumbs={breadcrumbs} />
      <div role="status" aria-label={label} className="p-4 sm:p-8"><div className="h-64 animate-pulse rounded-2xl border border-line bg-white" /></div>
    </>
  );
}

export function PageProblem({ title, heading, message, onRetry, breadcrumbs }: { title: string; heading: string; message: string; onRetry: () => void; breadcrumbs?: Crumb[] }) {
  return (
    <>
      <PageHeader title={title} breadcrumbs={breadcrumbs} />
      <div className="p-4 sm:p-8">
        <div className="rounded-2xl border border-line bg-white">
          <EmptyState icon={TriangleAlert} title={heading} description={message} action={<Button size="sm" onClick={onRetry}>Try again</Button>} />
        </div>
      </div>
    </>
  );
}
