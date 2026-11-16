"use client";

import { Building2, ChevronRight, PlusCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { AuthRequiredError } from "@/services/errors";
import { getConferenceRequestService } from "@/services/conference-requests";
import type { ConferenceRequest } from "@/types/conference-request";

/* My Requests (the prototype's MyConferenceRequestsPage): the conferences this account asked for that the Super Admin has not approved yet or
   has declined, newest first. A row opens the request (request-detail-page.tsx). An approved one leaves this list and appears under My Conferences. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const STATUS = {
  pending: { label: "Pending Review", color: "var(--warning)", bg: "var(--warning-soft)" },
  rejected: { label: "Rejected", color: "var(--danger)", bg: "var(--danger-soft)" },
} as const;
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

type State = { status: "loading" } | { status: "auth" } | { status: "error"; message: string } | { status: "ready"; rows: ConferenceRequest[] };

export function MyRequestsPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    getConferenceRequestService().then((s) => s.list()).then((rows) => setState({ status: "ready", rows }), (e) => setState(e instanceof AuthRequiredError ? { status: "auth" } : { status: "error", message: e instanceof Error ? e.message : "Something went wrong." }));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the list once on mount
  useEffect(() => { load(); }, [load]);

  const crumbs = [{ label: "Conferences", href: "/dashboard" }, { label: "My Requests" }];
  if (state.status === "auth") return <><PageHeader title="My Requests" breadcrumbs={crumbs} /><SessionEnded /></>;
  if (state.status === "loading") return <><PageHeader title="My Requests" breadcrumbs={crumbs} /><div role="status" aria-label="Loading your requests" className="p-4 sm:p-8"><div className="h-48 animate-pulse rounded-2xl border border-line bg-white" /></div></>;
  if (state.status === "error") return <><PageHeader title="My Requests" breadcrumbs={crumbs} /><div role="alert" className="m-8 flex items-center gap-3 rounded-2xl border border-danger bg-danger-soft p-5 text-sm font-semibold text-danger"><TriangleAlert size={18} aria-hidden="true" /> {state.message}<Button variant="outline" onClick={load} className="ml-auto">Try again</Button></div></>;
  const { rows } = state;
  return (
    <>
      <PageHeader title="My Requests" breadcrumbs={crumbs} />
      <div className="p-4 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-base font-bold text-navy">Conference Requests <span className="font-medium text-ink-faint">({rows.length})</span></h2>
            <p className="text-sm text-ink-muted">Requests to host a new conference on Smartconferu. Click a row to view its details, check on its status, or cancel it.</p>
          </div>
          <Link href="/create-conference" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"><PlusCircle size={16} aria-hidden="true" /> Create New Conference</Link>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-xl border-[1.5px] border-dashed border-primary bg-primary-soft p-10 text-center">
            <Building2 size={26} className="mx-auto mb-3 text-primary" aria-hidden="true" />
            <p className="mb-1 text-sm font-semibold text-navy">You haven&apos;t requested a new conference yet</p>
            <p className="mb-4 text-xs text-ink-muted">Request one to start hosting a call for papers and submissions on Smartconferu.</p>
            <Link href="/create-conference" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"><PlusCircle size={16} aria-hidden="true" /> Create your first request</Link>
          </div>
        ) : (
          <div style={CARD} className="overflow-x-auto rounded-2xl bg-white">
            <table className="ui-table w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas">{["Acronym", "Title", "Submitted", "Status"].map((h) => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-ink-muted">{h}</th>)}<th className="px-5 py-3" /></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const cfg = STATUS[r.status];
                  return (
                    <tr key={r.id} tabIndex={0} role="link" aria-label={`Open the request for ${r.acronym || r.title}`} onClick={() => router.push(`/my-requests/${encodeURIComponent(r.id)}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/my-requests/${encodeURIComponent(r.id)}`); }} className={`cursor-pointer transition-colors ${i < rows.length - 1 ? "border-b border-muted" : ""}`}>
                      <td className="px-5 py-4"><span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{r.acronym || "—"}</span></td>
                      <td className="px-5 py-4"><span className="font-semibold text-ink">{r.title || "—"}</span>{r.status === "rejected" && r.decidedNote && <span className="mt-0.5 block text-xs text-ink-muted">“{r.decidedNote}”</span>}</td>
                      <td className="px-5 py-4 text-ink-muted">{showDate(r.submittedAt)}</td>
                      <td className="px-5 py-4"><span style={{ background: cfg.bg, color: cfg.color }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><span style={{ background: cfg.color }} className="h-1.5 w-1.5 rounded-full" />{cfg.label}</span></td>
                      <td className="px-5 py-4 text-right"><ChevronRight size={16} className="text-ink-faint" aria-hidden="true" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
