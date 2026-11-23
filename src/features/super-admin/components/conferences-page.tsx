"use client";
/* Conferences (the prototype's ConferencesPage): every conference with its chair, dates, status;
   chairs' deletion requests on top; the Deleted tab lists who asked and why, and can bring one back
   (as archived). License, trial and suspension states need backend work (coming with Billing). */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Library, RotateCcw } from "lucide-react";
import { loadConferences, loadDeletionRequests, undeleteConference, type AdminConference, type ConferenceStatus } from "../services";
import { useData } from "../use-data";
import { DeletionRequestsBanner } from "./deletion-banner";
import { Avatar, Badge, Button, Card, errorText, Failed, fmtDate, Loading, PageTitle, Pagination, SortTh, Toast, Toolbar, usePaging, useSort, type Tone } from "./ui";

export const CONF_STATUS: Record<ConferenceStatus, [string, Tone]> = {
  pending_approval: ["Waiting for approval", "warning"],
  active: ["Active", "success"],
  archived: ["Archived", "warning"],
  rejected: ["Declined", "danger"],
  deleted: ["Deleted", "danger"],
};

/* What the list shows: a live conference is on its trial, past its license, or finished (its dates are over). */
export type ShownStatus = ConferenceStatus | "trial" | "expired" | "finished" | "suspended";
export const SHOWN_STATUS: Record<"trial" | "expired" | "finished" | "suspended", [string, Tone]> = { trial: ["Trial", "warning"], expired: ["Expired", "neutral"], finished: ["Finished", "neutral"], suspended: ["Suspended", "danger"] };
const todayIso = () => new Date().toISOString().slice(0, 10);
export function shownStatus(c: AdminConference): ShownStatus {
  if (c.suspended) return "suspended";
  if (c.status !== "active") return c.status;
  if (c.licenseExpiry < todayIso()) return "expired";
  if (c.endDate && c.endDate.slice(0, 10) < todayIso()) return "finished";
  return c.onTrial ? "trial" : "active";
}
export const statusBadge = (c: AdminConference): [string, Tone] => {
  const s = shownStatus(c);
  return s === "trial" || s === "expired" || s === "finished" || s === "suspended" ? SHOWN_STATUS[s] : CONF_STATUS[s];
};
const daysLeft = (iso: string) => Math.round((new Date(iso).getTime() - new Date(todayIso()).getTime()) / 86_400_000);

type Tab = "all" | ShownStatus;

const place = (c: AdminConference) => [c.city, c.country].filter(Boolean).join(", ");

export function ConferencesPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useData(async () => {
    const [conferences, deletions] = await Promise.all([loadConferences(), loadDeletionRequests().catch(() => [])]);
    return { conferences, deletions };
  });
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [bringBack, setBringBack] = useState<AdminConference | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = useMemo(() => data?.conferences ?? [], [data]);
  const deletions = useMemo(() => data?.deletions ?? [], [data]);
  // Who asked for a deleted conference to go, and when it went.
  const deletedBy = useMemo(() => new Map(deletions.filter((d) => d.status === "approved").map((d) => [d.conferenceId, d])), [deletions]);
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    return all
      .filter((c) => (tab === "all" ? c.status !== "deleted" : shownStatus(c) === tab))
      .filter((c) => !q || `${c.title} ${c.acronym} ${c.requester?.name ?? ""} ${place(c)}`.toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [all, tab, query]);
  const { sorted, sort, toggle } = useSort(rows, {
    conference: { get: (c) => c.acronym },
    chair: { get: (c) => c.requester?.name ?? "" },
    dates: { get: (c) => c.startDate ?? "" },
    papers: { get: (c) => c.papers, first: "desc" },
    license: { get: (c) => c.licenseExpiry },
    status: { get: (c) => shownStatus(c) },
    created: { get: (c) => c.createdAt ?? "", first: "desc" },
  });
  const paging = usePaging(sorted, `${tab}|${query}|${sort.key}|${sort.dir}`);
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;

  const count = (t: Tab) => all.filter((c) => (t === "all" ? c.status !== "deleted" : shownStatus(c) === t)).length;
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;

  const confirmBringBack = async () => {
    if (!bringBack) return;
    setBusy(true);
    setActionError(null);
    try {
      await undeleteConference(bringBack.id);
      setToast(`${bringBack.acronym} is back (archived) — its chair is told`);
      setBringBack(null);
      reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Conferences" description="Every conference on the platform — its status, chair and dates." icon={Library} />
      <div className="mb-6 empty:hidden">
        <DeletionRequestsBanner requests={deletions} />
      </div>
      <Card className="!p-0">
        <Toolbar<Tab>
          tabs={[
            ["all", "All", count("all")],
            ["active", "Active", count("active")],
            ["trial", "Trial", count("trial")],
            ["expired", "Expired", count("expired")],
            ["finished", "Finished", count("finished")],
            ["archived", "Archived", count("archived")],
            ["suspended", "Suspended", count("suspended")],
            ["pending_approval", "Waiting", count("pending_approval")],
            ["rejected", "Declined", count("rejected")],
            ["deleted", "Deleted", count("deleted")],
          ]}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          placeholder="Search conferences"
        />
        {tab === "deleted" ? (
          <div className="overflow-x-auto">
            <table className="sa-table">
              <thead>
                <tr>
                  <th className="!pl-6">Conference</th>
                  <th>Asked by</th>
                  <th>Reason</th>
                  <th>Deleted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paging.rows.map((c) => {
                  const ask = deletedBy.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td className="!pl-6">
                        <p className="font-semibold" style={{ color: "var(--text)" }}>
                          {c.acronym}
                        </p>
                        <p className="text-[12.5px] truncate max-w-[300px]" style={{ color: "var(--text-muted)" }}>
                          {c.title}
                        </p>
                      </td>
                      <td className="whitespace-nowrap">{ask?.requestedBy.name ?? c.requester?.name ?? "—"}</td>
                      <td className="text-[13px] max-w-[280px] truncate" style={{ color: "var(--text-muted)" }}>
                        {ask?.reason ?? "—"}
                      </td>
                      <td className="text-[13px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(ask?.decidedAt)}
                      </td>
                      <td className="text-right !pr-6">
                        <Button tone="success" variant="soft" onClick={() => setBringBack(c)}>
                          <RotateCcw size={15} />
                          Bring back
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                      No deleted conferences.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table">
              <thead>
                <tr>
                  {th("Conference", "conference", "!pl-6")}
                  {th("Chair", "chair")}
                  {th("Dates", "dates")}
                  {th("Papers", "papers")}
                  {th("License", "license")}
                  {th("Status", "status")}
                  {th("Created", "created")}
                </tr>
              </thead>
              <tbody>
                {paging.rows.map((c) => {
                  const [label, tone] = statusBadge(c);
                  const left = daysLeft(c.licenseExpiry);
                  const live = c.status === "active";
                  return (
                    <tr key={c.id} className="sa-clickable cursor-pointer" onClick={() => router.push(`/super-admin/conferences/${c.id}`)}>
                      <td className="!pl-6">
                        <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--text)" }}>
                          {c.acronym}
                        </p>
                        <p className="text-[12.5px] truncate max-w-[300px]" style={{ color: "var(--text-muted)" }}>
                          {c.title}
                          {place(c) && ` · ${place(c)}`}
                        </p>
                      </td>
                      <td>
                        {c.requester ? (
                          <div className="flex items-center gap-2.5">
                            <Avatar name={c.requester.name} size={32} />
                            <span className="whitespace-nowrap">{c.requester.name}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-[13px] whitespace-nowrap">{c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : (c.primaryArea ?? "—")}</td>
                      <td className="font-semibold" style={{ color: "var(--text)" }}>
                        {c.papers}
                      </td>
                      <td className="whitespace-nowrap">
                        {live ? fmtDate(c.licenseExpiry) : "—"}
                        {live && left >= 0 && left <= 7 && (
                          <p className="text-[12px] font-semibold" style={{ color: left <= 3 ? "var(--danger)" : "var(--warning)" }}>
                            {left} days left
                          </p>
                        )}
                      </td>
                      <td>
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      <td className="text-[13px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {fmtDate(c.createdAt)}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                      {query ? "No conference matches your search." : "No conferences here."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination paging={paging} />
      </Card>
      {bringBack && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onKeyDown={(e) => e.key === "Escape" && setBringBack(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(11,16,32,0.45)" }} onClick={() => setBringBack(null)} />
          <div className="relative w-full max-w-[440px] bg-white rounded-2xl p-6 sa-pop" style={{ boxShadow: "var(--shadow-pop)" }} role="dialog" aria-modal="true" aria-labelledby="sa-bringback-title">
            <span className="inline-flex w-11 h-11 rounded-xl items-center justify-center mb-4" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
              <RotateCcw size={22} />
            </span>
            <h2 id="sa-bringback-title" className="text-[19px] font-bold" style={{ color: "var(--text)" }}>
              Bring back {bringBack.acronym}?
            </h2>
            <p className="text-[13.5px] mt-1.5 mb-5" style={{ color: "var(--text-muted)" }}>
              It returns as <b style={{ color: "var(--text)" }}>archived</b>, with all its papers, reviews and authors. {bringBack.requester?.name ?? "Its chair"} is told. They can restore it to active from Conference Settings.
            </p>
            {actionError && (
              <p role="alert" className="text-[13px] -mt-2 mb-4" style={{ color: "var(--danger)" }}>
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button tone="neutral" variant="soft" onClick={() => setBringBack(null)}>
                Cancel
              </Button>
              <Button tone="success" autoFocus busy={busy} onClick={() => void confirmBringBack()}>
                <RotateCcw size={15} />
                Bring back
              </Button>
            </div>
          </div>
        </div>
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
