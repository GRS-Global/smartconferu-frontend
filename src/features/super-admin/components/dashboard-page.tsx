"use client";
/* Dashboard (the prototype's DashboardPage), built around "what needs me today?": a greeting with the
   one next action, chairs' deletion requests, five KPI tiles (each opens its list), the approval
   queues (pending · oldest · late), what has waited longest, review health across the live
   conferences, and recent activity. Claims ("Assigned to you"), licenses and the monthly activity
   chart need backend work: their tiles say "coming soon" rather than show invented numbers. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Library,
  UserCheck,
} from "lucide-react";
import { useAdmin } from "../session";
import { isLate, pendingFrom, QUEUE_INFO, QUEUE_KEYS } from "../pending";
import {
  loadActivity,
  loadCfps,
  loadConferencePapers,
  loadConferences,
  loadDeletionRequests,
  loadLicenseRequests,
  loadQueueState,
} from "../services";
import { useData } from "../use-data";
import { activityText, activityTone } from "./activity";
import { DeletionRequestsBanner } from "./deletion-banner";
import { daysUntil } from "./more-queues";
import { ActivityChart } from "./activity-chart";
import { ReviewHealthCard } from "./review-card";
import { CONF_STATUS } from "./conferences-page";
import {
  Avatar,
  Badge,
  Card,
  CardTitle,
  Failed,
  fmtDate,
  Loading,
  SLA_DAYS,
  TONES,
  WaitingBadge,
  waitingLabel,
  type Icon,
  type Tone,
} from "./ui";

const LICENSE_WINDOW_DAYS = 30;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export function DashboardPage() {
  const router = useRouter();
  const { me, name } = useAdmin();
  const { data, error, loading, reload } = useData(async () => {
    const [conferences, deletions, licenses, cfps, activity] =
      await Promise.all([
        loadConferences(),
        loadDeletionRequests(),
        loadLicenseRequests("pending").catch(() => []),
        loadCfps("in_review").catch(() => []),
        loadActivity({ limit: 6 }),
      ]);
    const live = conferences.filter((c) => c.status === "active");
    const papers = await Promise.all(
      live.map((c) => loadConferencePapers(c.id).catch(() => [])),
    );
    // Who is on what, per queue ("Assigned to you").
    const claims = await Promise.all(
      QUEUE_KEYS.map((k) =>
        loadQueueState(k)
          .then((st) => st.claims.map((c) => `${k}:${c.itemId}:${c.admin.id}`))
          .catch(() => [] as string[]),
      ),
    );
    return {
      conferences,
      deletions,
      licenses,
      cfps,
      claims: new Set(claims.flat()),
      activity: activity.data,
      review: live.map((conference, i) => ({ conference, papers: papers[i] })),
    };
  });
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const { conferences, deletions, licenses, cfps, claims, activity, review } =
    data;

  const pending = pendingFrom(conferences, deletions, licenses, cfps);
  const late = pending.filter(isLate);
  const mine = pending.filter((p) => claims.has(`${p.queue}:${p.id}:${me.id}`));
  const live = conferences.filter((c) => c.status === "active");
  const expiring = live
    .map((c) => ({ ...c, left: daysUntil(c.licenseExpiry) }))
    .sort((a, b) => a.left - b.left);
  const endingSoon = expiring.filter((c) => c.left <= LICENSE_WINDOW_DAYS);
  const queueKeys = QUEUE_KEYS;
  const queues = queueKeys
    .map((key) => {
      const items = pending.filter((p) => p.queue === key);
      return {
        key,
        ...QUEUE_INFO[key],
        pending: items.length,
        oldest: items[0] ?? null,
        late: items.filter(isLate).length,
      };
    })
    .sort((a, b) => b.late - a.late || b.pending - a.pending);

  const kpis: {
    label: string;
    value: number | string;
    sub: string;
    icon: Icon;
    tone: Tone;
    href?: string;
  }[] = [
    {
      label: "Waiting for a decision",
      value: pending.length,
      sub: `across ${queueKeys.length} queues`,
      icon: Inbox,
      tone: "primary",
      href: pending[0]?.href,
    },
    {
      label: `Past the ${SLA_DAYS}-day promise`,
      value: late.length,
      sub: late.length
        ? `oldest ${waitingLabel(late[0].since)}`
        : "all inside the limit",
      icon: AlertTriangle,
      tone: late.length ? "danger" : "success",
      href: late[0]?.href,
    },
    {
      label: "Assigned to you",
      value: mine.length,
      sub: mine.length ? "you're reviewing these" : "nothing claimed",
      icon: UserCheck,
      tone: "accent",
      href: mine[0]?.href,
    },
    {
      label: `Licenses ending in ${LICENSE_WINDOW_DAYS} days`,
      value: endingSoon.length,
      sub: endingSoon[0] ? `next: ${endingSoon[0].acronym}` : "none soon",
      icon: CalendarClock,
      tone: endingSoon.length ? "warning" : "neutral",
      href: "/super-admin/conferences",
    },
    {
      label: "Live conferences",
      value: live.length,
      sub: `${live.filter((c) => c.onTrial).length} on trial`,
      icon: Library,
      tone: "secondary",
      href: "/super-admin/conferences",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting + the one next action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p
            className="text-[13px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {fmtDate(new Date().toISOString())}
          </p>
          <h1
            className="text-[26px] font-bold tracking-tight leading-tight mt-0.5"
            style={{ color: "var(--text)" }}
          >
            {greeting()}, {name.split(" ")[0]}
          </h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-soft)" }}>
            {pending.length ? (
              <>
                {pending.length} decision{pending.length === 1 ? "" : "s"}{" "}
                waiting
                {late.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <b style={{ color: "var(--danger-ink)" }}>
                      {late.length} past the {SLA_DAYS}-day promise
                    </b>
                  </>
                )}
              </>
            ) : (
              "Every queue is clear."
            )}
          </p>
        </div>
        {pending[0] && (
          <Link
            href={pending[0].href}
            className="sa-btn inline-flex items-center gap-2 rounded-xl px-4 h-11 text-[14px] font-semibold text-white shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            Review oldest request <ArrowRight size={16} />
          </Link>
        )}
      </div>

      <div className="empty:hidden">
        <DeletionRequestsBanner requests={deletions} />
      </div>

      {/* KPI tiles — each opens what it counts */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((k) => {
          const t = TONES[k.tone];
          return (
            <button
              key={k.label}
              type="button"
              onClick={() => k.href && router.push(k.href)}
              className="sa-kpi cursor-pointer"
              disabled={!k.href}
              style={k.href ? undefined : { cursor: "default" }}
            >
              <span className="flex items-center justify-between gap-2 w-full">
                <span
                  className="text-[12.5px] font-semibold leading-snug"
                  style={{ color: "var(--text-muted)" }}
                >
                  {k.label}
                </span>
                <span
                  className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                  style={{ background: t.bg, color: t.fg }}
                >
                  <k.icon size={16} />
                </span>
              </span>
              <span
                className="text-[28px] font-bold leading-none tabular-nums"
                style={{
                  color:
                    k.tone === "danger" && k.value
                      ? "var(--danger)"
                      : "var(--text)",
                }}
              >
                {k.value}
              </span>
              <span
                className="text-[12px]"
                style={{ color: "var(--text-faint)" }}
              >
                {k.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Queues + oldest requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 !px-0 !pb-2">
          <div className="px-6">
            <CardTitle
              title="Approval queues"
              subtitle="Late ones first, then the busiest"
            />
          </div>
          <ul className="-mt-2">
            {queues.map((q) => (
              <li key={q.key} style={{ borderTop: "1px solid var(--muted)" }}>
                <Link
                  href={q.href}
                  className="sa-row-link"
                  style={{ opacity: q.pending ? 1 : 0.6 }}
                >
                  <span
                    className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0"
                    style={{
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                    }}
                  >
                    <q.icon size={17} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className="block text-[14px] font-semibold truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {q.label}
                    </span>
                    <span
                      className="block text-[12.5px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {q.oldest ? (
                        <>
                          Oldest waiting{" "}
                          {waitingLabel(q.oldest.since).toLowerCase()}
                        </>
                      ) : (
                        "Nothing waiting"
                      )}
                    </span>
                  </span>
                  {q.late > 0 && (
                    <Badge tone="danger">
                      <AlertTriangle size={12} />
                      {q.late} late
                    </Badge>
                  )}
                  {q.pending > 0 ? (
                    <span
                      className="min-w-[36px] text-right text-[18px] font-bold tabular-nums"
                      style={{ color: "var(--text)" }}
                    >
                      {q.pending}
                    </span>
                  ) : (
                    <CheckCircle2
                      size={18}
                      style={{ color: "var(--success-ink)" }}
                      className="mx-2"
                    />
                  )}
                  <ChevronRight
                    size={17}
                    style={{ color: "var(--text-faint)" }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-5 !px-0 !pb-2">
          <div className="px-6">
            <CardTitle
              title="Waiting the longest"
              subtitle="Across every queue, oldest first"
            />
          </div>
          {pending.length === 0 ? (
            <p
              className="px-6 pb-4 text-[13.5px]"
              style={{ color: "var(--text-muted)" }}
            >
              Nothing is waiting.
            </p>
          ) : (
            <ul className="-mt-2">
              {pending.slice(0, 7).map((p) => (
                <li
                  key={`${p.queue}-${p.id}`}
                  style={{ borderTop: "1px solid var(--muted)" }}
                >
                  <Link href={p.href} className="sa-row-link">
                    <Avatar name={p.person} size={34} />
                    <span className="flex-1 min-w-0">
                      <span
                        className="block text-[13.5px] font-semibold truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {p.acronym}
                        {p.queue === "deletions" ? " · deletion" : ""}
                      </span>
                      <span
                        className="block text-[12px] truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {QUEUE_INFO[p.queue].label} · {p.person}
                      </span>
                    </span>
                    <WaitingBadge since={p.since} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Submissions & review across the live conferences, worst first */}
      <ReviewHealthCard conferences={review} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ActivityChart />
        </div>
        <Card className="lg:col-span-4">
          <CardTitle
            title="Recent activity"
            right={
              <Link
                href="/super-admin/audit-log"
                className="text-[12.5px] font-semibold"
                style={{ color: "var(--primary)" }}
              >
                Audit log
              </Link>
            }
          />
          {activity.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              Nothing yet.
            </p>
          ) : (
            <ul>
              {activity.map((a, i, arr) => (
                <li key={a.id} className="flex gap-3">
                  <span
                    className="w-[110px] shrink-0 text-[12px] pt-[1px] tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {fmtDate(a.occurredAt)}{" "}
                    {new Date(a.occurredAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="flex flex-col items-center">
                    <span
                      className="w-3 h-3 rounded-full mt-[3px]"
                      style={{
                        border: `2px solid ${TONES[activityTone(a.action)].solid}`,
                      }}
                    />
                    {i < arr.length - 1 && (
                      <span
                        className="w-px flex-1 my-1"
                        style={{ background: "var(--border)" }}
                      />
                    )}
                  </span>
                  <span
                    className="text-[13px] pb-4 leading-snug"
                    style={{ color: "var(--text-soft)" }}
                  >
                    {activityText(a)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Licenses ending soonest */}
      <Card className="!px-0 !pb-2">
        <div className="px-6">
          <CardTitle
            title="Licenses ending soon"
            subtitle="Active and trial conferences, soonest first"
            right={
              <Link
                href="/super-admin/conferences"
                className="text-[12.5px] font-semibold"
                style={{ color: "var(--primary)" }}
              >
                All conferences
              </Link>
            }
          />
        </div>
        <div className="overflow-x-auto -mt-2">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-6">Conference</th>
                <th>Status</th>
                <th>Papers</th>
                <th>License ends</th>
                <th>Left</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {expiring.slice(0, 5).map((c) => {
                const [label, tone] = c.onTrial
                  ? (["Trial", "warning"] as const)
                  : CONF_STATUS[c.status];
                return (
                  <tr
                    key={c.id}
                    className="sa-clickable cursor-pointer"
                    onClick={() =>
                      router.push(`/super-admin/conferences/${c.id}`)
                    }
                  >
                    <td className="!pl-6">
                      <p
                        className="font-semibold"
                        style={{ color: "var(--text)" }}
                      >
                        {c.acronym}
                      </p>
                      <p
                        className="text-[12.5px] truncate max-w-[340px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {c.title}
                      </p>
                    </td>
                    <td>
                      <Badge tone={tone}>{label}</Badge>
                    </td>
                    <td className="tabular-nums">{c.papers}</td>
                    <td className="whitespace-nowrap">
                      {fmtDate(c.licenseExpiry)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          c.left <= 3
                            ? "danger"
                            : c.left <= 7
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {c.left <= 0 ? "Ended" : `${c.left} days`}
                      </Badge>
                    </td>
                    <td className="pr-6 text-right">
                      <ChevronRight
                        size={17}
                        style={{ color: "var(--text-faint)" }}
                      />
                    </td>
                  </tr>
                );
              })}
              {expiring.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="!pl-6 py-6 text-[13.5px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No live conferences yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
