"use client";

import { PlusCircle, Send, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SessionEnded } from "@/features/auth/components/session-ended";
import Link from "next/link";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import type { CfpRow } from "@/types/cfp";
import { cfpManagerHref } from "@/lib/routes";

/* My CFP (the prototype's CFPListPage): the Calls for Papers of the conferences this account chairs or manages, with where each one stands.
   The acronym opens that CFP's manager (/chair/<conference>/cfp). The CFP of a conference is its own row in the database, so there is no
   such thing as a CFP without a conference; "Create New CFP" opens the list of conferences to start one for (cfp-new-page.tsx). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
/** The prototype's CFP_STATUS_CONFIG (its "Active" state has no counterpart in the database). */
const STATUS = {
  draft: { label: "Unpublished draft", color: "var(--ink-muted)", bg: "var(--muted)" },
  review: { label: "Awaiting approval", color: "var(--warning-ink)", bg: "var(--warning-soft)" },
  published: { label: "Published", color: "var(--primary)", bg: "var(--primary-soft)" },
  closed: { label: "Closed", color: "var(--danger-ink)", bg: "var(--danger-soft)" },
} as const;
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");
const openHref = (r: CfpRow) => cfpManagerHref(r.slug);

type State = { status: "loading" } | { status: "auth" } | { status: "error"; message: string } | { status: "ready"; rows: CfpRow[] };

export function CfpListPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    getCfpService().then((s) => s.list()).then((rows) => setState({ status: "ready", rows }), (e: unknown) => setState(e instanceof AuthRequiredError ? { status: "auth" } : { status: "error", message: e instanceof Error ? e.message : "Something went wrong." }));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the list once on mount
  useEffect(() => { load(); }, [load]);

  const crumbs = [{ label: "Calls for Papers" }];
  if (state.status === "auth") return <><PageHeader title="Calls for Papers" breadcrumbs={crumbs} /><SessionEnded /></>;
  if (state.status === "loading") return <><PageHeader title="Calls for Papers" breadcrumbs={crumbs} /><div role="status" aria-label="Loading your Calls for Papers" className="p-4 sm:p-8"><div className="h-48 animate-pulse rounded-2xl border border-line bg-white" /></div></>;
  if (state.status === "error") return <><PageHeader title="Calls for Papers" breadcrumbs={crumbs} /><div role="alert" className="m-8 flex items-center gap-3 rounded-2xl border border-danger bg-danger-soft p-5 text-sm font-semibold text-danger-ink"><TriangleAlert size={18} aria-hidden="true" /><span className="flex-1">{state.message}</span><button type="button" onClick={load} className="cursor-pointer rounded-lg border border-danger px-3 py-1.5 text-xs font-bold">Try again</button></div></>;

  const rows = state.rows;
  const create = "/cfp/new";
  return (
    <>
      <PageHeader title="Calls for Papers" breadcrumbs={crumbs} />
      <div className="p-4 sm:p-8">
        <div className="mb-6 max-w-3xl rounded-xl border border-line bg-canvas p-5">
          <p className="text-sm leading-relaxed text-ink-soft">Publish a call for papers to advertise your conference, invite submissions, and share key dates with prospective authors.</p>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            {Object.values(STATUS).map((c) => (
              <div key={c.label} className="flex items-center gap-1.5"><span style={{ background: c.color }} className="h-2 w-2 shrink-0 rounded-full" /><span className="text-xs font-medium text-ink-muted">{c.label}</span></div>
            ))}
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-navy">My CFPs <span className="font-medium text-ink-faint">({rows.length})</span></h2>
          <Link href={create} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"><PlusCircle size={16} aria-hidden="true" /> Create New CFP</Link>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border-[1.5px] border-dashed border-primary bg-primary-soft p-10 text-center">
            <Send size={26} className="mx-auto mb-3 text-primary" aria-hidden="true" />
            <p className="mb-1 text-sm font-semibold text-navy">You haven&apos;t created a call for papers yet</p>
            <p className="mb-4 text-xs text-ink-muted">Publish a CFP to start collecting submissions for your conference.</p>
            <Link href={create} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"><PlusCircle size={16} aria-hidden="true" /> Create your first CFP</Link>
          </div>
        ) : (
          <div style={CARD} className="overflow-x-auto rounded-2xl bg-white">
            <table className="ui-table w-full text-sm" style={{ tableLayout: "fixed", minWidth: 920 }}>
              <colgroup><col style={{ width: "5%" }} /><col style={{ width: "13%" }} /><col style={{ width: "27%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "10%" }} /><col style={{ width: "11%" }} /><col style={{ width: "10%" }} /></colgroup>
              <thead>
                <tr className="border-b border-line bg-canvas">
                  {["ID", "Acronym", "Name", "Type", "Status", "Submissions", "Start Date", "Deadline"].map((h) => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-ink-muted">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const cfg = STATUS[r.status];
                  return (
                    <tr key={r.slug} className={`transition-colors hover:bg-canvas ${i < rows.length - 1 ? "border-b border-muted" : ""}`}>
                      <td className="px-5 py-4 text-ink-faint">{i + 1}</td>
                      <td className="px-5 py-4"><Link href={openHref(r)} aria-label={`Open the Call for Papers of ${r.acronym}`} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary hover:underline">{r.acronym}</Link></td>
                      <td className="px-5 py-4 text-ink"><span title={r.name} className="block truncate font-semibold">{r.name}</span></td>
                      <td className="px-5 py-4 text-ink-muted">Conference</td>
                      <td className="px-5 py-4"><span style={{ color: cfg.color, background: cfg.bg }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"><span style={{ background: cfg.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" />{cfg.label}</span></td>
                      <td className="px-5 py-4 text-ink-muted">{r.submissions > 0 ? r.submissions : "—"}</td>
                      <td className="px-5 py-4 text-ink-muted">{showDate(r.startDate)}</td>
                      <td className="px-5 py-4 text-ink-muted">{showDate(r.deadline)}</td>
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
