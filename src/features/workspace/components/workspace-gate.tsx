"use client";

import { Home, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";

/** The way out of a "not found" / error screen: My Conferences and the home page (and, when given, "Try again"). */
export function BackLinks({ retry }: { retry?: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {retry && <Button size="sm" onClick={retry}>Try again</Button>}
      <Link href="/dashboard" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary-hover">My Conferences</Link>
      <Link href="/" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-navy transition-colors hover:bg-canvas"><Home size={13} aria-hidden="true" /> Home</Link>
    </div>
  );
}

/** What a workspace page shows before its data is ready: the loading skeleton, "signed out", or the error / "not found" message.
 *  Returns null once the page has its data. One place for the states every workspace page has (the same look as the Author pages). */
export function workspaceGate(
  state: { status: string; message?: string; config?: boolean },
  retry: () => void,
  { title, loadingLabel, missingTitle, missingText, errorTitle }: { title: string; loadingLabel: string; missingTitle: string; missingText: string; errorTitle: string },
): ReactNode {
  if (state.status === "loading") {
    return (
      <>
        <PageHeader title={title} />
        <div role="status" aria-label={loadingLabel} className="space-y-4 p-4 sm:p-8">
          <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
          <div className="h-60 animate-pulse rounded-2xl border border-line bg-white" />
        </div>
      </>
    );
  }
  if (state.status === "auth") {
    return (
      <>
        <PageHeader title={title} />
        <div role="status" aria-label={loadingLabel} className="p-4 sm:p-8"><div className="h-60 animate-pulse rounded-2xl border border-line bg-white" /></div>
        <SessionEnded onRecovered={retry} />
      </>
    );
  }
  if (state.status === "error" || state.status === "missing") {
    const missing = state.status === "missing";
    return (
      <>
        <PageHeader title={title} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: title }]} />
        <div className="p-4 sm:p-8">
          <div className="max-w-4xl rounded-2xl border border-line bg-white">
            <EmptyState
              icon={TriangleAlert}
              title={missing ? missingTitle : state.config ? "The database connection isn't set up." : errorTitle}
              description={missing ? missingText : state.message}
              action={<BackLinks retry={missing || state.config ? undefined : retry} />}
            />
          </div>
        </div>
      </>
    );
  }
  return null;
}
