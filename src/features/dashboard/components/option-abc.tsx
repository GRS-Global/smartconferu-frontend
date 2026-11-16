"use client";

import { Building2, ChevronDown, ChevronRight, Funnel, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckList, ClearLink, FilterPopover, PopoverTitle, RadioList, TextFilter } from "@/components/ui/filter-popover";
import { SearchField } from "@/components/ui/search-field";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/cn";
import type { Conference, ConferenceRole } from "@/types/conference";
import { buildRoleColumns, roleSummaryItems, type RoleColumn } from "../columns";
import { NEXT_STEP_OPTIONS, PAPER_RESULTS, sumCounts, sumRoleCounts, type DashboardRow, type PaperResultDef } from "../derive";
import { ROLE_META, ROLE_ORDER, type RoleFilter } from "../roles";
import type { CertFilter, NumRule } from "../view-state";
import { CertificateBadge } from "./certificate-badge";
import { RoleStatCard, RoleTile, type RoleStat } from "./role-cards";
import { RoleChoiceDialog } from "./role-choice-dialog";
import { ConferenceCell, DatesCell, HEAD_BORDER, HeaderCell, LocationCell, TH } from "./table-parts";

/* The three layouts first put in front of the client; they share one filter model and one row model
   and differ in where the author numbers sit:
     A — the Author card lists the numbers, the table has a "My papers" column
     B — compact tiles, the numbers as a strip above the table, a totals bar under it
     C — like A, but the table carries grouped "Submissions" columns */

type Variant = "a" | "b" | "c";

interface SubColumn {
  key: "sent" | "not_registered" | "registered" | "not_accepted" | "revise" | "waitlist" | "no_result";
  label: string;
  color: string;
  action?: boolean;
  value: (r: DashboardRow) => number;
}
const SUB_COLUMNS: SubColumn[] = [
  { key: "sent", label: "Submissions", value: (r) => r.sent, color: "var(--navy)" },
  { key: "not_registered", label: "Accepted – registration pending", value: (r) => r.counts.not_registered, color: "var(--warning)", action: true },
  { key: "registered", label: "Accepted & registered", value: (r) => r.counts.registered, color: "var(--success)" },
  { key: "not_accepted", label: "Rejected", value: (r) => r.counts.not_accepted, color: "var(--ink-muted)" },
  { key: "revise", label: "Revision Required", value: (r) => r.counts.revise, color: "var(--warning)" },
  { key: "waitlist", label: "Waitlisted", value: (r) => r.counts.waitlist, color: "var(--ink-soft)" },
  { key: "no_result", label: "No Decision", value: (r) => r.counts.no_result, color: "var(--ink-soft)" },
];

interface AbcFilters {
  text: string;
  years: string[];
  countries: string[];
  results: string[];
  next: string[];
  cert: CertFilter;
  sub: Record<string, NumRule>;
  role: Record<string, string[]>;
}
const EMPTY: AbcFilters = { text: "", years: [], countries: [], results: [], next: [], cert: "any", sub: {}, role: {} };

const pinnedFirst = (a: DashboardRow, b: DashboardRow) => Number(b.conf.pinned ?? false) - Number(a.conf.pinned ?? false);
const uniqueSorted = (list: string[]) => Array.from(new Set(list)).sort();

function ResultChip({ result, count }: { result: PaperResultDef; count: number }) {
  const tone = result.key === "not_registered" ? "bg-warning-soft text-[#92400E]" : result.key === "registered" ? "bg-success-soft text-[#15803D]" : "bg-muted text-ink-soft";
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", tone)}>{count} {result.short}</span>;
}

export interface OptionABCProps {
  variant: Variant;
  rows: DashboardRow[];
  onEnter: (conf: Conference, role: ConferenceRole) => void;
  onRegister: (conf: Conference) => void;
  onOpenCertificates: () => void;
  /** Reports the picked role, for the page breadcrumb. */
  onRoleChange?: (role: RoleFilter) => void;
}

export function OptionABC({ variant, rows, onEnter, onRegister, onOpenCertificates, onRoleChange }: OptionABCProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("author");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AbcFilters>(EMPTY);
  const [collapsed, setCollapsed] = useState({ active: false, archived: false });
  const [roleModalRow, setRoleModalRow] = useState<DashboardRow | null>(null);

  useEffect(() => { onRoleChange?.(roleFilter); }, [roleFilter, onRoleChange]);

  const roleCounts = Object.fromEntries(ROLE_ORDER.map((k) => [k, k === "all" ? rows.length : rows.filter((r) => r.roles.includes(k as ConferenceRole)).length])) as Record<RoleFilter, number>;
  const authorTotals = sumCounts(rows);
  const setF = (patch: Partial<AbcFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const setSub = (key: string, value: NumRule) => setFilters((f) => ({ ...f, sub: { ...f.sub, [key]: value } }));
  const setRoleFilterValues = (key: string, values: string[]) => setFilters((f) => ({ ...f, role: { ...f.role, [key]: values } }));

  const view = roleFilter;
  const isAuthorView = view === "author";
  const inRole = rows.filter((r) => view === "all" || r.roles.includes(view));
  const years = uniqueSorted(inRole.map((r) => r.year));
  const countries = uniqueSorted(inRole.map((r) => r.conf.country));
  const roleColumns: RoleColumn[] = useMemo(() => buildRoleColumns(view, onEnter), [view, onEnter]);

  const certOf = (row: DashboardRow) => {
    if (view === "reviewer" && row.reviewer) return row.reviewer.certificate;
    if (view === "committee" && row.committee) return row.committee.certificate;
    if (view === "all") {
      return row.anyCertificate
        ? { issued: true, count: 1, title: "Certificate ready", reason: "You have a certificate from this conference." }
        : { issued: false, count: 0, title: "No certificate yet", reason: "No certificate from this conference yet." };
    }
    return row.certificate;
  };
  const showCert = view !== "chair";

  const matches = (r: DashboardRow, except?: string) => {
    for (const col of roleColumns) {
      const sel = filters.role[col.key];
      if (except === `role-${col.key}` || !sel?.length) continue;
      if (!sel.some((v) => col.options.find((o) => o.value === v)?.test(r))) return false;
    }
    const q = search.trim().toLowerCase();
    if (q && !r.conf.acronym.toLowerCase().includes(q) && !r.conf.name.toLowerCase().includes(q)) return false;
    const t = filters.text.trim().toLowerCase();
    if (except !== "text" && t && !r.conf.acronym.toLowerCase().includes(t) && !r.conf.name.toLowerCase().includes(t)) return false;
    if (except !== "years" && filters.years.length && !filters.years.includes(r.year)) return false;
    if (except !== "countries" && filters.countries.length && !filters.countries.includes(r.conf.country)) return false;
    if (except !== "results" && filters.results.length && !filters.results.some((k) => (k === "conferences" ? true : k === "sent" ? r.sent > 0 : r.counts[k as keyof typeof r.counts] > 0))) return false;
    if (except !== "next" && filters.next.length && !filters.next.includes(r.next.key)) return false;
    if (except !== "cert" && filters.cert !== "any" && (filters.cert === "issued") !== certOf(r).issued) return false;
    for (const col of SUB_COLUMNS) {
      const rule = filters.sub[col.key];
      if (except === `sub-${col.key}` || !rule || rule === "any") continue;
      const v = col.value(r);
      if (rule === "some" && v === 0) return false;
      if (rule === "none" && v > 0) return false;
    }
    return true;
  };
  const filtered = inRole.filter((r) => matches(r));
  // Counts next to each option ignore that column's own filter, so they read as "what you'd get".
  const countFor = (except: string, pred: (r: DashboardRow) => boolean) => inRole.filter((r) => matches(r, except) && pred(r)).length;

  const groups = [
    { key: "active" as const, label: "Active", hint: "upcoming or happening now", rows: filtered.filter((r) => r.conf.status === "active").sort((a, b) => pinnedFirst(a, b) || a.conf.startDate.localeCompare(b.conf.startDate)) },
    { key: "archived" as const, label: "Past (archived)", hint: "finished conferences", rows: filtered.filter((r) => r.conf.status !== "active").sort((a, b) => b.conf.endDate.localeCompare(a.conf.endDate)) },
  ];

  const pickRole = (key: RoleFilter) => { setRoleFilter(key); setFilters(EMPTY); setCollapsed({ active: false, archived: false }); };
  const pickCount = (key: string) => { setRoleFilter("author"); setF({ results: key === "conferences" || key === "sent" ? [] : [key] }); };
  const handleRowClick = (row: DashboardRow) => {
    // A role tile is already picked — go straight in as that role, never ask again.
    if (roleFilter !== "all") return onEnter(row.conf, roleFilter);
    if (row.roles.length > 1) return setRoleModalRow(row);
    return onEnter(row.conf, row.roles[0]);
  };

  /* ---------- chips ---------- */
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.text) chips.push({ key: "text", label: `Conference: "${filters.text}"`, clear: () => setF({ text: "" }) });
  if (filters.years.length) chips.push({ key: "years", label: `Year: ${filters.years.join(", ")}`, clear: () => setF({ years: [] }) });
  if (filters.countries.length) chips.push({ key: "countries", label: `Location: ${filters.countries.length > 2 ? `${filters.countries.length} countries` : filters.countries.join(", ")}`, clear: () => setF({ countries: [] }) });
  if (filters.results.length) chips.push({ key: "results", label: `Papers: ${filters.results.map((k) => PAPER_RESULTS.find((p) => p.key === k)?.short || k).join(", ")}`, clear: () => setF({ results: [] }) });
  if (filters.next.length) chips.push({ key: "next", label: `What's next: ${filters.next.map((k) => NEXT_STEP_OPTIONS.find((o) => o.key === k)?.label).join(", ")}`, clear: () => setF({ next: [] }) });
  if (filters.cert !== "any") chips.push({ key: "cert", label: filters.cert === "issued" ? "Certificate: ready" : "Certificate: not yet", clear: () => setF({ cert: "any" }) });
  SUB_COLUMNS.forEach((c) => {
    const rule = filters.sub[c.key];
    if (rule && rule !== "any") chips.push({ key: `sub-${c.key}`, label: `${c.label}: ${rule === "some" ? "1 or more" : "none"}`, clear: () => setSub(c.key, "any") });
  });
  roleColumns.forEach((c) => {
    const sel = filters.role[c.key];
    if (sel?.length) chips.push({ key: `role-${c.key}`, label: `${c.label}: ${sel.map((v) => c.options.find((o) => o.value === v)?.label || v).join(", ")}`, clear: () => setRoleFilterValues(c.key, []) });
  });

  /* ---------- column filters ---------- */
  const conferenceFilter = (
    <FilterPopover label="conference" active={!!filters.text}>
      <PopoverTitle>Conference name contains</PopoverTitle>
      <TextFilter label="Conference name contains" value={filters.text} onChange={(v) => setF({ text: v })} placeholder="e.g. ICTCS or Computing" />
      <ClearLink onClick={() => setF({ text: "" })} />
    </FilterPopover>
  );
  const datesFilter = (
    <FilterPopover label="conference dates" active={filters.years.length > 0}>
      <PopoverTitle>Show conferences held in</PopoverTitle>
      <CheckList options={years.map((y) => ({ value: y, label: y, count: countFor("years", (r) => r.year === y) }))} selected={filters.years} onChange={(v) => setF({ years: v })} />
      <ClearLink onClick={() => setF({ years: [] })} />
    </FilterPopover>
  );
  const locationFilter = (
    <FilterPopover label="location" active={filters.countries.length > 0}>
      <PopoverTitle>Country</PopoverTitle>
      <CheckList options={countries.map((c) => ({ value: c, label: c, count: countFor("countries", (r) => r.conf.country === c) }))} selected={filters.countries} onChange={(v) => setF({ countries: v })} />
      <ClearLink onClick={() => setF({ countries: [] })} />
    </FilterPopover>
  );
  const papersFilter = (
    <FilterPopover label="my papers" active={filters.results.length > 0}>
      <PopoverTitle>Show conferences where I have a paper that is</PopoverTitle>
      <CheckList options={PAPER_RESULTS.map((p) => ({ value: p.key as string, label: p.label, count: countFor("results", (r) => r.counts[p.key] > 0) }))} selected={filters.results} onChange={(v) => setF({ results: v })} />
      <ClearLink onClick={() => setF({ results: [] })} />
    </FilterPopover>
  );
  const nextFilter = (
    <FilterPopover label="what's next" active={filters.next.length > 0}>
      <PopoverTitle>What&apos;s next</PopoverTitle>
      <CheckList
        options={NEXT_STEP_OPTIONS.map((o) => ({ value: o.key, label: o.label, count: countFor("next", (r) => r.next.key === o.key) })).filter((o) => o.count > 0 || filters.next.includes(o.value))}
        selected={filters.next}
        onChange={(v) => setF({ next: v })}
      />
      <ClearLink onClick={() => setF({ next: [] })} />
    </FilterPopover>
  );
  const certFilter = (
    <FilterPopover label="certificate" active={filters.cert !== "any"} alignRight>
      <PopoverTitle>Certificate</PopoverTitle>
      <RadioList<CertFilter>
        name="cert"
        value={filters.cert}
        onChange={(v) => setF({ cert: v })}
        options={[
          { value: "any", label: "Any" },
          { value: "issued", label: "Ready to download", count: countFor("cert", (r) => certOf(r).issued) },
          { value: "not", label: "Not yet", count: countFor("cert", (r) => !certOf(r).issued) },
        ]}
      />
    </FilterPopover>
  );
  const subFilter = (col: SubColumn, i: number) => (
    <FilterPopover label={col.label} active={!!filters.sub[col.key] && filters.sub[col.key] !== "any"} alignRight={i >= 3}>
      <PopoverTitle>{`Show conferences where "${col.label}" is`}</PopoverTitle>
      <RadioList<NumRule>
        name={`sub-${col.key}`}
        value={filters.sub[col.key] || "any"}
        onChange={(v) => setSub(col.key, v)}
        options={[
          { value: "any", label: "Any number" },
          { value: "some", label: "1 or more", count: countFor(`sub-${col.key}`, (r) => col.value(r) > 0) },
          { value: "none", label: "None (0)", count: countFor(`sub-${col.key}`, (r) => col.value(r) === 0) },
        ]}
      />
    </FilterPopover>
  );
  const roleFilterPopover = (col: RoleColumn, alignRight: boolean) => (
    <FilterPopover label={col.label} active={!!filters.role[col.key]?.length} alignRight={alignRight}>
      <PopoverTitle>{col.label}</PopoverTitle>
      <CheckList
        options={col.options.map((o) => ({ value: o.value, label: o.label, count: countFor(`role-${col.key}`, o.test) })).filter((o) => o.count > 0 || filters.role[col.key]?.includes(o.value))}
        selected={filters.role[col.key] || []}
        onChange={(v) => setRoleFilterValues(col.key, v)}
      />
      <ClearLink onClick={() => setRoleFilterValues(col.key, [])} />
    </FilterPopover>
  );

  const isC = variant === "c" && isAuthorView;
  const colCount = isAuthorView ? (isC ? 10 : 7) : 3 + roleColumns.length + (showCert ? 1 : 0) + 1;

  /* ---------- role stat cards (A and C) ---------- */
  const applyStat = (role: RoleFilter, patch: Partial<AbcFilters> = {}, collapse?: { active: boolean; archived: boolean }) => {
    setRoleFilter(role);
    setFilters({ ...EMPTY, ...patch });
    setCollapsed(collapse || { active: false, archived: false });
  };
  const roleOn = (role: RoleFilter, key: string, value: string) => roleFilter === role && (filters.role[key] || []).length === 1 && filters.role[key][0] === value;
  const chairT = sumRoleCounts(rows, "chair");
  const reviewerT = sumRoleCounts(rows, "reviewer");
  const committeeT = sumRoleCounts(rows, "committee");
  const today = new Date();
  const startsSoon = rows.filter((r) => {
    const [y, m, d] = r.conf.startDate.split("-").map(Number);
    const days = (new Date(y, m - 1, d).getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
    return r.conf.status === "active" && days >= 0 && days <= 30;
  }).length;
  const onlyActive = { active: false, archived: true };
  const onlyPast = { active: true, archived: false };

  const statCards: Array<{ key: RoleFilter; count: number; stats: RoleStat[] }> = [
    {
      key: "all", count: roleCounts.all,
      stats: [
        { label: "Active", value: rows.filter((r) => r.conf.status === "active").length, color: "var(--success)", onClick: () => applyStat("all", {}, onlyActive), on: roleFilter === "all" && collapsed.archived && !collapsed.active },
        { label: "Past (archived)", value: rows.filter((r) => r.conf.status !== "active").length, onClick: () => applyStat("all", {}, onlyPast), on: roleFilter === "all" && collapsed.active && !collapsed.archived },
        { label: "Starting in 30 days", value: startsSoon, color: "var(--warning)" },
        { label: "Certificates earned", value: rows.filter((r) => r.anyCertificate).length, color: "var(--primary)", onClick: () => applyStat("all", { cert: "issued" }), on: roleFilter === "all" && filters.cert === "issued" },
      ],
    },
    {
      key: "author", count: roleCounts.author,
      stats: [
        { label: "Submissions", value: authorTotals.sent, onClick: () => applyStat("author") },
        ...PAPER_RESULTS.filter((r) => r.counted).map((r) => ({
          label: r.label, value: authorTotals[r.key], color: r.color, attention: r.action,
          onClick: () => applyStat("author", { results: [r.key] }),
          on: roleFilter === "author" && filters.results.length === 1 && filters.results[0] === r.key,
        })),
      ],
    },
    {
      key: "chair", count: roleCounts.chair,
      stats: [
        { label: "Submissions", value: chairT.received, onClick: () => applyStat("chair") },
        { label: "Accepted", value: chairT.accepted, color: "var(--success)" },
        { label: "Rejected", value: chairT.rejected, color: "var(--ink-soft)" },
        { label: "No decision", value: chairT.undecided, color: "var(--warning)", attention: true, onClick: () => applyStat("chair", { role: { "ch-decisions": ["undecided"] } }), on: roleOn("chair", "ch-decisions", "undecided") },
        { label: "Withdrawn", value: chairT.withdrawn, color: "var(--ink-muted)", onClick: () => applyStat("chair", { role: { "ch-decisions": ["withdrawn"] } }), on: roleOn("chair", "ch-decisions", "withdrawn") },
        { label: "Registrations", value: chairT.registrations, color: "var(--primary)", onClick: () => applyStat("chair", { role: { "ch-registrations": ["some"] } }), on: roleOn("chair", "ch-registrations", "some") },
      ],
    },
    {
      key: "reviewer", count: roleCounts.reviewer,
      stats: [
        { label: "Papers assigned", value: reviewerT.assigned, onClick: () => applyStat("reviewer", { role: { "rv-assigned": ["some"] } }), on: roleOn("reviewer", "rv-assigned", "some") },
        { label: "Reviewed", value: reviewerT.done, color: "var(--success)", onClick: () => applyStat("reviewer", { role: { "rv-progress": ["done"] } }), on: roleOn("reviewer", "rv-progress", "done") },
        { label: "Pending", value: reviewerT.pending, color: "var(--warning)", attention: true, onClick: () => applyStat("reviewer", { role: { "rv-progress": ["pending"] } }), on: roleOn("reviewer", "rv-progress", "pending") },
        { label: "Invitation Rejected", value: reviewerT.declined, color: "var(--ink-soft)", onClick: () => applyStat("reviewer", { role: { "rv-progress": ["declined"] } }), on: roleOn("reviewer", "rv-progress", "declined") },
        { label: "Review Overdue", value: reviewerT.overdue, color: "var(--danger)", attention: true, onClick: () => applyStat("reviewer", { role: { "rv-due": ["overdue"] } }), on: roleOn("reviewer", "rv-due", "overdue") },
      ],
    },
    {
      key: "committee", count: roleCounts.committee,
      stats: [
        { label: "Upcoming", value: committeeT.upcoming, color: "var(--success)", onClick: () => applyStat("committee", {}, onlyActive), on: roleFilter === "committee" && collapsed.archived && !collapsed.active },
        { label: "Finished", value: committeeT.finished, onClick: () => applyStat("committee", {}, onlyPast), on: roleFilter === "committee" && collapsed.active && !collapsed.archived },
        { label: "Certificates ready", value: committeeT.certificates, color: "var(--primary)", onClick: () => applyStat("committee", { cert: "issued" }), on: roleFilter === "committee" && filters.cert === "issued" },
        { label: "Committee roles held", value: new Set(rows.filter((r) => r.committee).map((r) => r.committee?.label)).size },
      ],
    },
  ];
  statCards.sort((a, b) => ROLE_ORDER.indexOf(a.key) - ROLE_ORDER.indexOf(b.key));

  const totalsFiltered = sumCounts(filtered);
  const roleSummary = roleSummaryItems(view, view === "reviewer" || view === "chair" || view === "committee" ? sumRoleCounts(rows, view) : {});
  const roleTotals = roleSummaryItems(view, view === "reviewer" || view === "chair" || view === "committee" ? sumRoleCounts(filtered, view) : {}).filter((it) => it.label !== "Conferences");

  /* ---------- cells ---------- */
  const papersCell = (row: DashboardRow) => {
    if (!row.roles.includes("author")) return <td className="px-4 py-3.5 align-top text-ink-faint">—</td>;
    return (
      <td className="px-4 py-3.5 align-top">
        <div className="flex max-w-[260px] flex-wrap gap-1.5">
          {PAPER_RESULTS.filter((p) => row.counts[p.key] > 0).map((p) => <ResultChip key={p.key} result={p} count={row.counts[p.key]} />)}
        </div>
      </td>
    );
  };
  const nextCell = (row: DashboardRow) => (
    <td className="px-4 py-3.5 align-top">
      {row.next.key === "register" ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRegister(row.conf); }} className="whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-primary-hover">Register now</button>
      ) : (
        <span className={cn("text-[12.5px] font-bold", row.next.tone === "warning" ? "text-warning" : row.next.key === "none" ? "text-ink-faint" : "text-ink-soft")}>{row.next.text}</span>
      )}
    </td>
  );
  const subCells = (row: DashboardRow) => SUB_COLUMNS.map((col, i) => {
    const v = row.roles.includes("author") ? col.value(row) : 0;
    const action = col.action && v > 0;
    return (
      <td
        key={col.key}
        style={{ background: action ? "var(--warning-soft)" : "transparent", borderLeft: i === 0 ? "1px solid var(--border)" : "none", borderRight: i === SUB_COLUMNS.length - 1 ? "1px solid var(--border)" : "none" }}
        className="px-2 py-3.5 text-center align-top"
      >
        {v === 0 ? (
          <span className="text-[15px] font-bold text-line-strong" aria-label="0">–</span>
        ) : action ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRegister(row.conf); }} className="inline-flex flex-col items-center">
            <span className="text-[17px] font-extrabold leading-tight text-warning">{v}</span>
            <span className="text-[11px] font-bold text-[#92400E] underline-offset-2 hover:underline">Register now</span>
          </button>
        ) : (
          <span style={{ color: col.color }} className="text-[17px] font-extrabold">{v}</span>
        )}
      </td>
    );
  });

  const authorStrip: Array<{ key: string; label: string; value: number; color: string; action?: boolean }> = [
    { key: "conferences", label: "Conferences", value: authorTotals.conferences, color: "var(--navy)" },
    { key: "sent", label: "Submissions", value: authorTotals.sent, color: "var(--navy)" },
    ...PAPER_RESULTS.filter((r) => r.counted).map((r) => ({ key: r.key as string, label: r.label, value: authorTotals[r.key], color: r.color, action: r.action })),
  ];

  return (
    <div className="space-y-5 p-8">
      {variant === "b" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {ROLE_ORDER.map((k) => <RoleTile key={k} role={k} count={roleCounts[k]} active={roleFilter === k} onSelect={() => pickRole(k)} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statCards.map((c) => <RoleStatCard key={c.key} role={c.key} count={c.count} stats={c.stats} active={roleFilter === c.key} onSelectRole={() => pickRole(c.key)} />)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-h-[32px] flex-wrap items-center gap-2">
          {chips.length > 0 ? (
            <>
              <span className="text-[12.5px] font-semibold text-ink-muted">Filters on:</span>
              {chips.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft py-1 pl-2.5 pr-1.5 text-[12.5px] font-bold text-primary-hover">
                  {c.label}
                  <button type="button" aria-label={`Remove ${c.label}`} onClick={c.clear} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white"><X size={12} strokeWidth={3} aria-hidden="true" /></button>
                </span>
              ))}
              <button type="button" onClick={() => setFilters(EMPTY)} className="text-[12.5px] font-bold text-primary hover:underline">Clear all</button>
            </>
          ) : (
            <span className="text-[12.5px] font-medium text-ink-faint">Use the <Funnel size={11} className="-mt-0.5 inline" aria-hidden="true" /> on any column to filter.</span>
          )}
        </div>
        <SearchField label="Search conferences" value={search} onChange={setSearch} placeholder="Search by name or short name…" />
      </div>

      {/* Option B: the selected role's numbers as a strip above the list */}
      {variant === "b" && !isAuthorView && roleSummary.length > 0 && (
        <div className="flex overflow-hidden rounded-2xl border border-line bg-white">
          <div style={{ background: ROLE_META[view].accent }} className="flex w-[200px] shrink-0 flex-col justify-center gap-0.5 px-5 text-white">
            <span className="text-[13px] font-extrabold">{ROLE_META[view].label}</span>
            <span className="text-[11.5px] font-semibold opacity-80">at a glance</span>
          </div>
          {roleSummary.map((it, i) => (
            <div key={it.label} style={{ borderLeft: i ? "1px solid var(--muted)" : "none", background: it.tone === "warning" && it.value ? "var(--warning-soft)" : "#fff" }} className="flex min-w-0 flex-1 basis-0 flex-col items-start gap-0.5 px-3.5 py-3">
              <b style={{ color: it.color || "var(--navy)" }} className="text-xl leading-tight"><AnimatedNumber value={it.value} /></b>
              <span className="text-xs font-semibold leading-tight text-ink-muted">{it.label}</span>
            </div>
          ))}
        </div>
      )}
      {variant === "b" && isAuthorView && (
        <div className="flex overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex w-[200px] shrink-0 flex-col justify-center gap-0.5 bg-primary px-5 text-white">
            <span className="text-[13px] font-extrabold">As Author</span>
            <span className="text-[11.5px] font-semibold text-[#EDE9FE]">tap to filter</span>
          </div>
          {authorStrip.map((it, i) => {
            const on = filters.results.length === 1 && filters.results[0] === it.key;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => pickCount(it.key)}
                aria-pressed={on}
                style={{ borderLeft: i ? "1px solid var(--muted)" : "none", background: on ? "var(--primary-soft)" : it.action ? "var(--warning-soft)" : "#fff", boxShadow: on ? "inset 0 -3px 0 var(--primary)" : "none" }}
                className="flex min-w-0 flex-1 basis-0 flex-col items-start gap-0.5 px-3.5 py-3 text-left transition-colors hover:bg-canvas"
              >
                <b style={{ color: it.color }} className="text-xl leading-tight"><AnimatedNumber value={it.value} /></b>
                <span className={cn("text-xs leading-tight", it.action ? "font-bold text-[#92400E]" : "font-semibold text-ink-muted")}>{it.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-2xl border border-line bg-white shadow-card">
        <div className="relative overflow-x-auto rounded-2xl lg:overflow-visible">
          <table className="ui-table ui-table-grouped w-full text-[13.5px]">
            <caption className="sr-only">Your conferences</caption>
            <thead>
              {isC ? (
                <>
                  <tr className="bg-canvas text-ink-soft">
                    <th scope="col" rowSpan={2} className={cn(TH, HEAD_BORDER)}><HeaderCell label="Conference" filter={conferenceFilter} /></th>
                    <th scope="col" rowSpan={2} className={cn(TH, HEAD_BORDER)}><HeaderCell label="Conference dates" filter={datesFilter} /></th>
                    <th scope="col" rowSpan={2} className={cn(TH, HEAD_BORDER)}><HeaderCell label="Location" filter={locationFilter} /></th>
                    <th colSpan={5} className="border-x border-b border-x-line border-b-primary-soft-border bg-primary-soft px-4 py-2.5 text-center text-[13px] font-extrabold text-primary-hover">Submissions</th>
                    <th scope="col" rowSpan={2} className={cn(TH, HEAD_BORDER, "text-center")}><HeaderCell label="Certificate" filter={certFilter} className="justify-center" /></th>
                    <th scope="col" rowSpan={2} className={cn(HEAD_BORDER, "w-10")}><span className="sr-only">Open</span></th>
                  </tr>
                  <tr className="bg-[#F5F7FF] text-ink-soft">
                    {SUB_COLUMNS.map((col, i) => (
                      <th
                        key={col.key}
                        scope="col"
                        style={{ borderLeft: i === 0 ? "1px solid var(--border)" : "1px solid var(--primary-soft)", borderRight: i === SUB_COLUMNS.length - 1 ? "1px solid var(--border)" : "none" }}
                        className={cn(HEAD_BORDER, "max-w-[110px] px-2 py-2 text-center text-xs font-bold leading-tight")}
                      >
                        <HeaderCell label={col.label} filter={subFilter(col, i)} className="justify-center" />
                      </th>
                    ))}
                  </tr>
                </>
              ) : !isAuthorView ? (
                <tr className={cn("bg-canvas text-ink-soft", HEAD_BORDER)}>
                  <th scope="col" className={TH}><HeaderCell label="Conference" filter={conferenceFilter} /></th>
                  <th scope="col" className={TH}><HeaderCell label="Conference dates" filter={datesFilter} /></th>
                  <th scope="col" className={TH}><HeaderCell label="Location" filter={locationFilter} /></th>
                  {roleColumns.map((col, i) => (
                    <th key={col.key} scope="col" className={cn(TH, col.center && "text-center")}>
                      <HeaderCell label={col.label} filter={roleFilterPopover(col, i >= roleColumns.length - 1)} className={col.center ? "justify-center" : ""} />
                    </th>
                  ))}
                  {showCert && <th scope="col" className={TH}><HeaderCell label="Certificate" filter={certFilter} /></th>}
                  <th scope="col" className="w-10"><span className="sr-only">Open</span></th>
                </tr>
              ) : (
                <tr className={cn("bg-canvas text-ink-soft", HEAD_BORDER)}>
                  <th scope="col" className={TH}><HeaderCell label="Conference" filter={conferenceFilter} /></th>
                  <th scope="col" className={TH}><HeaderCell label="Conference dates" filter={datesFilter} /></th>
                  <th scope="col" className={TH}><HeaderCell label="Location" filter={locationFilter} /></th>
                  <th scope="col" className={TH}><HeaderCell label="My papers" filter={papersFilter} /></th>
                  <th scope="col" className={TH}><HeaderCell label="What's next" filter={nextFilter} /></th>
                  <th scope="col" className={TH}><HeaderCell label="Certificate" filter={certFilter} /></th>
                  <th scope="col" className="w-10"><span className="sr-only">Open</span></th>
                </tr>
              )}
            </thead>
            <tbody>
              {groups.map((g) => g.rows.length === 0 ? null : (
                <GroupRows key={g.key} group={g} colCount={colCount} collapsed={collapsed[g.key]} onToggle={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}>
                  {g.rows.map((row, ri) => (
                    <tr key={row.conf.id} onClick={() => handleRowClick(row)} className={cn("cursor-pointer border-b border-muted transition-colors", ri % 2 === 1 && "ui-row-alt")}>
                      <ConferenceCell row={row} note={isC && row.counts.draft > 0 ? <div className="mt-1 text-xs font-semibold text-ink-muted">{row.counts.draft} draft, not sent yet</div> : undefined} />
                      <DatesCell row={row} />
                      <LocationCell row={row} countryOnly />
                      {!isAuthorView
                        ? roleColumns.map((col) => <td key={col.key} className={cn("px-4 py-3.5 align-top", col.center && "text-center")}>{col.render(row)}</td>)
                        : isC ? subCells(row) : <>{papersCell(row)}{nextCell(row)}</>}
                      {showCert && <td className={cn("px-4 py-3.5 align-top", isC && "text-center")}><CertificateBadge certificate={certOf(row)} onOpen={onOpenCertificates} /></td>}
                      <td className="px-3 py-3.5 align-top"><ChevronRight size={16} className="text-line-strong" aria-hidden="true" /></td>
                    </tr>
                  ))}
                </GroupRows>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          rows.length === 0 ? (
            <EmptyState icon={Building2} title="You have no conferences yet." description="Conferences you chair, submit to, or review for will appear here." />
          ) : (
            <EmptyState icon={Building2} title="No conferences match these filters." action={<button type="button" onClick={() => { setFilters(EMPTY); setSearch(""); }} className="text-sm font-bold text-primary hover:underline">Clear filters</button>} />
          )
        )}
      </div>

      {/* Option B: totals for exactly what's listed */}
      {variant === "b" && filtered.length > 0 && (isAuthorView || roleTotals.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-navy px-5 py-3.5 text-[13px] text-slate-200">
          <div className="flex items-center gap-2.5">
            <b className="text-sm text-white">Totals for this list</b>
            <span className="text-ink-faint">{filtered.length} conference{filtered.length === 1 ? "" : "s"} shown{chips.length ? " · filtered" : ""}</span>
          </div>
          {!isAuthorView ? (
            <div className="flex flex-wrap items-center gap-4 font-semibold">
              {roleTotals.map((it) => <span key={it.label}><b style={{ color: it.dark || "#FFFFFF" }} className="text-[15px]">{it.value}</b> {it.label.toLowerCase()}</span>)}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4 font-semibold">
              <span><b className="text-[15px] text-white">{totalsFiltered.sent}</b> submissions</span>
              <span><b className="text-[15px] text-[#FCD34D]">{totalsFiltered.not_registered}</b> registration pending</span>
              <span><b className="text-[15px] text-[#86EFAC]">{totalsFiltered.registered}</b> accepted &amp; registered</span>
              <span><b className="text-[15px] text-[#CBD5E1]">{totalsFiltered.not_accepted}</b> rejected</span>
              <span><b className="text-[15px] text-[#FCD34D]">{totalsFiltered.revise}</b> revision required</span>
              <span><b className="text-[15px] text-[#CBD5E1]">{totalsFiltered.waitlist}</b> waitlisted</span>
              <span><b className="text-[15px] text-white">{totalsFiltered.no_result}</b> no decision</span>
            </div>
          )}
        </div>
      )}
      <RoleChoiceDialog row={roleModalRow} onClose={() => setRoleModalRow(null)} onEnter={onEnter} />
    </div>
  );
}

function GroupRows({ group, colCount, collapsed, onToggle, children }: { group: { key: "active" | "archived"; label: string; hint: string; rows: DashboardRow[] }; colCount: number; collapsed: boolean; onToggle: () => void; children: ReactNode }) {
  const past = group.key !== "active";
  return (
    <>
      <tr className={cn("border-b border-muted", past ? "bg-canvas" : "bg-white")}>
        <td colSpan={colCount} className="px-4 py-2.5">
          <button type="button" onClick={onToggle} aria-expanded={!collapsed} className={cn("flex items-center gap-2 text-[13px] font-extrabold", past ? "text-ink-soft" : "text-navy")}>
            <ChevronDown size={15} strokeWidth={2.6} aria-hidden="true" style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 150ms" }} />
            {group.label}
            <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-bold", past ? "bg-line text-ink-soft" : "bg-success-soft text-[#15803D]")}>{group.rows.length}</span>
            <span className="text-[12.5px] font-medium text-ink-muted">{group.hint}</span>
          </button>
        </td>
      </tr>
      {!collapsed && children}
    </>
  );
}
