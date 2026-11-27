"use client";
/* Audit Log (the prototype's AuditLogPage): everything recorded on the platform, newest first, with
   Who / From / To / search filters (done by the API), "N entries", sortable columns, "Load more",
   and Export CSV of exactly what is filtered (every page, in the order shown). */
import { useEffect, useMemo, useState } from "react";
import { Download, ScrollText, Search } from "lucide-react";
import { loadActivity, type ActivityEntry } from "../services";
import { activityText } from "./activity";
import { Avatar, Button, Card, errorText, fmtDate, Loading, PageTitle, SortTh, useSort } from "./ui";

const BOM = String.fromCharCode(0xfeff); // so Excel reads the CSV as UTF-8
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const PAGE = 100;
const EXPORT_MAX = 5000;
const dateOf = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

export function AuditLogPage() {
  const [who, setWho] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Everyone who appears in what was loaded, for the Who filter (kept across filter changes).
  const [actors, setActors] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filters = useMemo(() => ({ actorId: who === "all" ? undefined : who, from: from || undefined, to: to || undefined, q: q || undefined }), [who, from, to, q]);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new filter starts a fresh list
    setLoading(true);
    loadActivity({ ...filters, limit: PAGE })
      .then((page) => {
        if (!live) return;
        setRows(page.data);
        setNext(page.nextBefore);
        setError(null);
        setActors((m) => {
          const n = new Map(m);
          page.data.forEach((a) => a.actor && n.set(a.actor.id, a.actor.name));
          return n;
        });
      })
      .catch((e: unknown) => live && setError(errorText(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [filters]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const page = await loadActivity({ ...filters, limit: PAGE, before: next });
      setRows((r) => [...r, ...page.data]);
      setNext(page.nextBefore);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setMore(false);
    }
  };

  const { sorted, sort, toggle } = useSort(rows, {
    when: { get: (a) => a.occurredAt, first: "desc" },
    who: { get: (a) => a.actor?.name ?? "" },
    what: { get: (a) => activityText(a) },
  });
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;

  // Exactly what's filtered, in the order shown, as a spreadsheet-friendly CSV.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = [...rows];
      let before = next;
      while (before && all.length < EXPORT_MAX) {
        const page = await loadActivity({ ...filters, limit: PAGE, before });
        all.push(...page.data);
        before = page.nextBefore;
      }
      const order = sort.key ? sorted.map((a) => a.id) : [];
      const ordered = order.length === all.length ? sorted : all;
      const lines = [["Date", "Time", "Who", "What", "Action"], ...ordered.map((a) => [dateOf(a.occurredAt).date, dateOf(a.occurredAt).time, a.actor?.name ?? "System", activityText(a), a.action])].map((r) => r.map(csvCell).join(","));
      const url = URL.createObjectURL(new Blob([`${BOM}${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: `smartconferu-audit-log-${new Date().toISOString().slice(0, 10)}.csv` });
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setExporting(false);
    }
  };

  const label = "block text-[12px] font-semibold mb-1";
  return (
    <>
      <PageTitle title="Audit Log" icon={ScrollText} />
      <Card className="!p-0">
        <div className="flex flex-wrap items-end gap-3 px-6 pt-5 pb-4">
          <label className="block min-w-0 max-w-full">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              Who
            </span>
            <select className="sa-input !w-auto max-w-full cursor-pointer" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Everyone</option>
              {[...actors.entries()]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block min-w-0 max-w-full">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              From
            </span>
            <input type="date" className="sa-input !w-auto" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block min-w-0 max-w-full">
            <span className={label} style={{ color: "var(--text-muted)" }}>
              To
            </span>
            <input type="date" className="sa-input !w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search what happened" aria-label="Search what happened" className="sa-input !pl-9" />
          </label>
          <Button tone="primary" variant="soft" busy={exporting} onClick={() => void exportCsv()} disabled={!rows.length}>
            <Download size={15} />
            Export CSV
          </Button>
        </div>
        <p className="px-6 pb-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {loading ? "Loading…" : `${rows.length}${next ? "+" : ""} ${rows.length === 1 ? "entry" : "entries"}`}
        </p>
        {error && (
          <p role="alert" className="px-6 pb-3 text-[13px]" style={{ color: "var(--danger-ink)" }}>
            {error}
          </p>
        )}
        {loading && rows.length === 0 ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="sa-table">
              <thead>
                <tr>
                  {th("When", "when", "!pl-6")}
                  {th("Who", "who")}
                  {th("What", "what")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id}>
                    <td className="!pl-6 whitespace-nowrap">
                      {fmtDate(a.occurredAt)} · {dateOf(a.occurredAt).time}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.actor?.name ?? "System"} size={30} />
                        <span className="whitespace-nowrap">{a.actor?.name ?? "System"}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--text)" }}>{activityText(a)}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={3} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                      Nothing matches these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {next && (
          <div className="flex justify-center p-4" style={{ borderTop: "1px solid var(--border)" }}>
            <Button variant="soft" busy={more} onClick={() => void loadMore()}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
