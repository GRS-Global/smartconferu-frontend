"use client";
/* One paper, read-only (the prototype's PaperDetailPage): for support questions about a paper.
   Its stage and decision, the facts, the reviewers with their progress and scores, and the authors.
   Reviewers' confidential comments to the chair are never shown, and decisions stay with the chair. */
import Link from "next/link";
import { AlertTriangle, FileText, Library, ShieldCheck } from "lucide-react";
import { loadConferencePapers, loadConferences } from "../services";
import { useData } from "../use-data";
import { recommendationLabel, REVIEWER_STATE, reviewerState } from "../review-health";
import { StageBadge } from "./review-card";
import { Avatar, Badge, Card, CardTitle, Failed, fmtDate, Loading, PageTitle, SortTh, useSort } from "./ui";

const STATE_ORDER = ["overdue", "waiting", "active", "done", "declined"];

export function PaperDetailPage({ conferenceId, paperId }: { conferenceId: string; paperId: string }) {
  const { data, error, loading, reload } = useData(async () => {
    const [conferences, papers] = await Promise.all([loadConferences(), loadConferencePapers(conferenceId)]);
    return { conference: conferences.find((c) => c.id === conferenceId) ?? null, paper: papers.find((p) => p.id === paperId) ?? null };
  }, [conferenceId, paperId]);
  const reviewersAll = data?.paper?.reviewers ?? [];
  const active = reviewersAll.filter((r) => r.status !== "declined" && r.status !== "removed");
  const { sorted: reviewers, sort, toggle } = useSort(active, {
    reviewer: { get: (r) => r.name },
    progress: { get: (r) => STATE_ORDER.indexOf(reviewerState(r)) },
    assigned: { get: (r) => r.assignedAt, first: "desc" },
    due: { get: (r) => r.dueAt ?? "" },
    score: { get: (r) => r.score, first: "desc" },
    rec: { get: (r) => r.recommendation ?? "" },
  });
  const th = (label: string, key: string, className?: string) => <SortTh label={label} sortKey={key} sort={sort} onSort={toggle} className={className} />;

  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const { conference: c, paper: p } = data;
  const parent = { label: "Conferences", href: "/super-admin/conferences" };
  if (!p || !c) {
    return (
      <>
        <PageTitle title="Paper not found" icon={FileText} parent={parent} />
        <Card>
          <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            No paper with this ID. It may have been withdrawn or deleted.
          </p>
        </Card>
      </>
    );
  }
  const declined = reviewersAll.filter((r) => r.status === "declined");
  const dues = active.filter((r) => r.dueAt && reviewerState(r) !== "done").map((r) => r.dueAt!).sort();

  return (
    <>
      <PageTitle
        title={p.paperId}
        crumb={`${c.acronym} › ${p.paperId}`}
        icon={FileText}
        parent={parent}
        description={c.title}
        actions={
          <Link href={`/super-admin/conferences/${c.id}`} className="sa-btn inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold bg-white" style={{ border: "1px solid var(--border)", color: "var(--text-soft)" }}>
            <Library size={15} />
            Open {c.acronym}
          </Link>
        }
      />

      <div className="rounded-xl px-4 py-3 mb-6 flex items-start gap-2.5 text-[13px]" style={{ background: "var(--primary-soft)", color: "var(--navy)", border: "1px solid var(--primary-soft-border)" }}>
        <ShieldCheck size={17} className="shrink-0 mt-px" style={{ color: "var(--primary)" }} />
        <span>
          <b>Support view, read-only.</b> Reviewers&apos; confidential comments to the chair aren&apos;t shown here, and decisions stay with the chair.
        </span>
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <StageBadge stage={p.stage} />
          {p.decision && <Badge tone="neutral">Decision: {p.decision}</Badge>}
          {p.split && (
            <Badge tone="warning">
              <AlertTriangle size={12} />
              Reviewers disagree
            </Badge>
          )}
        </div>
        <h2 className="text-[19px] font-bold leading-snug mt-3" style={{ color: "var(--text)" }}>
          {p.title}
        </h2>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 mt-5 text-[13.5px]">
          {[
            ["Track", p.track ?? "—"],
            ["Status", p.status.replace(/_/g, " ")],
            ["Submitted", fmtDate(p.submittedAt)],
            ["Last update", fmtDate(p.updatedAt)],
            ["Reviewers", `${active.length} of ${p.reviewersWanted}`],
            ["Reviews in", `${p.reviewsIn} of ${Math.max(active.length, p.reviewersWanted)}`],
            ["Average score", p.averageScore != null ? `${p.averageScore}/5` : "—"],
            ["Reviews due", dues[0] ? fmtDate(dues[0]) : "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt style={{ color: "var(--text-muted)" }}>{k}</dt>
              <dd className="font-semibold mt-0.5" style={{ color: "var(--text)" }}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 !px-0 !pb-2">
          <div className="px-6">
            <CardTitle title="Reviewers" subtitle={`Target ${p.reviewersWanted} per paper`} />
          </div>
          {active.length === 0 ? (
            <p className="px-6 pb-4 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              No reviewer assigned yet.
            </p>
          ) : (
            <div className="overflow-x-auto -mt-2">
              <table className="sa-table">
                <thead>
                  <tr>
                    {th("Reviewer", "reviewer", "!pl-6")}
                    {th("Progress", "progress")}
                    {th("Assigned", "assigned")}
                    {th("Due", "due")}
                    {th("Score", "score")}
                    {th("Recommends", "rec")}
                  </tr>
                </thead>
                <tbody>
                  {reviewers.map((r) => {
                    const state = reviewerState(r);
                    const [label, tone] = REVIEWER_STATE[state];
                    const rec = recommendationLabel(r.recommendation);
                    return (
                      <tr key={r.userId}>
                        <td className="!pl-6">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.name} size={30} />
                            <span className="font-semibold" style={{ color: "var(--text)" }}>
                              {r.name}
                            </span>
                            {r.byChair && <Badge tone="secondary">Chair</Badge>}
                          </div>
                        </td>
                        <td>
                          <Badge tone={tone}>{label}</Badge>
                        </td>
                        <td className="whitespace-nowrap">{fmtDate(r.assignedAt)}</td>
                        <td className="whitespace-nowrap" style={{ color: state === "overdue" ? "var(--danger)" : undefined, fontWeight: state === "overdue" ? 600 : undefined }}>
                          {r.submittedAt ? `Sent ${fmtDate(r.submittedAt)}` : fmtDate(r.dueAt)}
                        </td>
                        <td className="tabular-nums">{r.score != null ? `${r.score}/5` : "—"}</td>
                        <td>{rec ? <Badge tone={rec === "Accept" ? "success" : rec === "Reject" ? "danger" : "warning"}>{rec}</Badge> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {declined.length > 0 && (
            <div className="px-6 pt-4 pb-2" style={{ borderTop: "1px solid var(--muted)" }}>
              <p className="text-[12px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
                Declined
              </p>
              {declined.map((d) => (
                <p key={d.userId} className="text-[13px] py-1" style={{ color: "var(--text-soft)" }}>
                  <b style={{ color: "var(--text)" }}>{d.name}</b>
                  {d.declineReason ? ` — ${d.declineReason}` : ""}
                </p>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle title="Authors" />
          <ul className="space-y-3">
            {(p.authors ?? []).map((a) => (
              <li key={`${a.name}-${a.email}`} className="flex items-start gap-2.5">
                <Avatar name={a.name || "?"} size={32} />
                <div className="min-w-0 text-[13px]">
                  <p className="font-semibold" style={{ color: "var(--text)" }}>
                    {a.name}
                    {a.corresponding && (
                      <span className="ml-1.5">
                        <Badge tone="primary">Corresponding</Badge>
                      </span>
                    )}
                  </p>
                  {a.affiliation && <p style={{ color: "var(--text-muted)" }}>{a.affiliation}</p>}
                  {a.email && (
                    <p className="truncate" style={{ color: "var(--text-muted)" }}>
                      {a.email}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
