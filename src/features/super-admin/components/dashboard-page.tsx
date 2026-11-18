"use client";
/* Dashboard (the prototype's DashboardPage in database mode): greeting, KPI tiles, the live
   approval queues, what has waited longest, and recent activity. Sample-only parts of the
   prototype (activity chart, licenses) are left out until their data exists. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, ChevronRight, FileText, Inbox, Library, Trash2, Users } from "lucide-react";
import { useAdmin } from "../session";
import { loadActivity, loadConferences, loadDeletionRequests, loadStats } from "../services";
import { useData } from "../use-data";
import { activityText, activityTone } from "./activity";
import { Avatar, Badge, Card, CardTitle, daysSince, Failed, fmtDate, Loading, SLA_DAYS, TONES, WaitingBadge, waitingLabel, type Icon, type Tone } from "./ui";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

interface Pending {
  queue: "requests" | "deletions";
  id: string;
  title: string;
  person: string;
  since: string;
  href: string;
}

export function DashboardPage() {
  const router = useRouter();
  const { name } = useAdmin();
  const { data, error, loading, reload } = useData(async () => {
    const [stats, requests, deletions, activity] = await Promise.all([loadStats(), loadConferences("pending_approval"), loadDeletionRequests("pending"), loadActivity({ limit: 8 })]);
    return { stats, requests, deletions, activity: activity.data };
  });
  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const { stats, requests, deletions, activity } = data;

  const pending: Pending[] = [
    ...requests.map((c) => ({ queue: "requests" as const, id: c.id, title: `${c.acronym} — ${c.title}`, person: c.requester?.name ?? "—", since: c.createdAt ?? new Date().toISOString(), href: `/super-admin/conference-requests?open=${c.id}` })),
    ...deletions.map((d) => ({ queue: "deletions" as const, id: d.id, title: `Delete ${d.acronym}`, person: d.requestedBy.name, since: d.createdAt, href: `/super-admin/deletion-requests?open=${d.id}` })),
  ].sort((a, b) => a.since.localeCompare(b.since));
  const late = pending.filter((p) => daysSince(p.since) > SLA_DAYS);

  const queues: { key: Pending["queue"]; label: string; icon: Icon; href: string }[] = [
    { key: "requests", label: "Conference Requests", icon: CalendarPlus, href: "/super-admin/conference-requests" },
    { key: "deletions", label: "Deletion Requests", icon: Trash2, href: "/super-admin/deletion-requests" },
  ];

  const kpis: { label: string; value: number; sub: string; icon: Icon; tone: Tone; href: string }[] = [
    { label: "Waiting for a decision", value: pending.length, sub: "across 2 queues", icon: Inbox, tone: "primary", href: pending[0]?.href ?? "/super-admin/conference-requests" },
    { label: `Past the ${SLA_DAYS}-day promise`, value: late.length, sub: late.length ? `oldest ${waitingLabel(late[0].since)}` : "all inside the limit", icon: AlertTriangle, tone: "danger", href: late[0]?.href ?? "/super-admin/conference-requests" },
    { label: "Live conferences", value: stats.conferences.active, sub: `${stats.conferences.archived} archived`, icon: Library, tone: "secondary", href: "/super-admin/conferences" },
    { label: "Users", value: stats.users.total, sub: `${stats.users.newThisWeek} new this week`, icon: Users, tone: "accent", href: "/super-admin/users" },
    { label: "Papers submitted", value: stats.papers.submitted, sub: `${stats.reviewsSubmitted} reviews in`, icon: FileText, tone: "success", href: "/super-admin/conferences" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
            {fmtDate(new Date().toISOString())}
          </p>
          <h2 className="text-[26px] font-bold tracking-tight leading-tight mt-0.5" style={{ color: "var(--text)" }}>
            {greeting()}, {name.split(" ")[0]}
          </h2>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-soft)" }}>
            {pending.length ? (
              <>
                {pending.length} decision{pending.length === 1 ? "" : "s"} waiting
                {late.length > 0 && (
                  <>
                    {" "}
                    · <b style={{ color: "var(--danger)" }}>{late.length} past the {SLA_DAYS}-day promise</b>
                  </>
                )}
              </>
            ) : (
              "Every queue is clear."
            )}
          </p>
        </div>
        {pending[0] && (
          <Link href={pending[0].href} className="sa-btn inline-flex items-center gap-2 rounded-xl px-4 h-11 text-[14px] font-semibold text-white shrink-0" style={{ background: "var(--gradient-primary)" }}>
            Review oldest request <ArrowRight size={16} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((k) => {
          const t = TONES[k.tone];
          return (
            <button key={k.label} type="button" onClick={() => router.push(k.href)} className="sa-kpi">
              <span className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--text-muted)" }}>
                  {k.label}
                </span>
                <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: t.bg, color: t.fg }}>
                  <k.icon size={16} />
                </span>
              </span>
              <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: k.tone === "danger" && k.value ? "var(--danger)" : "var(--text)" }}>
                {k.value}
              </span>
              <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                {k.sub}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 !px-0 !pb-2">
          <div className="px-6">
            <CardTitle title="Approval queues" subtitle="Late ones first, then the busiest" />
          </div>
          <ul className="-mt-2">
            {queues.map((q) => {
              const items = pending.filter((p) => p.queue === q.key);
              const lateN = items.filter((p) => daysSince(p.since) > SLA_DAYS).length;
              return (
                <li key={q.key} style={{ borderTop: "1px solid var(--muted)" }}>
                  <Link href={q.href} className="sa-row-link" style={{ opacity: items.length ? 1 : 0.6 }}>
                    <span className="w-9 h-9 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                      <q.icon size={17} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold truncate" style={{ color: "var(--text)" }}>
                        {q.label}
                      </span>
                      <span className="block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                        {items[0] ? <>Oldest waiting {waitingLabel(items[0].since).toLowerCase()}</> : "Nothing waiting"}
                      </span>
                    </span>
                    {lateN > 0 && (
                      <Badge tone="danger">
                        <AlertTriangle size={12} />
                        {lateN} late
                      </Badge>
                    )}
                    {items.length > 0 ? (
                      <span className="min-w-[36px] text-right text-[18px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
                        {items.length}
                      </span>
                    ) : (
                      <CheckCircle2 size={18} style={{ color: "var(--success)" }} className="mx-2" />
                    )}
                    <ChevronRight size={17} style={{ color: "var(--text-faint)" }} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="lg:col-span-5 !px-0 !pb-2">
          <div className="px-6">
            <CardTitle title="Waiting the longest" subtitle="Across every queue, oldest first" />
          </div>
          {pending.length === 0 ? (
            <p className="px-6 pb-4 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              Nothing is waiting.
            </p>
          ) : (
            <ul className="-mt-2">
              {pending.slice(0, 7).map((p) => (
                <li key={`${p.queue}-${p.id}`} style={{ borderTop: "1px solid var(--muted)" }}>
                  <Link href={p.href} className="sa-row-link">
                    <Avatar name={p.person} size={34} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-semibold truncate" style={{ color: "var(--text)" }}>
                        {p.title}
                      </span>
                      <span className="block text-[12px] truncate" style={{ color: "var(--text-muted)" }}>
                        {p.queue === "requests" ? "Conference Requests" : "Deletion Requests"} · {p.person}
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

      <Card>
        <CardTitle title="Recent activity" subtitle="What happened on the platform, newest first" />
        {activity.length === 0 ? (
          <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            Nothing yet.
          </p>
        ) : (
          <ul>
            {activity.map((a, i, arr) => (
              <li key={a.id} className="flex gap-3">
                <span className="w-[110px] shrink-0 text-[12px] pt-[1px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {fmtDate(a.occurredAt)} {new Date(a.occurredAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="flex flex-col items-center">
                  <span className="w-3 h-3 rounded-full mt-[3px]" style={{ border: `2px solid ${TONES[activityTone(a.action)].solid}` }} />
                  {i < arr.length - 1 && <span className="w-px flex-1 my-1" style={{ background: "var(--border)" }} />}
                </span>
                <span className="text-[13px] pb-4 leading-snug" style={{ color: "var(--text-soft)" }}>
                  {activityText(a)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
