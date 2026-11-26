"use client";

import { Building2, ChevronRight, Funnel, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckList, ClearLink, FilterPopover, PopoverTitle, TextFilter } from "@/components/ui/filter-popover";
import { SearchField } from "@/components/ui/search-field";
import { cn } from "@/lib/cn";
import type { Conference, ConferenceRole } from "@/types/conference";
import { buildRoleColumns, type RoleColumn } from "../columns";
import { OUTCOME_COLUMNS, sumOutcomes, sumRoleCounts, type DashboardRow, type OutcomeColumn } from "../derive";
import { ROLE_META, ROLE_ORDER, type RoleFilter } from "../roles";
import { D_EMPTY, initialView, writeLastRole, writeView, type DFilters, type NumRule } from "../view-state";
import { CertificateBadge } from "./certificate-badge";
import { GlanceStrip, RoleStatCard, RoleTile, type GlanceItem, type RoleStat } from "./role-cards";
import { RoleChoiceDialog } from "./role-choice-dialog";
import { ConferenceCell, DatesCell, HEAD_BORDER, HeaderCell, LocationCell, NumberCell, SortHeader, TH, type Sort } from "./table-parts";

type Status = "all" | "active" | "archived";

const D_ACCEPTED = OUTCOME_COLUMNS.filter((c) => c.accepted);
const outcomeCol = (key: string) => OUTCOME_COLUMNS.find((c) => c.key === key) as OutcomeColumn;
// Author table order: Submitted · Accepted (sum of the three registration columns) · Not Accepted · Revision Required · Waitlisted · No Decision ·
// then the accepted papers split by registration (grouped header).
const D_AUTHOR_HEADS: Record<string, string> = { rejected: "Not Accepted", revise: "Revision Required", waitlist: "Waitlisted", noDecision: "No Decision" };
const D_ACCEPTED_SUM = { key: "accepted", label: "Accepted", color: "var(--success)" };
const D_AUTHOR_COLUMNS = [outcomeCol("submitted"), D_ACCEPTED_SUM, outcomeCol("rejected"), outcomeCol("revise"), outcomeCol("waitlist"), outcomeCol("noDecision"), ...D_ACCEPTED];
// "Accepted" has no column of its own, but the strip's Accepted number filters by it.
const D_NUM_FILTERS = [...OUTCOME_COLUMNS, { key: "accepted", label: "Accepted" }];
const D_STATUS: Array<{ key: Status; label: string }> = [{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "archived", label: "Archived" }];
const D_REVIEWER_COLUMNS = [
  { key: "assigned", label: "Papers Assigned", color: "var(--navy)" },
  { key: "done", label: "Reviewed", color: "var(--success)" },
  { key: "pending", label: "Pending", color: "var(--warning)" },
  { key: "declined", label: "Invitation Rejected", color: "var(--ink-soft)" },
];
const D_CHAIR_DECISIONS = [
  { key: "accepted", label: "Accepted", color: "var(--success)" },
  { key: "rejected", label: "Reject", color: "var(--ink-soft)" },
  { key: "undecided", label: "No Decision", color: "var(--warning)" },
  { key: "withdrawn", label: "Withdrawn", color: "var(--ink-muted)" },
];
// The top boxes name each number as the agreed decision list does for that role; the table keeps its own headers.
const D_STATUS_LABELS: Record<string, Record<string, string>> = {
  author: { Rejected: "Not Accepted", "No decision": "No Decision", "Not registered": "Not Registered", "Registration pending": "Registration Pending" },
  chair: { Rejected: "Reject", "No decision": "No Decision", Withdrawn: "Withdrawn", Registrations: "Marked registered" },
};

const isActiveRow = (r: DashboardRow) => r.conf.status === "active";
const pinnedFirst = (a: DashboardRow, b: DashboardRow) => Number(b.conf.pinned ?? false) - Number(a.conf.pinned ?? false);
const byListOrder = (a: DashboardRow, b: DashboardRow) => {
  if (pinnedFirst(a, b)) return pinnedFirst(a, b);
  if (isActiveRow(a) !== isActiveRow(b)) return isActiveRow(a) ? -1 : 1;
  return isActiveRow(a) ? a.conf.startDate.localeCompare(b.conf.startDate) : b.conf.endDate.localeCompare(a.conf.endDate);
};
const uniqueSorted = (list: string[]) => Array.from(new Set(list)).sort();

export interface SlotContext {
  role: RoleFilter;
  pickRole: (role: RoleFilter) => void;
}
export interface ExtraView {
  key: string;
  label: string;
  count?: number;
  render: () => ReactNode;
}
type Slot<T> = ((ctx: SlotContext) => T) | undefined;

export interface OptionDProps {
  rows: DashboardRow[];
  onEnter: (conf: Conference, role: ConferenceRole) => void;
  onRegister: (conf: Conference) => void;
  onOpenCertificates: () => void;
  banner?: Slot<ReactNode>;
  belowGlance?: Slot<ReactNode>;
  listTop?: Slot<ReactNode>;
  extraView?: Slot<ExtraView | null>;
  listView?: string;
  onListViewChange?: (v: string) => void;
  /** Reports the picked role, for the page breadcrumb. */
  onRoleChange?: (role: RoleFilter) => void;
}

export function OptionD({ rows, onEnter, onRegister, onOpenCertificates, banner, belowGlance, listTop, extraView, listView: listViewProp, onListViewChange, onRoleChange }: OptionDProps) {
  const [localListView, setLocalListView] = useState("conferences");
  const setListView = onListViewChange ?? setLocalListView;
  // Coming back from a conference reopens the list exactly as it was left: role, status, search, filters, sort, scroll.
  const [saved] = useState(initialView);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(saved.roleFilter || "all");
  const [sort, setSort] = useState<Sort | null>(saved.sort ?? null);
  const [status, setStatus] = useState<Status>(saved.status || "all");
  const [search, setSearch] = useState(saved.search || "");
  const [filters, setFilters] = useState<DFilters>(() => ({ ...D_EMPTY, ...(saved.filters || {}) }));
  const [roleModalRow, setRoleModalRow] = useState<DashboardRow | null>(null);

  useEffect(() => { writeView({ roleFilter, sort, status, search, filters }); }, [roleFilter, sort, status, search, filters]);
  useEffect(() => { writeLastRole(roleFilter); onRoleChange?.(roleFilter); }, [roleFilter, onRoleChange]);
  useEffect(() => {
    // Restore after the rows have rendered.
    const y = saved.scrollY || 0;
    const restore = y ? requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y))) : null;
    let lastY = y;
    const onScroll = () => { lastY = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (restore) cancelAnimationFrame(restore);
      window.removeEventListener("scroll", onScroll);
      writeView({ scrollY: lastY });
    };
  }, [saved]);

  const view = roleFilter;
  const roleCounts = Object.fromEntries(ROLE_ORDER.map((k) => [k, k === "all" ? rows.length : rows.filter((r) => r.roles.includes(k as ConferenceRole)).length])) as Record<RoleFilter, number>;
  const inRole = rows.filter((r) => view === "all" || r.roles.includes(view));
  const hasOutcomes = view === "author";
  const chairNumbers = view === "chair";
  const reviewerNumbers = view === "reviewer";
  const showCert = view !== "chair";
  const valueOf = (r: DashboardRow, key: string) => (r.outcomes.author as Record<string, number> | null)?.[key] ?? 0;
  const roleColumns: RoleColumn[] = useMemo(
    () => (view === "author" ? [] : buildRoleColumns(view, onEnter).filter((c) => !["rv-next", "ch-next", "cm-next"].includes(c.key))),
    [view, onEnter],
  );
  const certOf = (r: DashboardRow) => {
    if (view === "author") return r.certificate;
    if (view === "reviewer" && r.reviewer) return r.reviewer.certificate;
    if (view === "committee" && r.committee) return r.committee.certificate;
    return r.anyCertificate
      ? { issued: true, count: 1, title: "Certificate ready", reason: "You have a certificate from this conference." }
      : { issued: false, count: 0, title: "No certificate yet", reason: "No certificate from this conference yet." };
  };

  const setF = (patch: Partial<DFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const setNum = (key: string, value: NumRule) => setFilters((f) => ({ ...f, num: { ...f.num, [key]: value } }));
  const setRoleValues = (key: string, values: string[]) => setFilters((f) => ({ ...f, role: { ...f.role, [key]: values } }));

  const matches = (r: DashboardRow, except?: string) => {
    if (except !== "status" && status !== "all" && (status === "active") !== isActiveRow(r)) return false;
    const q = search.trim().toLowerCase();
    if (q && !r.conf.acronym.toLowerCase().includes(q) && !r.conf.name.toLowerCase().includes(q) && String(r.conf.number) !== q) return false;
    const id = filters.id.trim();
    if (except !== "id" && id && !String(r.conf.number).includes(id)) return false;
    const t = filters.text.trim().toLowerCase();
    if (except !== "text" && t && !r.conf.acronym.toLowerCase().includes(t) && !r.conf.name.toLowerCase().includes(t)) return false;
    if (except !== "years" && filters.years.length && !filters.years.includes(r.year)) return false;
    if (except !== "countries" && filters.countries.length && !filters.countries.includes(r.conf.country)) return false;
    if (except !== "cert" && filters.cert !== "any" && (filters.cert === "issued") !== certOf(r).issued) return false;
    if (hasOutcomes) {
      for (const col of D_NUM_FILTERS) {
        const rule = filters.num[col.key];
        if (except === `num-${col.key}` || !rule || rule === "any") continue;
        const v = valueOf(r, col.key);
        if (rule === "some" && v === 0) return false;
        if (rule === "none" && v > 0) return false;
      }
    }
    for (const col of roleColumns) {
      const sel = filters.role[col.key];
      if (except === `role-${col.key}` || !sel?.length) continue;
      if (!sel.some((v) => col.options.find((o) => o.value === v)?.test(r))) return false;
    }
    return true;
  };

  const sortValue = (r: DashboardRow, key: string): number => {
    if (chairNumbers) return (r.chair as unknown as Record<string, number> | null)?.[key] ?? 0;
    if (reviewerNumbers) return (r.reviewer as unknown as Record<string, number> | null)?.[key] ?? 0;
    return valueOf(r, key);
  };
  // Reviewer: active conferences with reviews still pending come first.
  const needsReview = (r: DashboardRow) => (reviewerNumbers && isActiveRow(r) && (r.reviewer?.pending ?? 0) > 0 ? 1 : 0);
  const compareBy = (a: DashboardRow, b: DashboardRow, key: string) =>
    key === "date" ? a.conf.startDate.localeCompare(b.conf.startDate) : key === "id" ? a.conf.number - b.conf.number : sortValue(a, key) - sortValue(b, key);
  // A pinned conference stays on top; the picked column sorts everything under it.
  const bySort = (a: DashboardRow, b: DashboardRow) => {
    if (pinnedFirst(a, b)) return pinnedFirst(a, b);
    const d = sort ? compareBy(a, b, sort.key) * (sort.dir === "asc" ? 1 : -1) : needsReview(b) - needsReview(a);
    return d || byListOrder(a, b);
  };
  const filtered = inRole.filter((r) => matches(r)).sort(bySort);
  const countFor = (except: string, pred: (r: DashboardRow) => boolean) => inRole.filter((r) => matches(r, except) && pred(r)).length;
  const years = uniqueSorted(inRole.map((r) => r.year));
  const countries = uniqueSorted(inRole.map((r) => r.conf.country));

  // The year stays picked when switching role, so the strip keeps reading for the same year(s).
  const pickRole = (key: RoleFilter) => { setRoleFilter(key); setSort(null); setFilters((f) => ({ ...D_EMPTY, years: f.years })); };
  const slotCtx: SlotContext = { role: view, pickRole };
  const bannerNode = banner?.(slotCtx);
  const extra = extraView?.(slotCtx) ?? null;
  const listTopNode = listTop?.(slotCtx);
  const belowGlanceNode = belowGlance?.(slotCtx);
  const listView = extra ? (listViewProp ?? localListView) : "conferences";

  const handleRowClick = (row: DashboardRow) => {
    if (roleFilter !== "all") return onEnter(row.conf, roleFilter);
    if (row.roles.length > 1) return setRoleModalRow(row);
    return onEnter(row.conf, row.roles[0]);
  };

  /* ---------- at a glance: the role's own numbers for the picked year(s) ---------- */
  const roleRows = rows.filter((r) => view !== "all" && r.roles.includes(view));
  const glanceYearOptions = uniqueSorted(roleRows.map((r) => r.year));
  const glanceRows = roleRows.filter((r) => !filters.years.length || filters.years.includes(r.year));
  type Action = { on: boolean; apply: () => void };
  const byNumber = (key: string): Action => {
    const on = filters.num[key] === "some";
    return { on, apply: () => setFilters((f) => ({ ...f, num: on ? {} : { [key]: "some" }, role: {}, cert: "any" })) };
  };
  const byRole = (key: string, value: string): Action => {
    const on = filters.role[key]?.length === 1 && filters.role[key][0] === value;
    return { on, apply: () => setFilters((f) => ({ ...f, role: on ? {} : { [key]: [value] }, num: {}, cert: "any" })) };
  };
  const byStatus = (value: Status): Action => ({ on: status === value, apply: () => setStatus(status === value ? "all" : value) });
  const allConferences: Action = { on: false, apply: () => { setStatus("all"); setFilters((f) => ({ ...f, num: {}, role: {}, cert: "any" })); } };
  const GLANCE_ACTIONS: Record<string, Record<string, Action>> = {
    chair: { Submissions: byRole("ch-received", "some"), Accepted: byRole("ch-decisions", "accepted"), Rejected: byRole("ch-decisions", "rejected"), "No decision": byRole("ch-decisions", "undecided"), Withdrawn: byRole("ch-decisions", "withdrawn"), Registrations: byRole("ch-registrations", "some") },
    reviewer: { "Papers assigned": byRole("rv-assigned", "some"), Reviewed: byRole("rv-progress", "done"), Pending: byRole("rv-progress", "pending"), "Invitation Rejected": byRole("rv-progress", "declined"), "Review Overdue": byRole("rv-due", "overdue") },
    committee: {
      Upcoming: byStatus("active"),
      Finished: byStatus("archived"),
      "Certificates ready": { on: filters.cert === "issued", apply: () => setF({ cert: filters.cert === "issued" ? "any" : "issued", num: {}, role: {} }) },
    },
  };
  let glance: GlanceItem[] = [];
  if (hasOutcomes) {
    const t = sumOutcomes(glanceRows);
    glance = [
      { label: "Conferences", value: t.conferences, ...allConferences },
      { label: "Submitted", value: t.submitted, ...byNumber("submitted") },
      { label: "Accepted", value: t.accepted, color: "var(--success)", ...byNumber("accepted") },
      ...D_ACCEPTED.map((c) => ({ label: c.label, value: t[c.key], color: c.color, sub: true, tone: c.action ? ("warning" as const) : undefined, ...byNumber(c.key) })),
      { label: "Not Accepted", value: t.rejected, color: "var(--ink-soft)", ...byNumber("rejected") },
      { label: "Revision Required", value: t.revise, color: "var(--warning)", ...byNumber("revise") },
      { label: "Waitlisted", value: t.waitlist, color: "var(--ink-soft)", ...byNumber("waitlist") },
      { label: "No decision", value: t.noDecision, color: "var(--ink-soft)", ...byNumber("noDecision") },
    ];
  } else if (view !== "all") {
    const totals = sumRoleCounts(glanceRows, view);
    const items: Array<{ label: string; value: number; color?: string; tone?: "warning" }> =
      view === "reviewer" ? [
        { label: "Conferences", value: totals.conferences },
        { label: "Papers assigned", value: totals.assigned },
        { label: "Reviewed", value: totals.done, color: "var(--success)" },
        { label: "Pending", value: totals.pending, color: "var(--warning)", tone: "warning" },
        { label: "Invitation Rejected", value: totals.declined, color: "var(--ink-soft)" },
        { label: "Review Overdue", value: totals.overdue, color: "var(--danger)" },
      ] : view === "chair" ? [
        { label: "Conferences", value: totals.conferences },
        { label: "Submissions", value: totals.received },
        { label: "Accepted", value: totals.accepted, color: "var(--success)" },
        { label: "Rejected", value: totals.rejected, color: "var(--ink-soft)" },
        { label: "No decision", value: totals.undecided, color: "var(--warning)", tone: "warning" },
        { label: "Withdrawn", value: totals.withdrawn, color: "var(--ink-muted)" },
        { label: "Marked registered", value: totals.registrations, color: "var(--primary)" },
      ] : [
        { label: "Conferences", value: totals.conferences },
        { label: "Upcoming", value: totals.upcoming },
        { label: "Finished", value: totals.finished },
        { label: "Certificates ready", value: totals.certificates, color: "var(--primary)" },
      ];
    glance = items.map((it) => ({ ...it, ...(it.label === "Conferences" ? allConferences : GLANCE_ACTIONS[view]?.[it.label]) }));
  }
  glance = glance.map((it) => ({ ...it, label: D_STATUS_LABELS[view]?.[it.label] || it.label }));

  /* ---------- All conferences: one card per role ---------- */
  const cardRows = rows.filter((r) => !filters.years.length || filters.years.includes(r.year));
  const rolesRows = (role: ConferenceRole) => cardRows.filter((r) => r.roles.includes(role));
  const authorT = sumOutcomes(rolesRows("author"));
  const chairT = sumRoleCounts(rolesRows("chair"), "chair");
  const reviewerT = sumRoleCounts(rolesRows("reviewer"), "reviewer");
  const committeeT = sumRoleCounts(rolesRows("committee"), "committee");
  // A number in a role card opens that role's view with the same filter its strip number applies.
  const openRole = (role: RoleFilter, action?: Action) => (action ? () => { pickRole(role); action.apply(); } : undefined);
  const statCards: Array<{ key: RoleFilter; count: number; stats: RoleStat[] }> = [
    {
      key: "all", count: cardRows.length,
      // How many conferences you hold each role in; a line opens that role.
      stats: (["chair", "author", "reviewer", "committee"] as const).map((role) => ({ label: ROLE_META[role].label, value: rolesRows(role).length, color: ROLE_META[role].accent, onClick: () => pickRole(role) })),
    },
    {
      key: "author", count: authorT.conferences,
      stats: [
        { label: "Submissions", value: authorT.submitted, onClick: openRole("author", byNumber("submitted")) },
        { label: "Accepted – Registration Pending", value: authorT.pending, color: "var(--warning)", attention: true, onClick: openRole("author", byNumber("pending")) },
        { label: "Registered", value: authorT.registered, color: "var(--success)", onClick: openRole("author", byNumber("registered")) },
        { label: "Not Accepted", value: authorT.rejected, color: "var(--ink-soft)", onClick: openRole("author", byNumber("rejected")) },
        { label: "No Decision", value: authorT.noDecision, color: "var(--ink-soft)", onClick: openRole("author", byNumber("noDecision")) },
      ],
    },
    {
      key: "chair", count: chairT.conferences,
      stats: [
        { label: "Submissions", value: chairT.received, onClick: openRole("chair", byRole("ch-received", "some")) },
        { label: "Accepted", value: chairT.accepted, color: "var(--success)", onClick: openRole("chair", byRole("ch-decisions", "accepted")) },
        { label: "Reject", value: chairT.rejected, color: "var(--ink-soft)", onClick: openRole("chair", byRole("ch-decisions", "rejected")) },
        { label: "No Decision", value: chairT.undecided, color: "var(--warning)", attention: true, onClick: openRole("chair", byRole("ch-decisions", "undecided")) },
        { label: "Withdrawn", value: chairT.withdrawn, color: "var(--ink-muted)", onClick: openRole("chair", byRole("ch-decisions", "withdrawn")) },
        { label: "Marked registered", value: chairT.registrations, color: "var(--primary)", onClick: openRole("chair", byRole("ch-registrations", "some")) },
      ],
    },
    {
      key: "reviewer", count: reviewerT.conferences,
      stats: [
        { label: "Papers assigned", value: reviewerT.assigned, onClick: openRole("reviewer", GLANCE_ACTIONS.reviewer["Papers assigned"]) },
        { label: "Reviewed", value: reviewerT.done, color: "var(--success)", onClick: openRole("reviewer", GLANCE_ACTIONS.reviewer.Reviewed) },
        { label: "Pending", value: reviewerT.pending, color: "var(--warning)", attention: true, onClick: openRole("reviewer", GLANCE_ACTIONS.reviewer.Pending) },
        { label: "Invitation Rejected", value: reviewerT.declined, color: "var(--ink-soft)", onClick: openRole("reviewer", GLANCE_ACTIONS.reviewer["Invitation Rejected"]) },
        { label: "Review Overdue", value: reviewerT.overdue, color: "var(--danger)", attention: true, onClick: openRole("reviewer", GLANCE_ACTIONS.reviewer["Review Overdue"]) },
      ],
    },
    {
      key: "committee", count: committeeT.conferences,
      stats: [
        { label: "Upcoming", value: committeeT.upcoming, color: "var(--success)", onClick: () => { pickRole("committee"); setStatus("active"); } },
        { label: "Finished", value: committeeT.finished, onClick: () => { pickRole("committee"); setStatus("archived"); } },
        { label: "Certificates ready", value: committeeT.certificates, color: "var(--primary)", onClick: () => { pickRole("committee"); setF({ cert: "issued" }); } },
        { label: "Committee roles held", value: new Set(rolesRows("committee").map((r) => r.committee?.label)).size },
      ],
    },
  ];
  statCards.sort((a, b) => ROLE_ORDER.indexOf(a.key) - ROLE_ORDER.indexOf(b.key));

  /* ---------- filter chips ---------- */
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.id) chips.push({ key: "id", label: `ID: ${filters.id}`, clear: () => setF({ id: "" }) });
  if (filters.text) chips.push({ key: "text", label: `Conference: "${filters.text}"`, clear: () => setF({ text: "" }) });
  if (filters.years.length) chips.push({ key: "years", label: `Year: ${filters.years.join(", ")}`, clear: () => setF({ years: [] }) });
  if (filters.countries.length) chips.push({ key: "countries", label: `Location: ${filters.countries.length > 2 ? `${filters.countries.length} countries` : filters.countries.join(", ")}`, clear: () => setF({ countries: [] }) });
  if (filters.cert !== "any") chips.push({ key: "cert", label: filters.cert === "issued" ? "Certificate: ready" : "Certificate: not yet", clear: () => setF({ cert: "any" }) });
  if (hasOutcomes) D_NUM_FILTERS.forEach((c) => {
    const rule = filters.num[c.key];
    if (rule && rule !== "any") chips.push({ key: `num-${c.key}`, label: `${c.label}: ${rule === "some" ? "1 or more" : "none"}`, clear: () => setNum(c.key, "any") });
  });
  roleColumns.forEach((c) => {
    const sel = filters.role[c.key];
    if (sel?.length) chips.push({ key: `role-${c.key}`, label: `${c.label}: ${sel.map((v) => c.options.find((o) => o.value === v)?.label || v).join(", ")}`, clear: () => setRoleValues(c.key, []) });
  });

  /* ---------- column filters ---------- */
  const idFilter = (
    <FilterPopover label="ID" active={!!filters.id}>
      <PopoverTitle>ID contains</PopoverTitle>
      <TextFilter label="ID contains" value={filters.id} onChange={(v) => setF({ id: v.replace(/\D/g, "") })} placeholder="e.g. 12" />
      <ClearLink onClick={() => setF({ id: "" })} />
    </FilterPopover>
  );
  const conferenceFilter = (
    <FilterPopover label="conference" active={!!filters.text}>
      <PopoverTitle>Name or acronym contains</PopoverTitle>
      <TextFilter label="Name or acronym contains" value={filters.text} onChange={(v) => setF({ text: v })} placeholder="e.g. ICTCS or Computing" />
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
  const roleFilterPopover = (col: RoleColumn, alignRight: boolean) => (
    <FilterPopover label={col.label} active={!!filters.role[col.key]?.length} alignRight={alignRight}>
      <PopoverTitle>{col.label}</PopoverTitle>
      <CheckList
        options={col.options.map((o) => ({ value: o.value, label: o.label, count: countFor(`role-${col.key}`, o.test) })).filter((o) => o.count > 0 || filters.role[col.key]?.includes(o.value))}
        selected={filters.role[col.key] || []}
        onChange={(v) => setRoleValues(col.key, v)}
      />
      <ClearLink onClick={() => setRoleValues(col.key, [])} />
    </FilterPopover>
  );
  const glanceYearFilter = (
    <FilterPopover label="at a glance by year" active={filters.years.length > 0} buttonLabel={filters.years.length ? filters.years.join(", ") : "All time"}>
      <PopoverTitle>Show conferences held in</PopoverTitle>
      <CheckList options={glanceYearOptions.map((y) => ({ value: y, label: y, count: roleRows.filter((r) => r.year === y).length }))} selected={filters.years} onChange={(v) => setF({ years: v })} />
      <ClearLink onClick={() => setF({ years: [] })} />
    </FilterPopover>
  );

  /* ---------- table ---------- */
  const rowSpan = hasOutcomes || chairNumbers ? 2 : 1;
  const acceptedTotal = hasOutcomes ? filtered.reduce((n, r) => n + (r.outcomes.author?.accepted || 0), 0) : 0;
  // The reviewer's counts are number columns; of its other columns only "Next due" stays.
  const shownRoleColumns = reviewerNumbers ? roleColumns.filter((c) => c.key === "rv-due") : roleColumns;
  const groupCols = hasOutcomes ? D_ACCEPTED : chairNumbers ? D_CHAIR_DECISIONS : [];
  const groupHeadCls = "border-x border-b border-x-line border-b-primary-soft-border bg-primary-soft px-4 py-2.5 text-center text-[13px] font-extrabold text-primary-hover";
  const sortHead = (label: string, key: string, labels?: [string, string]) => <SortHeader label={label} sortKey={key} sort={sort} onSort={setSort} labels={labels} />;

  // "2 Pending" over the reviewed-of-assigned progress bar; nothing pending shows the usual dash.
  const pendingCell = (row: DashboardRow) => {
    const { assigned = 0, done = 0, pending = 0 } = row.reviewer ?? {};
    return (
      <td key="pending" className="px-4 py-3.5 align-top">
        {!pending ? (
          <span className="text-[15px] font-bold text-line-strong" aria-label="0">–</span>
        ) : (
          <div className="min-w-[110px]">
            <div className="mb-1.5 whitespace-nowrap text-[13px] font-bold text-warning">{pending} Pending</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div style={{ width: `${(done / assigned) * 100}%` }} className="h-full rounded-full bg-warning" /></div>
          </div>
        )}
      </td>
    );
  };

  const outcomeCell = (row: DashboardRow, col: { key: string; color: string; accepted?: boolean; action?: boolean }) => {
    const v = valueOf(row, col.key);
    const register = Boolean(col.action) && v > 0 && view === "author";
    return (
      <td
        key={col.key}
        style={{
          background: register ? "var(--warning-soft)" : col.accepted ? "rgba(238,242,255,0.45)" : "transparent",
          borderLeft: col.key === "registered" ? "1px solid var(--border)" : "none",
          borderRight: col.key === "pending" ? "1px solid var(--border)" : "none",
        }}
        className="px-2 py-3.5 text-center align-top"
      >
        {v === 0 ? (
          <span className="text-[15px] font-bold text-line-strong" aria-label="0">–</span>
        ) : register ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRegister(row.conf); }} className="inline-flex flex-col items-center">
            <span className="text-[17px] font-extrabold leading-tight text-warning">{v}</span>
            <span className="whitespace-nowrap text-[11px] font-bold text-[#92400E] underline-offset-2 hover:underline">Register now</span>
          </button>
        ) : (
          <span style={{ color: col.color }} className="text-[17px] font-extrabold">{v}</span>
        )}
      </td>
    );
  };

  const roleTitle = view !== "all" ? ROLE_META[view].chip : null;

  return (
    <div className="space-y-5 p-8">
      {roleTitle && <p className="sr-only" aria-live="polite">Showing conferences as {roleTitle}</p>}
      {bannerNode}
      {view === "all" ? (
        <div className="grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statCards.map((c) => (
            <RoleStatCard key={c.key} role={c.key} count={c.count} stats={c.stats} active={roleFilter === c.key} onSelectRole={() => pickRole(c.key)} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {ROLE_ORDER.map((k) => <RoleTile key={k} role={k} count={roleCounts[k]} active={roleFilter === k} onSelect={() => pickRole(k)} />)}
        </div>
      )}

      {glance.length > 0 && view !== "all" && <GlanceStrip role={view} items={glance} yearFilter={glanceYearFilter} />}
      {belowGlanceNode}

      {extra && (
        <div id="dashboard-list-tabs" role="tablist" aria-label="Dashboard view" className="flex items-center gap-6 border-b border-line" style={{ scrollMarginTop: 80 }}>
          {[{ key: "conferences", label: "My conferences", count: 0 }, { key: extra.key, label: extra.label, count: extra.count ?? 0 }].map((t) => {
            const on = listView === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setListView(t.key)}
                style={{ borderBottom: `2px solid ${on ? "var(--primary)" : "transparent"}` }}
                className={cn("-mb-px inline-flex items-center gap-2 pb-2.5 text-[13.5px] transition-colors hover:text-navy", on ? "font-extrabold text-navy" : "font-bold text-ink-muted")}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="relative inline-flex" aria-label={`${t.count} waiting`}>
                    <span aria-hidden="true" className="hd-ping absolute inset-0 rounded-full bg-danger" />
                    <span className="hd-blink relative inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-extrabold text-white shadow-[0_2px_8px_rgba(220,38,38,0.35)]">{t.count}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {listView !== "conferences" && extra ? extra.render() : (
        <>
          {listTopNode}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Conference status" className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
              {D_STATUS.map((s) => {
                const on = status === s.key;
                const n = s.key === "all" ? countFor("status", () => true) : countFor("status", (r) => (s.key === "active") === isActiveRow(r));
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatus(s.key)}
                    className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors hover:bg-canvas hover:text-navy", on ? "bg-navy text-white" : "text-ink-soft")}
                  >
                    {s.label}
                    <span className={cn("rounded-full px-1.5 py-px text-[10.5px]", on ? "bg-white/20 text-white" : "bg-muted text-ink-muted")}>{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SearchField label="Search conferences" value={search} onChange={setSearch} placeholder="Search by ID, name or short name…" />
              {roleFilter === "chair" && (
                <Link href="/create-conference" className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"><Plus size={16} aria-hidden="true" /> Create New Conference</Link>
              )}
            </div>
          </div>

          <div className="-mt-1 flex min-h-[32px] flex-wrap items-center gap-2">
            {chips.length > 0 ? (
              <>
                <span className="text-[12.5px] font-semibold text-ink-muted">Filters on:</span>
                {chips.map((c) => (
                  <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft py-1 pl-2.5 pr-1.5 text-[12.5px] font-bold text-primary-hover">
                    {c.label}
                    <button type="button" aria-label={`Remove ${c.label}`} onClick={c.clear} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white"><X size={12} strokeWidth={3} aria-hidden="true" /></button>
                  </span>
                ))}
                <button type="button" onClick={() => setFilters(D_EMPTY)} className="text-[12.5px] font-bold text-primary hover:underline">Clear all</button>
              </>
            ) : (
              <span className="text-[12.5px] font-medium text-ink-faint">Use the <Funnel size={11} className="-mt-0.5 inline" aria-hidden="true" /> on any column to filter.</span>
            )}
          </div>

          <div className="relative rounded-2xl border border-line bg-white shadow-card">
            {/* Wide tables scroll sideways inside this box at every width; FilterPopover opens `fixed`, so it isn't clipped. */}
            <div className="relative overflow-x-auto rounded-2xl">
              <table className="ui-table w-full text-[13.5px]">
                <caption className="sr-only">Your conferences</caption>
                <thead>
                  <tr className="bg-canvas text-ink-soft">
                    <th scope="col" rowSpan={rowSpan} className={cn(TH, HEAD_BORDER, "w-16 rounded-tl-2xl")}><HeaderCell label={sortHead("ID", "id")} filter={idFilter} /></th>
                    <th scope="col" rowSpan={rowSpan} className={cn(TH, HEAD_BORDER, "min-w-[280px]")}><HeaderCell label="Conference" filter={conferenceFilter} /></th>
                    <th scope="col" rowSpan={rowSpan} className={cn(TH, HEAD_BORDER)}><HeaderCell label={sortHead("Conference date", "date", ["Latest first", "Earliest first"])} filter={datesFilter} /></th>
                    <th scope="col" rowSpan={rowSpan} className={cn(TH, HEAD_BORDER, "w-[170px]")}><HeaderCell label="Location" filter={locationFilter} /></th>
                    {hasOutcomes ? (
                      <>
                        {["submitted", "accepted", "rejected", "revise", "waitlist", "noDecision"].map((k) => (
                          <th key={k} scope="col" rowSpan={2} className={cn(TH, HEAD_BORDER, "text-center")}>{sortHead(D_AUTHOR_HEADS[k] ?? k[0].toUpperCase() + k.slice(1), k)}</th>
                        ))}
                        {/* The accepted papers, split by registration — their sum is the Accepted column. */}
                        <th colSpan={3} className={groupHeadCls}>Accepted papers — registration <span className="text-primary">({acceptedTotal})</span></th>
                      </>
                    ) : chairNumbers ? (
                      <>
                        <th scope="col" rowSpan={2} className={cn(TH, HEAD_BORDER, "text-center")}>{sortHead("Submissions", "received")}</th>
                        <th colSpan={D_CHAIR_DECISIONS.length} className={groupHeadCls}>Decisions</th>
                        <th scope="col" rowSpan={2} className={cn(TH, HEAD_BORDER, "text-center")}>{sortHead("Marked registered", "registrations")}</th>
                      </>
                    ) : (
                      <>
                        {reviewerNumbers && D_REVIEWER_COLUMNS.map((col) => (
                          <th key={col.key} scope="col" className={cn(TH, HEAD_BORDER, col.key !== "pending" && "text-center")}>{sortHead(col.label, col.key)}</th>
                        ))}
                        {shownRoleColumns.map((col, i) => (
                          <th key={col.key} scope="col" className={cn(TH, HEAD_BORDER, col.center && "text-center")}>
                            <HeaderCell label={col.label} filter={roleFilterPopover(col, i === shownRoleColumns.length - 1)} className={col.center ? "justify-center" : ""} />
                          </th>
                        ))}
                      </>
                    )}
                    {showCert && <th scope="col" rowSpan={rowSpan} className={cn(TH, HEAD_BORDER, "text-center")}>Certificate</th>}
                    <th scope="col" rowSpan={rowSpan} className={cn(HEAD_BORDER, "w-10 rounded-tr-2xl")}><span className="sr-only">Open</span></th>
                  </tr>
                  {groupCols.length > 0 && (
                    <tr className="bg-[#F5F7FF] text-ink-soft">
                      {groupCols.map((col, i) => (
                        <th
                          key={col.key}
                          scope="col"
                          style={{ borderLeft: i === 0 ? "1px solid var(--border)" : "1px solid var(--primary-soft)", borderRight: i === groupCols.length - 1 ? "1px solid var(--border)" : "none" }}
                          className={cn(HEAD_BORDER, "px-2 py-2 text-center text-xs font-bold leading-tight")}
                        >
                          {sortHead(col.label, col.key)}
                        </th>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filtered.map((row, ri) => {
                    const active = isActiveRow(row);
                    return (
                      <tr key={row.conf.id} onClick={() => handleRowClick(row)} className={cn("cursor-pointer border-b border-muted transition-colors", ri % 2 === 1 && "ui-row-alt")}>
                        <td className="px-4 py-3.5 align-top font-semibold tabular-nums text-ink-faint">{row.conf.number}</td>
                        <ConferenceCell row={row} />
                        <DatesCell row={row} withStatusPill />
                        <LocationCell row={row} />
                        {hasOutcomes
                          ? D_AUTHOR_COLUMNS.map((col) => outcomeCell(row, col))
                          : chairNumbers
                            ? [
                              <NumberCell key="received" value={row.chair?.received ?? 0} color="var(--navy)" />,
                              ...D_CHAIR_DECISIONS.map((col, i) => (
                                <NumberCell
                                  key={col.key}
                                  value={(row.chair as unknown as Record<string, number> | null)?.[col.key] ?? 0}
                                  color={col.color}
                                  style={{ background: "rgba(238,242,255,0.45)", borderLeft: i === 0 ? "1px solid var(--border)" : "none", borderRight: i === D_CHAIR_DECISIONS.length - 1 ? "1px solid var(--border)" : "none" }}
                                />
                              )),
                              <NumberCell key="registrations" value={row.chair?.registrations ?? 0} color="var(--primary)" />,
                            ]
                            : [
                              ...(reviewerNumbers ? D_REVIEWER_COLUMNS.map((col) => (col.key === "pending" ? pendingCell(row) : <NumberCell key={col.key} value={(row.reviewer as unknown as Record<string, number> | null)?.[col.key] ?? 0} color={col.color} />)) : []),
                              ...shownRoleColumns.map((col) => <td key={col.key} className={cn("px-4 py-3.5 align-top", col.center && "text-center")}>{col.render(row)}</td>),
                            ]}
                        {showCert && <td className="px-4 py-3.5 text-center align-top"><CertificateBadge certificate={certOf(row)} onOpen={onOpenCertificates} /></td>}
                        <td className="px-3 py-3.5 align-top"><ChevronRight size={16} className={active ? "text-line-strong" : "text-line-strong"} aria-hidden="true" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              rows.length === 0 ? (
                <EmptyState icon={Building2} title="You have no conferences yet." description="Conferences you chair, submit to, or review for will appear here." />
              ) : (
                <EmptyState
                  icon={Building2}
                  title="No conferences match these filters."
                  action={<button type="button" onClick={() => { setFilters(D_EMPTY); setSearch(""); setStatus("all"); }} className="text-sm font-bold text-primary hover:underline">Clear filters</button>}
                />
              )
            )}
          </div>
        </>
      )}
      <RoleChoiceDialog row={roleModalRow} onClose={() => setRoleModalRow(null)} onEnter={onEnter} />
    </div>
  );
}
