"use client";
/* Conferences (the prototype's ConferencesPage, database mode): every conference with its chair,
   dates, status; the Deleted tab can bring one back (as archived). License / billing columns are
   left out: the database has no license data yet. */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Library, RotateCcw } from "lucide-react";
import { loadConferences, undeleteConference, type AdminConference, type ConferenceStatus } from "../services";
import { useData } from "../use-data";
import { Avatar, Badge, Button, Card, errorText, Failed, fmtDate, Loading, Modal, PageTitle, SortTh, Toast, Toolbar, type Sort, type Tone } from "./ui";

export const CONF_STATUS: Record<ConferenceStatus, [string, Tone]> = {
  pending_approval: ["Waiting for approval", "warning"],
  active: ["Active", "success"],
  archived: ["Archived", "neutral"],
  rejected: ["Declined", "danger"],
  deleted: ["Deleted", "danger"],
};

type Tab = "all" | ConferenceStatus;
type Key = "conference" | "chair" | "dates" | "status" | "created";

const place = (c: AdminConference) => [c.city, c.country].filter(Boolean).join(", ");

export function ConferencesPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useData(() => loadConferences());
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort<Key>>({ key: "created", dir: "desc" });
  const [bringBack, setBringBack] = useState<AdminConference | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const get: Record<Key, (c: AdminConference) => string> = {
      conference: (c) => c.acronym.toLowerCase(),
      chair: (c) => (c.requester?.name ?? "").toLowerCase(),
      dates: (c) => c.startDate ?? "",
      status: (c) => c.status,
      created: (c) => c.createdAt ?? "",
    };
    return all
      .filter((c) => (tab === "all" ? c.status !== "deleted" : c.status === tab))
      .filter((c) => !q || `${c.title} ${c.acronym} ${c.requester?.name ?? ""} ${place(c)}`.toLowerCase().includes(q))
      .sort((a, b) => get[sort.key](a).localeCompare(get[sort.key](b)) * (sort.dir === "asc" ? 1 : -1));
  }, [all, tab, query, sort]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;

  const count = (t: Tab) => all.filter((c) => (t === "all" ? c.status !== "deleted" : c.status === t)).length;
  const onSort = (key: Key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "created" ? "desc" : "asc" }));
  const th = (label: string, key: Key, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={onSort} className={className} />;

  const confirmBringBack = async () => {
    if (!bringBack) return;
    setBusy(true);
    setActionError(null);
    try {
      await undeleteConference(bringBack.id);
      setToast(`${bringBack.acronym} is back, as archived`);
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
      <Card className="!p-0">
        <Toolbar<Tab>
          tabs={[
            ["all", "All", count("all")],
            ["active", "Active", count("active")],
            ["pending_approval", "Waiting", count("pending_approval")],
            ["archived", "Archived", count("archived")],
            ["rejected", "Declined", count("rejected")],
            ["deleted", "Deleted", count("deleted")],
          ]}
          tab={tab}
          setTab={setTab}
          query={query}
          setQuery={setQuery}
          placeholder="Search conferences"
        />
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                {th("Conference", "conference", "!pl-6")}
                {th("Chair", "chair")}
                {th("Dates", "dates")}
                {th("Status", "status")}
                {th("Created", "created")}
                {tab === "deleted" && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const [label, tone] = CONF_STATUS[c.status] ?? [c.status, "neutral"];
                return (
                  <tr key={c.id} className={tab === "deleted" ? "" : "sa-clickable"} onClick={tab === "deleted" ? undefined : () => router.push(`/super-admin/conferences/${c.id}`)}>
                    <td className="!pl-6">
                      <p className="font-semibold" style={{ color: "var(--text)" }}>
                        {c.acronym}
                      </p>
                      <p className="text-[12.5px] truncate max-w-[320px]" style={{ color: "var(--text-muted)" }}>
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
                    <td>
                      <Badge tone={tone}>{label}</Badge>
                    </td>
                    <td className="text-[13px] whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {fmtDate(c.createdAt)}
                    </td>
                    {tab === "deleted" && (
                      <td className="text-right !pr-6">
                        <Button tone="success" variant="soft" onClick={() => setBringBack(c)}>
                          <RotateCcw size={15} />
                          Bring back
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                    {query ? "No conference matches your search." : "No conferences here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {bringBack && (
        <Modal
          title={`Bring back ${bringBack.acronym}?`}
          onClose={() => setBringBack(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" tone="neutral" onClick={() => setBringBack(null)}>
                Cancel
              </Button>
              <Button tone="success" busy={busy} onClick={() => void confirmBringBack()}>
                Bring back
              </Button>
            </div>
          }
        >
          <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            It returns as <b style={{ color: "var(--text)" }}>archived</b>, with all its papers, reviews and authors. Its chairs can restore it to active from Conference Settings.
          </p>
          {actionError && (
            <p role="alert" className="text-[13px] mt-3" style={{ color: "var(--danger)" }}>
              {actionError}
            </p>
          )}
        </Modal>
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
