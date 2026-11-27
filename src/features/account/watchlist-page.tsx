/* eslint-disable react/no-unescaped-entities -- the page text is the prototype's, word for word */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronsUpDown, ChevronUp, Plus, Search, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getAccountExtrasService } from "@/services/account-extras";
import type { WatchedCfp } from "@/types/account";
import { PageLoading, PageProblem } from "./page-states";

/* My CFP Watchlist (the prototype's WatchlistPage): conferences kept an eye on for their submission deadline, sortable, with a search to add another
   and a bulk remove. The list is the person's own (cfp_watchlist, migration 0050); a conference's name, place, dates and topics come from the
   conference itself, and the acronym opens its public Call for Papers page. */

const CFP_TOPIC_COLORS = [
  { bg: "var(--primary-soft)", color: "var(--primary)" },
  { bg: "var(--secondary-soft)", color: "var(--secondary)" },
  { bg: "var(--success-soft)", color: "var(--success-ink)" },
  { bg: "var(--warning-soft-2)", color: "var(--warning-ink)" },
];

const formatDisplayDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

function WatchlistSortHeader({ field, label, sortField, sortAsc, onSort }: { field: string; label: string; sortField: string; sortAsc: boolean; onSort: (f: string) => void }) {
  return (
    <th
      onClick={() => onSort(field)}
      style={{ color: "var(--ink-muted)" }}
      className="text-left font-semibold text-xs px-4 py-3 cursor-pointer select-none hover:text-[var(--primary)] transition-colors whitespace-nowrap"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronsUpDown size={12} style={{ color: "var(--border-strong)" }} />
        )}
      </span>
    </th>
  );
}

export function WatchlistPage() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<WatchedCfp[] | null>(null);
  const [problem, setProblem] = useState("");
  const [note, setNote] = useState("");
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState("submissionDeadline");
  const [sortAsc, setSortAsc] = useState(true);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<WatchedCfp[]>([]);
  const crumbs = [{ label: "Dashboard", href: "/dashboard" }, { label: "Watchlist" }];

  useEffect(() => {
    let alive = true;
    getAccountExtrasService().then((svc) => svc.watchlist()).then(
      (r) => { if (alive) { setWatchlist(r); setProblem(""); } },
      (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : "Something went wrong."); },
    );
    return () => { alive = false; };
  }, [tick]);

  // The Calls for Papers matching what was typed (not already on the list), after a short pause in typing.
  const onList = (watchlist ?? []).map((w) => w.slug).join(",");
  useEffect(() => {
    const q = query.trim();
    if (!q) return undefined;
    let alive = true;
    const t = window.setTimeout(() => {
      getAccountExtrasService().then((svc) => svc.searchCfps(q, onList.split(",").filter(Boolean))).then((r) => { if (alive) setFound(r); }, () => { if (alive) setFound([]); });
    }, 250);
    return () => { alive = false; window.clearTimeout(t); };
  }, [query, onList]);

  if (problem) return <PageProblem title="My CFP Watchlist" heading="Couldn't load your watchlist." message={problem} onRetry={() => { setProblem(""); setTick((t) => t + 1); }} breadcrumbs={crumbs} />;
  const searchResults = query.trim() ? found : [];
  if (!watchlist) return <PageLoading title="My CFP Watchlist" label="Loading your watchlist" breadcrumbs={crumbs} />;

  const sorted = [...(watchlist ?? [])].sort((a, b) => {
    let av: string, bv: string;
    if (sortField === "acronym") { av = a.acronym; bv = b.acronym; }
    else if (sortField === "endDate") { av = a.endDate || ""; bv = b.endDate || ""; }
    else { av = a.submissionDeadline || ""; bv = b.submissionDeadline || ""; }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc((a) => !a);
    else { setSortField(field); setSortAsc(true); }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const toggleRow = (slug: string) => setSelected((s) => ({ ...s, [slug]: !s[slug] }));
  const removeSelected = async () => {
    const slugs = Object.keys(selected).filter((k) => selected[k]);
    try {
      await (await getAccountExtrasService()).removeFromWatchlist(slugs);
      setWatchlist((list) => (list ?? []).filter((w) => !slugs.includes(w.slug)));
      setSelected({});
      setNote("");
    } catch (e) { setNote(e instanceof Error ? e.message : "We couldn't update your watchlist."); }
  };

  const addToWatchlist = async (conf: WatchedCfp) => {
    try {
      await (await getAccountExtrasService()).addToWatchlist(conf.slug);
      setWatchlist((list) => [...(list ?? []), conf]);
      setQuery("");
      setNote("");
    } catch (e) { setNote(e instanceof Error ? e.message : "We couldn't add that to your watchlist."); }
  };

  return (
    <div>
      <PageHeader title="My CFP Watchlist" breadcrumbs={crumbs} />
      <div className="p-8">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <p style={{ color: "var(--ink-muted)" }} className="text-sm max-w-lg">
            Conferences you're keeping an eye on for their submission deadlines. Click an acronym to open the CFP, or search below to add another.
          </p>
          <div className="relative w-full sm:w-72">
            <Search size={14} style={{ color: "var(--ink-faint)" }} className="absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search CFPs to add..."
              style={{ border: "1.5px solid var(--border)", color: "var(--ink)" }}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none focus:border-[var(--primary)]"
            />
            {searchResults.length > 0 && (
              <div style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px rgba(15,23,42,0.14)" }} className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl overflow-hidden z-20 py-1.5">
                {searchResults.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => void addToWatchlist(c)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-[var(--canvas)] transition-colors cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span style={{ color: "var(--ink)" }} className="text-sm font-semibold block truncate">{c.acronym}</span>
                      <span style={{ color: "var(--ink-faint)" }} className="text-xs block truncate">{c.name}</span>
                    </span>
                    <Plus size={14} style={{ color: "var(--primary)" }} className="shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl overflow-hidden">
          {sorted.length === 0 ? (
            <div className="py-14 text-center">
              <Star size={28} style={{ color: "var(--border-strong)" }} className="mx-auto mb-2" />
              <p style={{ color: "var(--ink-faint)" }} className="text-sm">Your watchlist is empty — search above to add a CFP.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border)" }}>
                    <th className="px-5 py-3 w-10"></th>
                    <WatchlistSortHeader field="acronym" label="Acronym" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-4 py-3">Name</th>
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-4 py-3">Location</th>
                    <WatchlistSortHeader field="submissionDeadline" label="Submission Deadline" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                    <WatchlistSortHeader field="endDate" label="Conference Date" sortField={sortField} sortAsc={sortAsc} onSort={toggleSort} />
                    <th style={{ color: "var(--ink-muted)" }} className="text-left font-semibold text-xs px-4 py-3">Topics</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((w, i) => (
                    <tr key={w.slug} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--muted)" : "none" }}>
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[w.slug])}
                          onChange={() => toggleRow(w.slug)}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ accentColor: "var(--primary)" }}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => { if (w.cfpPage) router.push(`/cfp/${w.cfpPage}`); }}
                          style={{ color: "var(--primary)" }}
                          className="text-sm font-bold hover:underline whitespace-nowrap cursor-pointer"
                        >
                          {w.acronym}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs truncate" style={{ color: "var(--ink)" }}>{w.name}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: "var(--ink-muted)" }}>{w.country}</td>
                      <td className="px-4 py-3.5 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>{w.submissionDeadline ? formatDisplayDate(w.submissionDeadline) : "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: "var(--ink-muted)" }}>{w.endDate ? formatDisplayDate(w.endDate) : "—"}</td>
                      <td className="px-4 py-3.5">
                        {w.topics.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {w.topics.map((t, ti) => {
                              const c = CFP_TOPIC_COLORS[ti % CFP_TOPIC_COLORS.length];
                              return (
                                <span key={t} style={{ background: c.bg, color: c.color }} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize">{t}</span>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ color: "var(--border-strong)" }} className="text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {note && <p role="alert" style={{ color: "var(--danger-ink)" }} className="mt-4 text-sm">{note}</p>}

        {sorted.length > 0 && (
          <button
            onClick={() => void removeSelected()}
            disabled={selectedCount === 0}
            style={{ background: selectedCount > 0 ? "var(--danger)" : "var(--muted)", color: selectedCount > 0 ? "#FFFFFF" : "var(--ink-faint)" }}
            className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:cursor-not-allowed cursor-pointer"
          >
            <Trash2 size={14} /> Remove Selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </button>
        )}
      </div>
    </div>
  );
}
