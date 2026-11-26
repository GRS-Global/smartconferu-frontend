"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Download, Eye, Mail, FileText, Hash, Pencil, Tag, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { monogram } from "@/features/author/format";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { HeroButton, HeroChip, HeroLink, PageHero } from "@/features/workspace/components/hero";
import { buildZip, saveBlob } from "@/lib/zip";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getChairService } from "@/services/chair";
import { AuthRequiredError } from "@/services/errors";
import { attendanceLabel, PAYMENT_LABELS, type ChairPaperDetail, type ChairReviewer, type DecisionType } from "@/types/chair";
import { chairStageOf, isDecision } from "../stage";
import type { ReviewValues } from "@/types/reviewer";
import { DeskRejectDialog, ReviewDialog } from "./chair-paper-dialogs";
import { FixRequestDialog, ReviewerActionDialog, type ReviewerAction } from "./chair-reviewer-dialogs";
import { useChairPaper } from "../use-chair-paper";
import { readPeerReviewView } from "../peer-review-view";
import { takePendingToast } from "../pending-toast";
import { addReviewersToPaper, type AddPick } from "../add-reviewers";
import { newAssignmentDue, rankReviewersFor } from "../assign-rules";
import { prRowOf } from "../peer-review";
import { AddReviewersModal } from "./add-reviewers-modal";
import type { AssignCandidate } from "./assign-reviewer-popover";
import { ReviewBody } from "./chair-review-view";
import { FilesCard, ManageCard, NoteCard, PaperCard, PaperTimeline, toAuthorPaper } from "./chair-paper-details";
import { EditAuthorsDialog, EditDetailsDialog, UpdateFilesDialog, WithdrawDialog } from "@/features/author/components/paper-dialogs";
import { EmailAuthorsDialog } from "./email-authors-dialog";
import { chairPaperHref } from "@/lib/routes";
import { useCanonicalPath } from "@/lib/use-canonical-path";
import { RegistrationCard, type RegistrationValues } from "./registration-card";

/* A paper's page as its chair sees it (the prototype's SubmissionDetailPage, chair layout): the paper, "Reviewers & Scores" with each
   reviewer's progress and review (and the switch that shares their comments with the authors), and "Record decision" with the note to
   the authors and "Notify authors". Also here: per-reviewer Send reminder / Extend deadline / Message / Remove, Approve or Decline an extension request,
   "Ask author to fix", Add reviewer (the way to replace one), Desk reject and the chair's timeline. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const NOT_CHOICES = new Set(["upload_pending", "no_decision", "plagiarism_clear", "registered"]);

function Card({ title, icon: Icon, children, aside }: { title: string; icon: typeof Users; children: ReactNode; aside?: ReactNode }) {
  return (
    <section style={CARD} className="rounded-2xl bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-navy"><Icon size={16} aria-hidden="true" className="text-primary" /> {title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ConfirmDecision({ detail, type, note, onClose, onConfirm, busy, error }: { detail: ChairPaperDetail; type: DecisionType | null; note: string; onClose: () => void; onConfirm: () => void; busy: boolean; error: string }) {
  return (
    <Dialog open={Boolean(type)} onClose={onClose} title={`Record "${type?.label ?? ""}"?`} description={`${detail.paper.id} · ${detail.paper.title}`} size="md">
      <p className="text-sm text-ink-soft">The decision is saved for you only. The authors are told when you press <b>Notify authors</b>.</p>
      {note.trim() && <p className="mt-3 rounded-lg bg-canvas p-3 text-[12.5px] text-ink-soft">{note.trim()}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={onConfirm} disabled={busy}>{busy ? "Saving…" : "Record decision"}</Button>
      </div>
    </Dialog>
  );
}

/** The chair has two pages per paper, linked to each other (the prototype's SubmissionDetailPage): "details" (/submissions/:id/chair), the paper itself and
 *  the actions on it (desk reject), and "review" (/submissions/:id/chair/review), its reviewers, their reviews and the decision. */
export function ChairPaperPage({ label, view = "review" }: { label: string; view?: "details" | "review" }) {
  const { state, retry, reload } = useChairPaper(label);
  const [pick, setPick] = useState<DecisionType | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dlg, setDlg] = useState<null | { kind: "edit"; reviewer: ChairReviewer } | { kind: "own" } | { kind: "desk" }>(null);
  const [toast, setToast] = useState<FlowToastData | null>(null);
  // The chair's action on one reviewer (reminder, extend, message, remove) and the "Ask author to fix" dialog.
  const [rdlg, setRdlg] = useState<ReviewerAction | null>(null);
  const [fixOpen, setFixOpen] = useState(false);
  // "Add reviewer": the committee and what each member carries now, loaded when the dialog opens.
  // Manage submission: which author dialog is open (they change the paper for its authors), and the Email authors dialog.
  const [manage, setManage] = useState<null | "details" | "authors" | "withdraw" | "files-paper" | "files-supporting">(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [add, setAdd] = useState<null | { candidates: AssignCandidate[]; poolEmails: string[]; maxLoad: number | null; deadline: string; error: string }>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const router = useRouter();
  // What the chair's own-review page left to say ("Your review is submitted"), shown once.
  useEffect(() => {
    const t = takePendingToast();
    if (t) setToast(t);
  }, []);

  useCanonicalPath(state.status === "ready" ? chairPaperHref(state.conference.id, label, view === "review" ? "review" : undefined) : null);
  const gate = workspaceGate(state, retry, { title: label, loadingLabel: "Loading this paper", missingTitle: "We couldn't find that paper.", missingText: "It doesn't exist, or you are not a chair of its conference.", errorTitle: "Couldn't load this paper." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, detail } = state;
  const { paper, data } = detail;
  const stage = chairStageOf(paper, data.screening);
  const choices = data.decisionTypes.filter((t) => !NOT_CHOICES.has(t.outcome));
  // The review page also offers "No Decision" (to take a decision back), first, as the prototype does.
  const reviewChoices = [...data.decisionTypes.filter((t) => t.outcome === "no_decision"), ...choices];
  const current = isDecision(paper.outcome) ? (data.decisionTypes.find((t) => t.id === paper.decisionTypeId) ?? data.decisionTypes.find((t) => t.outcome === paper.outcome) ?? null) : null;
  const outcomeType = data.decisionTypes.find((t) => t.id === paper.decisionTypeId) ?? data.decisionTypes.find((t) => t.outcome === paper.outcome) ?? null;
  const notified = paper.notifiedOutcome !== null && paper.notifiedOutcome === paper.outcome;
  const text = note ?? detail.decisionNote;
  const run = async (job: () => Promise<void>, done: FlowToastData) => {
    setBusy(true); setError("");
    try { await job(); setToast(done); reload(); return true; } catch (e) {
      if (e instanceof AuthRequiredError) setError("Your session ended — please sign in again.");
      else setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally { setBusy(false); }
  };

  const record = async () => {
    if (!pick) return;
    const svc = await getChairService();
    if (await run(() => svc.recordDecision(paper.dbId, pick.id, text), { title: "Decision recorded", text: `${paper.id} is marked "${pick.label}". The authors haven't been told yet.` })) { setConfirm(false); setPick(null); }
  };
  const saveRegistration = async (values: RegistrationValues) => {
    const svc = await getChairService();
    return run(() => svc.saveRegistration(paper.dbId, values), { title: "Registration saved", text: `${paper.id}: ${PAYMENT_LABELS[values.payment]} · ${attendanceLabel(values.attendance)}. No email was sent.` });
  };
  const notify = async () => {
    const svc = await getChairService();
    let mail: string | null = null;
    const ok = await run(async () => { await svc.notifyDecision(paper.dbId, text); mail = await sendActionEmails("decision_notified", { submissionId: paper.dbId }); }, { title: "Authors notified", text: `The decision on ${paper.id} was sent to its authors.` });
    if (ok && mail) setToast({ title: "Authors notified", text: mail });
  };
  const valuesOf = (r: ChairReviewer | undefined): ReviewValues => {
    const v = r?.review;
    if (!v) return {};
    return { ...(v.answers as ReviewValues), "f-score": (v.answers["f-score"] as number | undefined) ?? v.score ?? undefined, "f-confidence": (v.answers["f-confidence"] as string | undefined) ?? v.confidence, "f-to-author": v.commentsToAuthor, "f-to-chair": v.commentsToChair };
  };
  const mine = detail.reviewers.find((r) => r.byChair);
  const closeDlg = () => { if (!busy) { setDlg(null); setError(""); } };
  const saveReviewDlg = async (values: ReviewValues) => {
    if (!dlg || dlg.kind === "desk") return;
    const svc = await getChairService();
    let mail: string | null = null;
    const own = dlg.kind === "own" || dlg.reviewer.byChair;
    const ok = await run(async () => {
      if (dlg.kind === "edit" && dlg.reviewer.review) { await svc.editReview(dlg.reviewer.review.id, values); if (!own) mail = await sendActionEmails("review_edited_by_chair", { reviewId: dlg.reviewer.review.id }); }
      else await svc.submitOwnReview(paper.dbId, values);
    }, { title: own ? "Your review was saved" : "Review updated", text: own ? "It counts in the average, marked as the chair’s." : `${dlg.kind === "edit" ? dlg.reviewer.name : "The"} reviewer is told their review was edited.` });
    if (ok) { setDlg(null); if (mail) setToast({ title: "Review updated", text: mail }); }
  };
  const decideExtension = async (r: ChairReviewer, approve: boolean) => {
    if (!r.extension) return;
    const ext = r.extension;
    const svc = await getChairService();
    await run(() => svc.decideExtension(ext.id, approve), approve
      ? { title: "Extension approved", text: `${r.name}'s review is now due ${new Date(`${ext.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}.` }
      : { title: "Extension declined", text: `${r.name} keeps the current deadline.` });
  };
  const closeReviewerDlg = () => { if (!busy) { setRdlg(null); setFixOpen(false); setError(""); } };
  /** Runs one of the reviewer actions; the dialog stays open (with the reason) when it fails. */
  const reviewerAction = async (input: { text: string; date: string }) => {
    if (!rdlg) return;
    const { type, reviewer: r } = rdlg;
    const svc = await getChairService();
    const base = { submissionId: paper.dbId, assignmentId: r.assignmentId };
    // An email that could not be sent is an error for the actions that are only an email; after a saved change it is a notice next to it.
    let notice: string | null = null;
    const needMail = (m: string | null) => { if (m) throw new Error(m); };
    const toasts = {
      remind: { title: "Reminder sent", text: `${r.name} · ${paper.id} · review reminder emailed.` },
      extend: { title: "Deadline extended", text: `${r.name}'s review is now due ${new Date(`${input.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}. They are emailed.` },
      message: { title: "Message sent", text: `${r.name} was emailed your message.` },
      remove: { title: "Reviewer removed", text: `${r.name} no longer reviews ${paper.id}. They are emailed.` },
    }[type];
    const ok = await run(async () => {
      if (type === "remind") needMail(await sendActionEmails("reviewer_reminder", { ...base, note: input.text }));
      else if (type === "message") needMail(await sendActionEmails("reviewer_message", { ...base, message: input.text }));
      else if (type === "extend") { await svc.setReviewDue(r.assignmentId, input.date); notice = await sendActionEmails("review_deadline_extended", base); }
      else { await svc.removeReviewerFromPaper(paper.dbId, r.reviewerId); notice = await sendActionEmails("reviewer_removed", { submissionId: paper.dbId, reviewerId: r.reviewerId, reviewed: Boolean(r.review) }); }
    }, toasts);
    if (ok) { setRdlg(null); if (notice) setToast({ title: toasts.title, text: notice }); }
  };
  const askFix = async (input: { issue: string; fixBy: string }) => {
    const svc = await getChairService();
    let notice: string | null = null;
    const ok = await run(async () => { await svc.requestFix(paper.dbId, input.issue, input.fixBy); notice = await sendActionEmails("fix_requested", { submissionId: paper.dbId }); }, { title: "Fix requested", text: `The authors of ${paper.id} are emailed what to fix and by when.` });
    if (ok) { setFixOpen(false); if (notice) setToast({ title: "Fix requested", text: notice }); }
  };
  const rejectType = data.decisionTypes.find((t) => t.outcome === "reject");
  const deskReject = async (reason: string) => {
    if (!rejectType) { setError("This conference has no Reject decision type yet."); return; }
    const svc = await getChairService();
    if (await run(() => svc.recordDecision(paper.dbId, rejectType.id, reason), { title: `${paper.id} · desk rejected`, text: "A Reject decision was recorded with your reason. The authors are told when you press Notify authors." })) { setNote(reason); setDlg(null); }
  };
  const share = async (r: ChairReviewer, shared: boolean) => {
    if (!r.review) return;
    const svc = await getChairService();
    await run(() => svc.setReviewShared(r.review!.id, shared), { title: shared ? "Comments will be shared" : "Comments won't be shared", text: shared ? "They go to the authors with the decision." : "They stay between you and the reviewer." });
  };

  const openAdd = async () => {
    setError("");
    try {
      const svc = await getChairService();
      const [pool, board, settings] = await Promise.all([svc.loadReviewerPool(conference.id), svc.loadReviewBoard(conference.id), svc.loadSettings(conference.id)]);
      const all = data.papers.filter((p) => !p.withdrawn).map((p) => prRowOf(p, board, data.screening));
      const row = all.find((x) => x.paper.dbId === paper.dbId);
      if (!row) { setToast({ title: "Couldn't load the committee", text: "This paper isn't in the review list." }); return; }
      const maxLoad = settings.limits.maxPapersPerReviewer;
      const list = pool.reviewers.filter((r) => r.status !== "declined");
      setAdd({ candidates: rankReviewersFor(row, list, all, maxLoad).map((c) => ({ rev: c.rev, load: c.load, conflict: c.conflict || null, full: c.full })), poolEmails: pool.reviewers.map((x) => x.email), maxLoad, deadline: newAssignmentDue(settings, board.deadline), error: "" });
    } catch (e) { setToast({ title: "Couldn't load the committee", text: e instanceof Error ? e.message : "Something went wrong." }); }
  };
  const addReviewers = async (picks: AddPick[], due: string) => {
    setBusy(true);
    try {
      const { names, count, mail } = await addReviewersToPaper(conference.id, paper.dbId, picks, due);
      setAdd(null);
      setToast({ title: names.length > 1 ? `${names.length} reviewers assigned` : "Reviewer assigned", text: `${names.join(", ")} · ${paper.id}.${count === 0 ? " Already on the paper." : ""}${mail ? ` ${mail}` : ""}` });
      reload();
    } catch (e) { setAdd((a) => (a ? { ...a, error: e instanceof Error ? e.message : "Something went wrong." } : a)); } finally { setBusy(false); }
  };
  // The paper's own files: open the newest in a tab, or all of them in one ZIP.
  const paperFiles = [...detail.files, ...detail.supporting].filter((f) => f.storagePath);
  const viewSubmission = async () => {
    const f = detail.files.find((x) => x.storagePath) ?? paperFiles[0];
    if (!f?.storagePath) { setToast({ title: "No file to open", text: "This paper has no stored file here." }); return; }
    try { window.open(await (await getChairService()).fileUrl(f.storagePath), "_blank", "noopener"); } catch (e) { setToast({ title: "Couldn't open the file", text: e instanceof Error ? e.message : "Something went wrong." }); }
  };
  const downloadFiles = async () => {
    if (!paperFiles.length) { setToast({ title: "Nothing to download", text: "This paper has no stored file here." }); return; }
    setBusy(true);
    try {
      const svc = await getChairService();
      const out: Array<{ name: string; data: Uint8Array }> = [];
      for (const f of paperFiles) { const res = await fetch(await svc.fileUrl(f.storagePath!)); if (res.ok) out.push({ name: f.name, data: new Uint8Array(await res.arrayBuffer()) }); }
      if (!out.length) { setToast({ title: "Nothing to download", text: "None of the files could be read." }); return; }
      saveBlob(buildZip(out), `${paper.id}.zip`);
    } catch (e) { setToast({ title: "Couldn't prepare the download", text: e instanceof Error ? e.message : "Something went wrong." }); } finally { setBusy(false); }
  };
  const asAuthor = toAuthorPaper(detail);
  const saved = ({ notice }: { notice: string | null }) => { reload(); setToast({ title: "Saved", text: notice ?? "The change is saved and shared with the authors." }); };
  const openFile = (f: { storagePath: string | null; name: string }, download: boolean) => { if (!f.storagePath) return; void getChairService().then((s) => s.fileUrl(f.storagePath!, download ? f.name : undefined)).then((u) => window.open(u, "_blank", "noopener")); };
  const pillText = paper.withdrawn ? "Withdrawn" : current ? current.label : stage.key === "review" ? "Under Review" : stage.label;
  const isReview = view === "review";
  // The Peer Review list's order, kept when a paper was opened from it: step to the previous / next paper without going back to the list.
  const queueView = isReview ? readPeerReviewView(conference.id) : null;
  const queue = isReview ? (queueView?.queue ?? []) : [];
  const at = queue.indexOf(paper.id);
  const prevId = at > 0 ? queue[at - 1] : null;
  const nextId = at >= 0 && at < queue.length - 1 ? queue[at + 1] : null;
  const base = chairPaperHref(conference.id, paper.id);
  const confBase = `/chair/${encodeURIComponent(conference.id)}`;
  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active={isReview ? "peer-review/list" : "submissions/list"} screening={data.screening}>
      <PageHeader title={paper.id} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, ...(isReview ? [{ label: "Peer Review", href: `${confBase}/peer-review` }] : [{ label: conference.acronym, href: confBase }]), { label: paper.id }]} />
      <div className="hd-page space-y-6 p-8">
        {isReview && at >= 0 && (
          <div style={{ border: "1px solid var(--border)" }} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2">
            <Link href={`${confBase}/peer-review`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-ink-muted hover:bg-canvas hover:text-navy"><ChevronLeft size={14} aria-hidden="true" /> Peer Review</Link>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <span className="min-w-0 truncate text-xs text-ink-soft">Paper <b className="tabular-nums text-navy">{at + 1} of {queue.length}</b>{queueView?.queueLabel && <span className="text-ink-faint"> · {queueView.queueLabel}</span>}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {prevId ? <Link href={chairPaperHref(conference.id, prevId, "review")} title={`Previous: ${prevId}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft hover:bg-canvas"><ChevronLeft size={14} aria-hidden="true" /> Prev</Link>
                : <span title="This is the first paper" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft opacity-50"><ChevronLeft size={14} aria-hidden="true" /> Prev</span>}
              {/* Once this paper is decided, Next becomes the main action — decide, move on. */}
              {nextId ? <Link href={chairPaperHref(conference.id, nextId, "review")} title={`Next: ${nextId}`} className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-bold ${current ? "border-primary bg-primary text-white" : "border-line bg-white text-ink-soft hover:bg-canvas"}`}>{current ? "Next paper" : "Next"} <ChevronRight size={14} aria-hidden="true" /></Link>
                : <span title="This is the last paper in the list" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft opacity-50">Next <ChevronRight size={14} aria-hidden="true" /></span>}
            </div>
          </div>
        )}
        <PageHero
          label="Submission"
          tile={monogram(conference.acronym)}
          title={paper.title}
          badge={<span style={{ color: "#B45309", background: "var(--warning-soft)" }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"><Clock size={11} aria-hidden="true" /> {pillText}</span>}
          footer={isReview ? undefined : <PaperTimeline detail={detail} outcomeType={outcomeType} />}
          chips={isReview
            // Review page: only what bears on the decision; the dates live on the details page.
            ? <><HeroChip icon={Hash}>{paper.id}</HeroChip>{paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}{paper.withdrawn && <HeroChip tone="danger">Withdrawn {paper.withdrawnAt}</HeroChip>}</>
            : <><HeroChip tone="var(--primary)">{conference.acronym}</HeroChip><HeroChip icon={Hash}>{paper.id}</HeroChip>{paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}<HeroChip>Submitted {paper.submittedAt || "—"}</HeroChip>{paper.lastUpdate && <HeroChip>Last updated {paper.lastUpdate}</HeroChip>}{paper.withdrawn && <HeroChip tone="danger">Withdrawn {paper.withdrawnAt}</HeroChip>}</>}
          actions={isReview
            ? <><HeroLink icon={FileText} href={base}>Paper details</HeroLink><HeroButton icon={Eye} onClick={() => void viewSubmission()} title="Open the paper in a new tab">View submission</HeroButton><HeroButton icon={Download} primary disabled={busy} onClick={() => void downloadFiles()} title="Download the files as one ZIP">Download</HeroButton></>
            : <><HeroLink icon={Users} href={`${base}/review`}>Peer Review</HeroLink>{!paper.withdrawn && <HeroButton icon={Mail} onClick={() => setEmailOpen(true)} title="Write to this paper's authors">Email authors</HeroButton>}<HeroButton icon={Eye} onClick={() => void viewSubmission()} title="Open the paper in a new tab">View submission</HeroButton><HeroButton icon={Download} primary disabled={busy} onClick={() => void downloadFiles()} title="Download the files as one ZIP">Download</HeroButton>{!paper.withdrawn && <HeroButton icon={Pencil} onClick={() => setManage("details")} title="Change the title, abstract and keywords">Edit</HeroButton>}</>}
        />
        {isReview ? (
          <ReviewBody detail={detail} current={current} outcomeType={outcomeType} choices={reviewChoices} pick={pick} onPick={setPick} text={text} onNote={setNote} notified={notified} busy={busy} error={confirm ? "" : error} withdrawn={paper.withdrawn}
            onRecord={() => { setError(""); setConfirm(true); }} onNotify={() => void notify()} onShare={(r, v) => void share(r, v)} onEdit={(r) => { if (r.byChair) { router.push(`${base}/review/add`); return; } setError(""); setDlg({ kind: "edit", reviewer: r }); }}
            onDecideExtension={(r, v) => void decideExtension(r, v)} onReviewerAction={(type, r) => { setError(""); setRdlg({ type, reviewer: r }); }} onAddReview={() => router.push(`${base}/review/add`)} onAddReviewer={() => void openAdd()} hasMine={Boolean(mine)} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-6">
              <PaperCard detail={detail} />
              <FilesCard detail={detail} onNotice={(title, text) => setToast({ title, text })} onAddSupporting={paper.withdrawn ? null : () => setManage("files-supporting")} />
              <NoteCard detail={detail} onUpload={() => setManage("files-paper")} />
            </div>
            <div className="space-y-6">
            <RegistrationCard key={`${paper.dbId}-${paper.registration?.updatedAt ?? "new"}`} paper={paper} busy={busy} onSave={saveRegistration} />
            <ManageCard detail={detail} onDetails={() => setManage("details")} onAuthors={() => setManage("authors")} onFiles={() => setManage("files-paper")} onWithdraw={() => setManage("withdraw")} />
            <Card title="Paper actions" icon={Pencil}>
              {detail.fixRequest && <div className="mb-2 rounded-lg bg-warning-soft px-3 py-2 text-[11px] font-semibold leading-relaxed text-warning">Fix requested {detail.fixRequest.at}{detail.fixRequest.fixBy ? ` · due ${new Date(`${detail.fixRequest.fixBy}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}` : ""}</div>}
              <div className="space-y-1">
                <button type="button" disabled={paper.withdrawn || notified} onClick={() => { setError(""); setFixOpen(true); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50"><AlertTriangle size={15} aria-hidden="true" className="text-warning" /> Ask author to fix</button>
                <button type="button" disabled={paper.withdrawn || notified} onClick={() => { setError(""); setDlg({ kind: "desk" }); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50"><XCircle size={15} aria-hidden="true" className="text-danger" /> Desk reject</button>
              </div>
              {error && dlg === null && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
              <Link href={confBase} className="mt-4 inline-block text-[12px] font-bold text-primary hover:underline">Back to all submissions</Link>
            </Card>
            </div>
          </div>
        )}
      </div>
      <ConfirmDecision detail={detail} type={confirm ? pick : null} note={text} onClose={() => setConfirm(false)} onConfirm={record} busy={busy} error={error} />
      <ReviewDialog form={detail.form} open={dlg?.kind === "edit" || dlg?.kind === "own"} title={dlg?.kind === "edit" ? (dlg.reviewer.byChair ? "Edit my review" : `Edit ${dlg.reviewer.name}’s review`) : mine?.review ? "Edit my review" : "Review this paper"} description={`${paper.id} · ${paper.title}`} initial={dlg?.kind === "edit" ? valuesOf(dlg.reviewer) : valuesOf(mine)} confirm={dlg?.kind === "edit" && !dlg.reviewer.byChair ? "Save changes" : "Save review"} onClose={closeDlg} onSave={(v) => void saveReviewDlg(v)} busy={busy} error={error} />
      <ReviewerActionDialog action={rdlg} paperLabel={paper.id} onClose={closeReviewerDlg} onConfirm={(i) => void reviewerAction(i)} busy={busy} error={error} />
      <FixRequestDialog open={fixOpen} paperLabel={paper.id} onClose={closeReviewerDlg} onConfirm={(i) => void askFix(i)} busy={busy} error={error} />
      <DeskRejectDialog open={dlg?.kind === "desk"} paperLabel={paper.id} onClose={closeDlg} onConfirm={(r) => void deskReject(r)} busy={busy} error={error} />
      <Dialog open={add !== null} onClose={() => { if (!busy) setAdd(null); }} title="Add reviewers" size="lg">
        {add && <AddReviewersModal paperLabel={`${paper.id} · ${paper.title}`} candidates={add.candidates} poolEmails={add.poolEmails} acronym={conference.acronym} maxLoad={add.maxLoad} deadline={add.deadline} busy={busy} error={add.error} onAdd={(picks, due) => void addReviewers(picks, due)} onClose={() => setAdd(null)} />}
      </Dialog>
      <EditDetailsDialog asChair paper={asAuthor} open={manage === "details"} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      <EditAuthorsDialog asChair paper={asAuthor} open={manage === "authors"} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      <WithdrawDialog asChair paper={asAuthor} open={manage === "withdraw"} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      <UpdateFilesDialog asChair paper={asAuthor} open={manage === "files-paper" || manage === "files-supporting"} initialTab={manage === "files-supporting" ? "supporting" : "paper"} onOpenFile={openFile} onClose={() => setManage(null)} onSaved={saved} onSessionEnded={retry} />
      {emailOpen && <EmailAuthorsDialog open paper={paper} conferenceName={conference.name} acronym={conference.acronym} conferenceSlug={conference.id} onClose={() => setEmailOpen(false)} onSent={(count) => { setEmailOpen(false); setToast({ title: `Email sent to ${count} author${count === 1 ? "" : "s"}`, text: "Every email is listed in Email Logs." }); }} />}
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
