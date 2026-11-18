"use client";
/* One conference (the prototype's ConferenceDetailPage, database parts): details, who asked for
   it, its deletion request, archive / restore, and its papers with their review stage. License,
   billing, suspend and "view as chair" are not in the launch. */
import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Library } from "lucide-react";
import { archiveConference, loadConferencePapers, loadConferences, restoreConference } from "../services";
import { useData } from "../use-data";
import { CONF_STATUS } from "./conferences-page";
import { Badge, Button, Card, CardTitle, errorText, ExtLink, Failed, Fields, fmtDate, Loading, Modal, PageTitle, Toast } from "./ui";

export function ConferenceDetailPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useData(async () => {
    const [all, papers] = await Promise.all([loadConferences(), loadConferencePapers(id).catch(() => [])]);
    return { conference: all.find((c) => c.id === id) ?? null, papers };
  }, [id]);
  const [confirm, setConfirm] = useState<"archive" | "restore" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const c = data.conference;
  if (!c) {
    return (
      <>
        <PageTitle title="Conference not found" icon={Library} parent={{ label: "Conferences", href: "/super-admin/conferences" }} />
        <Card>
          <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            This conference doesn&apos;t exist. <Link href="/super-admin/conferences" style={{ color: "var(--primary)" }}>Back to Conferences</Link>
          </p>
        </Card>
      </>
    );
  }
  const [label, tone] = CONF_STATUS[c.status] ?? [c.status, "neutral"];

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setActionError(null);
    try {
      await (confirm === "archive" ? archiveConference(c.id) : restoreConference(c.id));
      setToast(confirm === "archive" ? `${c.acronym} archived` : `${c.acronym} is active again`);
      setConfirm(null);
      reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        title={c.acronym}
        description={c.title}
        icon={Library}
        parent={{ label: "Conferences", href: "/super-admin/conferences" }}
        actions={
          <>
            <Badge tone={tone}>{label}</Badge>
            {c.status === "active" && (
              <Button tone="neutral" variant="outline" onClick={() => setConfirm("archive")}>
                <Archive size={15} />
                Archive
              </Button>
            )}
            {c.status === "archived" && (
              <Button tone="success" variant="soft" onClick={() => setConfirm("restore")}>
                <ArchiveRestore size={15} />
                Restore
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardTitle title="Details" />
          <Fields
            rows={[
              ["Full name", c.title],
              ["Dates", c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : null],
              ["Format", c.mode],
              ["Venue", [c.venue, c.city, c.state, c.country].filter(Boolean).join(", ")],
              ["Research area", [c.primaryArea, c.secondaryArea].filter(Boolean).join(" › ")],
              ["Website", <ExtLink key="w" href={c.webPage} />],
              ["Contact email", c.contactEmail],
              ["Call for papers", c.cfpStatus],
              ["Submission deadline", fmtDate(c.submissionDeadline)],
              ["Created", fmtDate(c.createdAt)],
            ]}
          />
        </Card>
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card>
            <CardTitle title="Asked for by" />
            {c.requester ? (
              <Fields
                rows={[
                  ["Name", <Link key="n" href={`/super-admin/users/${c.requester.id}`} style={{ color: "var(--primary)" }}>{c.requester.name}</Link>],
                  ["Email", c.requester.email],
                  ["Affiliation", c.requester.affiliation],
                ]}
              />
            ) : (
              <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                Not recorded.
              </p>
            )}
          </Card>
          {c.deletionRequest && (
            <Card>
              <CardTitle title="Deletion request" right={<Badge tone={c.deletionRequest.status === "pending" ? "warning" : "neutral"}>{c.deletionRequest.status}</Badge>} />
              <Fields rows={[["Reason", c.deletionRequest.reason], ["Asked", fmtDate(c.deletionRequest.createdAt)], ["Admin note", c.deletionRequest.adminNote]]} />
              {c.deletionRequest.status === "pending" && (
                <Link href={`/super-admin/deletion-requests?open=${c.deletionRequest.id}`} className="inline-block mt-4 text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
                  Decide in Deletion Requests →
                </Link>
              )}
            </Card>
          )}
        </div>
      </div>

      <Card className="!p-0 mt-6">
        <div className="px-6 pt-6">
          <CardTitle title={`Papers (${data.papers.length})`} subtitle="Where each paper stands in review" />
        </div>
        <div className="overflow-x-auto">
          <table className="sa-table">
            <thead>
              <tr>
                <th className="!pl-6">Paper</th>
                <th>Track</th>
                <th>Stage</th>
                <th>Reviews</th>
                <th>Avg. score</th>
                <th>Decision</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.papers.map((p) => (
                <tr key={p.id}>
                  <td className="!pl-6">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>
                      {p.paperId}
                    </p>
                    <p className="text-[12.5px] truncate max-w-[360px]" style={{ color: "var(--text-muted)" }}>
                      {p.title}
                    </p>
                  </td>
                  <td>{p.track ?? "—"}</td>
                  <td>{p.stage ? <Badge tone="primary">{p.stage.replace(/_/g, " ")}</Badge> : <Badge tone="neutral">{p.status}</Badge>}</td>
                  <td className="tabular-nums">
                    {p.reviewsIn} / {p.reviewersWanted}
                  </td>
                  <td className="tabular-nums">{p.averageScore ?? "—"}</td>
                  <td>{p.decision ?? "—"}</td>
                  <td className="whitespace-nowrap text-[13px]">{fmtDate(p.submittedAt)}</td>
                </tr>
              ))}
              {data.papers.length === 0 && (
                <tr>
                  <td colSpan={7} className="!pl-6 py-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
                    No papers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {confirm && (
        <Modal
          title={confirm === "archive" ? `Archive ${c.acronym}?` : `Restore ${c.acronym}?`}
          onClose={() => setConfirm(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" tone="neutral" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button tone={confirm === "archive" ? "warning" : "success"} busy={busy} onClick={() => void run()}>
                {confirm === "archive" ? "Archive" : "Restore"}
              </Button>
            </div>
          }
        >
          <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            {confirm === "archive" ? "It becomes read-only: no new submissions or reviews. Nothing is deleted, and it can be restored at any time." : "It becomes active again, as it was before it was archived."}
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
