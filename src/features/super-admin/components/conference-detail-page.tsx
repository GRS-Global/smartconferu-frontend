"use client";
/* One conference (the prototype's ConferenceDetailPage): a header card (name, status, dates, place,
   web page, chair, the direct actions and four numbers), the chair's deletion request decided right
   here (type DELETE), Submissions & review, and the License / CFP / Hosting request / Activity cards.
   License, suspend and "view as chair" need backend work: shown, disabled, "Coming soon". */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CalendarClock, Eye, FileText, Hourglass, Library, Lock, RotateCcw, Trash2, Users as UsersIcon } from "lucide-react";
import { activityText } from "./activity";
import { ViewAsPanel } from "./view-as";
import { archiveConference, decideDeletionRequest, extendLicense, reactivateConference, suspendConference, loadActivity, loadConferencePapers, loadConferences, loadDeletionRequests, loadLicenseRequests, restoreConference } from "../services";
import { daysUntil } from "./more-queues";
import { OutcomeBadge } from "./queue-page";
import { useData } from "../use-data";
import { statusBadge } from "./conferences-page";
import { ConferenceReviewCard } from "./review-card";
import { Avatar, Badge, Button, Card, CardTitle, errorText, Failed, fmtDate, fmtDateTime, Loading, PageTitle, Toast, TONES, type Icon, type Tone } from "./ui";

function Stat({ icon: IconC, label, value, sub, tone = "primary" }: { icon: Icon; label: string; value: string | number; sub?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--canvas)", border: "1px solid var(--border)" }}>
      <p className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        <IconC size={14} style={{ color: TONES[tone].fg }} />
        {label}
      </p>
      <p className="text-[20px] font-bold mt-1" style={{ color: "var(--text)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] py-3" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}


export function ConferenceDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, loading, reload } = useData(async () => {
    const [all, papers, deletions, activity, licenses] = await Promise.all([
      loadConferences(),
      loadConferencePapers(id).catch(() => []),
      loadDeletionRequests().catch(() => []),
      loadActivity({ entityId: id, limit: 8 }).catch(() => ({ data: [], nextBefore: null })),
      Promise.all((["pending", "approved", "declined", "withdrawn"] as const).map((st) => loadLicenseRequests(st).catch(() => []))).then((l) => l.flat()),
    ]);
    return {
      conference: all.find((c) => c.id === id) ?? null,
      papers,
      deletion: deletions.find((d) => d.conferenceId === id && d.status === "pending") ?? null,
      events: activity.data,
      licenses: licenses.filter((l) => l.conferenceId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }, [id]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteWord, setDeleteWord] = useState("");
  const [extending, setExtending] = useState(false);
  const [viewingAs, setViewingAs] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [date, setDate] = useState("");

  if (loading && !data) return <Loading />;
  if (error || !data) return <Failed error={error} onRetry={reload} />;
  const c = data.conference;
  if (!c) {
    return (
      <>
        <PageTitle title="Conference not found" icon={Library} parent={{ label: "Conferences", href: "/super-admin/conferences" }} />
        <Card>
          <Empty>This conference doesn&apos;t exist any more.</Empty>
        </Card>
      </>
    );
  }
  const [label, tone] = statusBadge(c);
  const left = daysUntil(c.licenseExpiry);
  const live = c.status === "active" || c.status === "archived";
  const submitted = data.papers.filter((p) => p.status !== "draft").length;
  const place = [c.city, c.country].filter(Boolean).join(", ");
  const ask = data.deletion;

  const run = async (work: () => Promise<unknown>, done: string, after?: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      setToast(done);
      after?.();
      reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const toggleArchive = () =>
    void run(() => (c.status === "archived" ? restoreConference(c.id) : archiveConference(c.id)), c.status === "archived" ? `${c.acronym} restored` : `${c.acronym} archived — it takes no new papers`);

  return (
    <>
      <PageTitle title={c.acronym} crumb={c.acronym} icon={CalendarClock} parent={{ label: "Conferences", href: "/super-admin/conferences" }} />

      <Card className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[19px] font-bold" style={{ color: "var(--text)" }}>
                {c.title}
              </h2>
              <Badge tone={tone}>{label}</Badge>
            </div>
            <p className="text-[13.5px] mt-1" style={{ color: "var(--text-muted)" }}>
              {[c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : c.primaryArea, place].filter(Boolean).join(" · ")}
              {c.webPage && (
                <>
                  {" · "}
                  <a href={c.webPage.startsWith("http") ? c.webPage : `https://${c.webPage}`} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--primary)" }}>
                    {c.webPage.replace(/^https?:\/\//, "")}
                  </a>
                </>
              )}
            </p>
            {c.requester && (
              <div className="flex items-center gap-2.5 mt-3">
                <Avatar name={c.requester.name} size={32} />
                <span className="text-[13.5px]" style={{ color: "var(--text-soft)" }}>
                  Chair:{" "}
                  <Link href={`/super-admin/users/${c.requester.id}`} className="font-bold hover:underline" style={{ color: "var(--text)" }}>
                    {c.requester.name}
                  </Link>
                  {c.requester.email ? ` · ${c.requester.email}` : ""}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              tone="primary"
              variant="soft"
              disabled={!live}
              onClick={() => {
                setExtending((e) => !e);
                setDate(c.licenseExpiry);
              }}
            >
              <Hourglass size={15} />
              Extend license
            </Button>
            {c.requester && (
              <Button
                tone="primary"
                variant="soft"
                onClick={() => {
                  setViewingAs((v) => !v);
                  setExtending(false);
                  setSuspending(false);
                }}
                title="Opens the user app, read-only, as this conference's chair — recorded in the audit log"
              >
                <Eye size={15} />
                View as chair
              </Button>
            )}
            {c.suspended ? (
              <Button tone="success" variant="soft" busy={busy} onClick={() => void run(() => reactivateConference(c.id), `${c.acronym} reactivated`)}>
                <RotateCcw size={15} />
                Reactivate
              </Button>
            ) : (
              <Button
                tone="danger"
                variant="soft"
                disabled={!live}
                onClick={() => {
                  setSuspending((v) => !v);
                  setExtending(false);
                  setViewingAs(false);
                }}
              >
                <Ban size={15} />
                Suspend
              </Button>
            )}
            {c.status === "archived" ? (
              <Button tone="success" variant="soft" busy={busy} onClick={toggleArchive} title="Opens the conference again for new papers">
                <RotateCcw size={15} />
                Restore
              </Button>
            ) : (
              c.status === "active" && (
                <Button tone="neutral" variant="soft" busy={busy} onClick={toggleArchive} title="Stops new papers; nothing is deleted">
                  <Lock size={15} />
                  Archive
                </Button>
              )
            )}
          </div>
        </div>
        {viewingAs && c.requester && (
          <ViewAsPanel
            who={`${c.acronym}'s chair`}
            userId={c.requester.id}
            next={`/chair/${c.slug}/dashboard`}
            onCancel={() => setViewingAs(false)}
            onStarted={(text) => {
              setViewingAs(false);
              setToast(text);
            }}
          />
        )}
        {suspending && (
          <div className="mt-5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-end gap-3 sa-pop" style={{ background: "var(--danger-soft)" }}>
            <label className="block flex-1">
              <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                Why? (the chairs will see this)
              </span>
              <input className="sa-input" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="For example: payment dispute" maxLength={2000} />
              <span className="block text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                Chairs, authors and reviewers can still see it but can&apos;t change anything until you reactivate it.
              </span>
            </label>
            <div className="flex gap-2">
              <Button tone="neutral" variant="soft" onClick={() => setSuspending(false)}>
                Cancel
              </Button>
              <Button tone="danger" busy={busy} onClick={() => void run(() => suspendConference(c.id, suspendReason.trim()), `${c.acronym} suspended — chairs and authors can't make changes`, () => setSuspending(false))}>
                <Ban size={15} />
                Suspend
              </Button>
            </div>
          </div>
        )}
        {extending && (
          <div className="mt-5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-end gap-3 sa-pop" style={{ background: "var(--primary-soft)" }}>
            <label className="block flex-1">
              <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                New license end date
              </span>
              <input type="date" className="sa-input" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
              <span className="block text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                Currently {fmtDate(c.licenseExpiry)}
                {c.onTrial ? " (30-day trial)" : ""}. The chair is notified.
              </span>
            </label>
            <div className="flex gap-2">
              <Button tone="neutral" variant="soft" onClick={() => setExtending(false)}>
                Cancel
              </Button>
              <Button tone="primary" busy={busy} disabled={!date || date <= c.licenseExpiry} onClick={() => void run(() => extendLicense(c.id, date), `${c.acronym} license now runs until ${fmtDate(date)}`, () => setExtending(false))}>
                Save new date
              </Button>
            </div>
          </div>
        )}
        {actionError && (
          <p role="alert" className="text-[13px] mt-3" style={{ color: "var(--danger)" }}>
            {actionError}
          </p>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <Stat icon={FileText} label="Papers" value={submitted} />
          <Stat icon={Hourglass} label="License until" value={live ? fmtDate(c.licenseExpiry) : "—"} sub={live ? (left < 0 ? `Ended ${-left} days ago` : `${left} days left`) : undefined} tone={left <= 7 ? "danger" : "success"} />
          <Stat icon={UsersIcon} label="Status" value={label} sub={c.onTrial && c.status === "active" ? "30-day trial" : undefined} tone={tone} />
          <Stat icon={CalendarClock} label="Created" value={fmtDate(c.createdAt)} />
        </div>
      </Card>

      {/* The chair asked for this archived conference to be deleted. */}
      {ask && (
        <Card className="mb-6" style={{ borderColor: "var(--danger)" }}>
          <CardTitle title="Deletion requested" />
          <p className="text-[13.5px]" style={{ color: "var(--text-soft)" }}>
            <b style={{ color: "var(--text)" }}>{ask.requestedBy.name}</b> asked on {fmtDate(ask.createdAt)} for {c.acronym} to be deleted.
          </p>
          <p className="text-[13.5px] mt-2 rounded-lg p-3" style={{ background: "var(--muted)", color: "var(--text)" }}>
            “{ask.reason}”
          </p>
          <p className="text-[12.5px] mt-2" style={{ color: "var(--text-muted)" }}>
            It has {submitted} paper{submitted === 1 ? "" : "s"}. Approving removes the conference from every list for its chair, authors and reviewers; the records stay in the database.
          </p>
          {rejecting ? (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="block flex-1">
                <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                  Why not? (the chair will see this)
                </span>
                <input className="sa-input" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="For example: papers were already accepted" />
              </label>
              <div className="flex gap-2">
                <Button
                  tone="neutral"
                  variant="soft"
                  onClick={() => {
                    setRejecting(false);
                    setRejectNote("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  tone="danger"
                  busy={busy}
                  disabled={!rejectNote.trim()}
                  onClick={() =>
                    void run(() => decideDeletionRequest(ask.id, false, rejectNote.trim()), `Deletion of ${c.acronym} rejected — the chair can see why`, () => {
                      setRejecting(false);
                      setRejectNote("");
                    })
                  }
                >
                  Reject request
                </Button>
              </div>
            </div>
          ) : deleting ? (
            <form
              className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (deleteWord.trim().toUpperCase() !== "DELETE") return;
                void run(() => decideDeletionRequest(ask.id, true), `${c.acronym} deleted`, () => router.push("/super-admin/conferences"));
              }}
            >
              <label className="block flex-1">
                <span className="block text-[13px] font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                  Type DELETE to confirm deletion *
                </span>
                <input className="sa-input" autoFocus value={deleteWord} onChange={(e) => setDeleteWord(e.target.value)} placeholder="DELETE" />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  tone="neutral"
                  variant="soft"
                  onClick={() => {
                    setDeleting(false);
                    setDeleteWord("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" tone="danger" busy={busy} disabled={deleteWord.trim().toUpperCase() !== "DELETE"}>
                  <Trash2 size={15} />
                  Delete conference
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button tone="danger" onClick={() => setDeleting(true)}>
                <Trash2 size={15} />
                Approve and delete
              </Button>
              <Button tone="neutral" variant="soft" onClick={() => setRejecting(true)}>
                Reject
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Where its papers stand. */}
      <ConferenceReviewCard conferenceId={c.id} papers={data.papers} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle
            title="License requests"
            right={
              <Link href="/super-admin/license-requests" className="text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
                Open queue
              </Link>
            }
          />
          {data.licenses.length ? (
            data.licenses.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                <div className="text-[13.5px]">
                  <p style={{ color: "var(--text)" }}>Until {fmtDate(r.requestedDate)}</p>
                  <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                    Asked {fmtDate(r.createdAt)}
                    {r.status === "approved" && r.newExpiry ? ` · Extended to ${fmtDate(r.newExpiry)}` : r.decisionReason ? ` · ${r.decisionReason}` : ""}
                  </p>
                </div>
                <OutcomeBadge status={r.status} />
              </div>
            ))
          ) : (
            <Empty>No extension requests.</Empty>
          )}
        </Card>
        <Card>
          <CardTitle
            title="CFP pages"
            right={
              <Link href="/super-admin/cfp-review" className="text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
                Open queue
              </Link>
            }
          />
          {c.cfpStatus === "draft" || !c.cfpStatus ? (
            <Empty>No CFP page sent for review.</Empty>
          ) : (
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="text-[13.5px]">
                <p style={{ color: "var(--text)" }}>smartconferu.com/cfp/{c.slug}</p>
                <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                  Deadline {fmtDate(c.submissionDeadline)}
                </p>
              </div>
              <OutcomeBadge status={c.cfpStatus === "in_review" ? "pending" : c.cfpStatus === "rejected" ? "sent_back" : c.cfpStatus === "published" ? "published" : c.cfpStatus} />
            </div>
          )}
        </Card>
        <Card>
          <CardTitle title="Hosting request" />
          <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="text-[13.5px]">
              <Link href={`/super-admin/conference-requests?open=${c.id}`} className="hover:underline" style={{ color: "var(--text)" }}>
                {c.acronym} — conference request
              </Link>
              <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                Submitted {fmtDate(c.createdAt)}
                {c.requester ? ` by ${c.requester.name}` : ""}
              </p>
            </div>
            <Badge tone={c.status === "pending_approval" ? "warning" : c.status === "rejected" ? "danger" : "success"}>{c.status === "pending_approval" ? "Pending" : c.status === "rejected" ? "Declined" : "Approved"}</Badge>
          </div>
        </Card>
        <Card>
          <CardTitle title="Activity" />
          {data.events.length ? (
            data.events.map((a) => (
              <div key={a.id} className="flex gap-3 py-2 border-t first:border-t-0 text-[13px]" style={{ borderColor: "var(--border)" }}>
                <span className="w-[120px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  {fmtDateTime(a.occurredAt)}
                </span>
                <span style={{ color: "var(--text-soft)" }}>{activityText(a)}</span>
              </div>
            ))
          ) : (
            <Empty>Nothing yet.</Empty>
          )}
        </Card>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </>
  );
}
