import type { ReactNode } from "react";
import type { Conference, ConferenceRole } from "@/types/conference";
import { COMMITTEE_ROLES, type DashboardRow, type NextStep } from "./derive";
import { ROLE_META, type RoleFilter } from "./roles";

const DAY_MS = 24 * 60 * 60 * 1000;
const dueLabel = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

export interface ColumnOption {
  value: string;
  label: string;
  test: (r: DashboardRow) => boolean;
}

/** A role-specific column: renders its cell and brings its own filter options. */
export interface RoleColumn {
  key: string;
  label: string;
  center?: boolean;
  render: (r: DashboardRow) => ReactNode;
  options: ColumnOption[];
}

export function BigNumber({ value, color = "var(--navy)" }: { value: number; color?: string }) {
  return value === 0
    ? <span className="text-[15px] font-bold text-ink-faint" aria-label="0">–</span>
    : <span style={{ color }} className="text-[17px] font-extrabold">{value}</span>;
}

function RoleNext({ next, role, conf, onEnter }: { next: NextStep; role: ConferenceRole; conf: Conference; onEnter: (c: Conference, r: ConferenceRole) => void }) {
  if (next.action) {
    const danger = next.tone === "danger";
    return (
      <div className="flex flex-col items-start gap-1">
        <span style={{ color: danger ? "var(--danger-ink)" : "var(--ink-soft)" }} className="text-[12.5px] font-bold">{next.text}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEnter(conf, role); }}
          style={{ background: danger ? "var(--danger)" : "var(--primary)" }}
          className="whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] font-bold text-white hover:brightness-95"
        >
          {typeof next.action === "string" ? next.action : "Open"}
        </button>
      </div>
    );
  }
  return <span title={next.note} className={`text-[12.5px] font-bold ${next.key === "none" ? "text-ink-faint" : "text-ink-soft"}`}>{next.text}</span>;
}

const NEXT_LABELS: Record<string, string> = {
  overdue: "Reviews overdue", review: "Reviews to do", done: "All reviews sent", waiting: "No papers assigned yet",
  setup: "Setup not finished", decide: "Papers need a decision", registrations: "Accepted papers not marked registered", ready: "All papers decided",
  certificate: "Certificate ready", upcoming: "Upcoming", none: "Finished / nothing to do",
};
const nextOptions = (pick: (r: DashboardRow) => { next: NextStep } | null, keys: string[]): ColumnOption[] =>
  keys.map((k) => ({ value: k, label: NEXT_LABELS[k], test: (r) => pick(r)?.next.key === k }));

const Pill = ({ color, bg, children }: { color: string; bg: string; children: ReactNode }) => (
  <span style={{ color, background: bg }} className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold">{children}</span>
);

/** Columns for every view except the author one (which has its own layout). */
export function buildRoleColumns(view: RoleFilter, onEnter: (c: Conference, r: ConferenceRole) => void): RoleColumn[] {
  if (view === "reviewer") {
    return [
      {
        key: "rv-assigned", label: "Papers assigned to me", center: true,
        render: (r) => <BigNumber value={r.reviewer?.assigned ?? 0} />,
        options: [
          { value: "some", label: "1 or more papers", test: (r) => (r.reviewer?.assigned ?? 0) > 0 },
          { value: "none", label: "None assigned yet", test: (r) => (r.reviewer?.assigned ?? 0) === 0 },
        ],
      },
      {
        key: "rv-progress", label: "Reviews done",
        render: (r) => {
          const { assigned = 0, done = 0 } = r.reviewer ?? {};
          if (!assigned) return <span className="text-[12.5px] text-ink-faint">—</span>;
          return (
            <div className="min-w-[120px]">
              <div className="text-[13px] font-bold text-navy">{done} of {assigned}</div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div style={{ width: `${(done / assigned) * 100}%`, background: done === assigned ? "var(--success)" : "var(--primary)" }} className="h-full rounded-full" />
              </div>
            </div>
          );
        },
        options: [
          { value: "pending", label: "Still have reviews to do", test: (r) => (r.reviewer?.pending ?? 0) > 0 },
          { value: "done", label: "All reviews sent", test: (r) => (r.reviewer?.assigned ?? 0) > 0 && r.reviewer?.pending === 0 },
          { value: "declined", label: "Rejected an invitation", test: (r) => (r.reviewer?.declined ?? 0) > 0 },
        ],
      },
      {
        key: "rv-due", label: "Next due",
        render: (r) => {
          const rv = r.reviewer;
          if (!rv) return null;
          const days = Math.round((rv.due.getTime() - Date.now()) / DAY_MS);
          const tone = rv.overdue ? "var(--danger)" : rv.pending && days <= 14 ? "var(--warning)" : "var(--ink-muted)";
          return (
            <div className="whitespace-nowrap">
              <div className="text-[13px] font-semibold text-ink">{dueLabel(rv.due)}</div>
              <div style={{ color: tone }} className="text-xs font-semibold">
                {r.conf.status === "archived" ? "Closed"
                  : !rv.assigned ? "No papers yet"
                    : !rv.pending ? "All reviews sent"
                      : rv.overdue ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
                        : `in ${days} day${days === 1 ? "" : "s"}`}
                {rv.pending > 0 && rv.dueSubId && r.conf.status !== "archived" && <span className="font-medium text-ink-faint"> · {rv.dueSubId}</span>}
              </div>
            </div>
          );
        },
        options: [
          { value: "overdue", label: "Overdue", test: (r) => Boolean(r.reviewer?.overdue) },
          { value: "soon", label: "Due in the next 30 days", test: (r) => Boolean(r.reviewer && r.reviewer.pending > 0 && !r.reviewer.overdue && r.reviewer.due.getTime() - Date.now() <= 30 * DAY_MS) },
          { value: "later", label: "Due later", test: (r) => Boolean(r.reviewer && r.reviewer.pending > 0 && r.reviewer.due.getTime() - Date.now() > 30 * DAY_MS) },
        ],
      },
      {
        key: "rv-next", label: "What's next",
        render: (r) => r.reviewer && <RoleNext next={r.reviewer.next} role="reviewer" conf={r.conf} onEnter={onEnter} />,
        options: nextOptions((r) => r.reviewer, ["overdue", "review", "waiting", "done", "none"]),
      },
    ];
  }
  if (view === "chair") {
    return [
      {
        key: "ch-received", label: "Submissions", center: true,
        render: (r) => <BigNumber value={r.chair?.received ?? 0} />,
        options: [
          { value: "some", label: "Has submissions", test: (r) => (r.chair?.received ?? 0) > 0 },
          { value: "none", label: "No submissions yet", test: (r) => (r.chair?.received ?? 0) === 0 },
        ],
      },
      {
        key: "ch-decisions", label: "Decisions",
        render: (r) => {
          const { accepted = 0, rejected = 0, undecided = 0, withdrawn = 0 } = r.chair ?? {};
          return (
            <div className="flex max-w-[260px] flex-wrap gap-1.5">
              <Pill color="#15803D" bg="var(--success-soft)">{accepted} accepted</Pill>
              <Pill color="var(--ink-soft)" bg="var(--muted)">{rejected} rejected</Pill>
              {undecided > 0 && <Pill color="#92400E" bg="var(--warning-soft)">{undecided} no decision</Pill>}
              {withdrawn > 0 && <Pill color="var(--ink-muted)" bg="var(--muted)">{withdrawn} withdrawn</Pill>}
            </div>
          );
        },
        options: [
          { value: "accepted", label: "Has accepted papers", test: (r) => (r.chair?.accepted ?? 0) > 0 },
          { value: "rejected", label: "Has rejected papers", test: (r) => (r.chair?.rejected ?? 0) > 0 },
          { value: "undecided", label: "Some papers need a decision", test: (r) => (r.chair?.undecided ?? 0) > 0 },
          { value: "withdrawn", label: "Has withdrawn papers", test: (r) => (r.chair?.withdrawn ?? 0) > 0 },
          { value: "decided", label: "All papers decided", test: (r) => Boolean(r.chair && r.chair.received > 0 && r.chair.undecided === 0) },
        ],
      },
      {
        key: "ch-registrations", label: "Marked registered", center: true,
        render: (r) => <BigNumber value={r.chair?.registrations ?? 0} color="var(--primary)" />,
        options: [
          { value: "some", label: "Some marked registered", test: (r) => (r.chair?.registrations ?? 0) > 0 },
          { value: "none", label: "None marked registered", test: (r) => (r.chair?.registrations ?? 0) === 0 },
        ],
      },
      {
        key: "ch-next", label: "What's next",
        render: (r) => r.chair && <RoleNext next={r.chair.next} role="chair" conf={r.conf} onEnter={onEnter} />,
        options: nextOptions((r) => r.chair, ["setup", "decide", "registrations", "ready", "none"]),
      },
    ];
  }
  if (view === "committee") {
    return [
      {
        key: "cm-role", label: "Committee role",
        render: (r) => <Pill color="var(--cat-virtual)" bg="var(--cat-virtual-soft)">{r.committee?.label}</Pill>,
        options: COMMITTEE_ROLES.map((c) => ({ value: c, label: c, test: (r) => r.committee?.label === c })),
      },
      {
        key: "cm-next", label: "What's next",
        render: (r) => r.committee && <RoleNext next={r.committee.next} role="committee" conf={r.conf} onEnter={onEnter} />,
        options: nextOptions((r) => r.committee, ["certificate", "upcoming", "none"]),
      },
    ];
  }
  if (view === "all") {
    return [
      {
        key: "all-roles", label: "My roles",
        render: (r) => (
          <div className="flex max-w-[240px] flex-wrap gap-1">
            {r.roles.map((x) => (
              <span key={x} style={{ color: ROLE_META[x].accent, background: ROLE_META[x].soft }} className="rounded-full px-2 py-0.5 text-[11px] font-bold">{ROLE_META[x].chip}</span>
            ))}
          </div>
        ),
        options: (["author", "chair", "reviewer", "committee"] as const).map((x) => ({ value: x, label: ROLE_META[x].chip, test: (r) => r.roles.includes(x) })),
      },
    ];
  }
  return [];
}

export interface SummaryItem {
  label: string;
  value: number;
  color?: string;
  tone?: "warning";
  dark?: string;
}

/** The numbers each role sees at a glance (Option B's strip; its totals bar reuses them). */
export function roleSummaryItems(view: RoleFilter, t: Record<string, number>): SummaryItem[] {
  if (view === "reviewer") return [
    { label: "Conferences", value: t.conferences },
    { label: "Papers assigned", value: t.assigned },
    { label: "Reviewed", value: t.done, color: "var(--success-ink)", dark: "#86EFAC" },
    { label: "Pending", value: t.pending, color: "var(--warning-ink)", tone: "warning", dark: "#FCD34D" },
    { label: "Invitation Rejected", value: t.declined, color: "var(--ink-soft)", dark: "#CBD5E1" },
    { label: "Review Overdue", value: t.overdue, color: "var(--danger-ink)", dark: "#FCA5A5" },
  ];
  if (view === "chair") return [
    { label: "Conferences", value: t.conferences },
    { label: "Submissions", value: t.received },
    { label: "Accepted", value: t.accepted, color: "var(--success-ink)", dark: "#86EFAC" },
    { label: "Rejected", value: t.rejected, color: "var(--ink-soft)", dark: "#CBD5E1" },
    { label: "No decision", value: t.undecided, color: "var(--warning-ink)", tone: "warning", dark: "#FCD34D" },
    { label: "Withdrawn", value: t.withdrawn || 0, color: "var(--ink-muted)", dark: "#CBD5E1" },
    { label: "Marked registered", value: t.registrations, color: "var(--primary)" },
  ];
  if (view === "committee") return [
    { label: "Conferences", value: t.conferences },
    { label: "Upcoming", value: t.upcoming },
    { label: "Finished", value: t.finished },
    { label: "Certificates ready", value: t.certificates, color: "var(--primary)" },
  ];
  return [];
}
