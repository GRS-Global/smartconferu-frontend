"use client";

import { Check, ChevronRight, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CountryFlag } from "@/components/ui/country-flag";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { countryCodeOf } from "@/lib/country-codes";
import { getCfpService } from "@/services/cfps";
import { AuthRequiredError } from "@/services/errors";
import type { CfpRow } from "@/types/cfp";

/* Add a New Call for Papers (the prototype's CreateCFPPage): the conferences this account chairs, each with its CFP's state; "+" starts the CFP: the new-CFP wizard
   (new-cfp-wizard.tsx) for a conference whose CFP has no text yet, its manager for one with a draft, nothing for one that is already published or closed. A
   conference hosted elsewhere has no Smartconferu conference to hold a CFP, so "Add External Conference" is drawn but off. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const showDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—");
type State = { status: "loading" } | { status: "auth" } | { status: "error"; message: string } | { status: "ready"; rows: CfpRow[] };

export function CfpNewPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    getCfpService().then((s) => s.list()).then((rows) => setState({ status: "ready", rows }), (e: unknown) => setState(e instanceof AuthRequiredError ? { status: "auth" } : { status: "error", message: e instanceof Error ? e.message : "Something went wrong." }));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the list once on mount
  useEffect(() => { load(); }, [load]);

  const crumbs = [{ label: "Calls for Papers", href: "/cfp" }, { label: "Add New" }];
  if (state.status === "auth") return <><PageHeader title="Add a New Call for Papers" breadcrumbs={crumbs} /><SessionEnded /></>;
  if (state.status === "loading") return <><PageHeader title="Add a New Call for Papers" breadcrumbs={crumbs} /><div role="status" aria-label="Loading your conferences" className="p-4 sm:p-8"><div className="h-48 animate-pulse rounded-2xl border border-line bg-white" /></div></>;
  if (state.status === "error") return <><PageHeader title="Add a New Call for Papers" breadcrumbs={crumbs} /><div role="alert" className="m-8 flex items-center gap-3 rounded-2xl border border-danger bg-danger-soft p-5 text-sm font-semibold text-danger"><TriangleAlert size={18} aria-hidden="true" /><span className="flex-1">{state.message}</span><button type="button" onClick={load} className="cursor-pointer rounded-lg border border-danger px-3 py-1.5 text-xs font-bold">Try again</button></div></>;

  const rows = state.rows;
  return (
    <>
      <PageHeader title="Add a New Call for Papers" breadcrumbs={crumbs} />
      <div className="p-4 sm:p-8">
        <p className="mb-5 text-sm text-ink-soft">Pick one of your Smartconferu conferences below to start its call for papers, or add one manually for a conference hosted elsewhere (not available yet: a call for papers belongs to a conference on Smartconferu, so create the conference first).</p>
        <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs text-ink-faint">Conference not listed below?</span>
          <button type="button" disabled title="A Call for Papers belongs to a conference on Smartconferu: create the conference first" className="flex shrink-0 cursor-not-allowed items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white opacity-50"><Plus size={16} aria-hidden="true" /> Add External Conference</button>
          <Link href="/create-conference" className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"><Plus size={16} aria-hidden="true" /> Create New Conference</Link>
        </div>
        <div style={CARD} className="overflow-x-auto rounded-2xl bg-white">
          <table className="ui-table w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas">
                {["Acronym", "Name", "Country", "Start Date", "End Date"].map((h) => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-ink-muted">{h}</th>)}
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-muted">Has Draft CFP</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-ink-muted">Add</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-ink-faint">You don&apos;t chair a conference yet.</td></tr>}
              {rows.map((c, i) => {
                const draft = c.status === "draft" && c.hasDraft;
                const taken = c.status !== "draft";
                return (
                  <tr key={c.slug} className={`transition-colors ${i < rows.length - 1 ? "border-b border-muted" : ""}`}>
                    <td className="px-5 py-3.5"><span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{c.acronym}</span></td>
                    <td className="px-5 py-3.5 text-ink">{c.name}</td>
                    <td className="px-5 py-3.5 text-ink-soft"><span className="inline-flex items-center gap-1.5">{c.country && <CountryFlag code={countryCodeOf(c.country) ?? ""} />} {c.country || "—"}</span></td>
                    <td className="px-5 py-3.5 text-ink-muted">{showDate(c.startDate)}</td>
                    <td className="px-5 py-3.5 text-ink-muted">{showDate(c.endDate)}</td>
                    <td className="px-5 py-3.5 text-center">{draft ? <span title="A draft CFP already exists for this conference" className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-[10.5px] font-bold text-warning"><Check size={11} strokeWidth={3} aria-hidden="true" /> Draft</span> : <span className="text-line-strong">—</span>}</td>
                    <td className="px-5 py-3.5 text-center">
                      {taken
                        ? <span aria-label={`${c.acronym} already has a CFP`} title="This conference already has a CFP" className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-lg border-[1.5px] border-line text-line-strong"><Plus size={14} aria-hidden="true" /></span>
                        : <Link href={draft ? `/cfp-manager/${encodeURIComponent(c.slug)}` : `/cfp/new/${encodeURIComponent(c.slug)}`} aria-label={draft ? `Continue draft CFP for ${c.acronym}` : `Add CFP for ${c.acronym}`} title={draft ? "Continue the existing draft" : "Add a new CFP"} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-line text-primary transition-colors hover:border-primary hover:bg-primary-soft"><Plus size={14} aria-hidden="true" /></Link>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Link href="/cfp" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Back to My CFPs <ChevronRight size={14} aria-hidden="true" /></Link>
      </div>
    </>
  );
}
