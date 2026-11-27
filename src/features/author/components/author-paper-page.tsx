"use client";

import { Award, Calendar, Clock, Download, Eye, Hash, Pencil, Tag, TriangleAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { EditAuthorsDialog, EditDetailsDialog, UpdateFilesDialog, WithdrawDialog, type Saved } from "./paper-dialogs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionEnded } from "@/features/auth/components/session-ended";
import { AuthorShell } from "@/features/workspace/components/author-shell";
import { HeroButton, HeroChip, HeroLink, PageHero } from "@/features/workspace/components/hero";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { AuthRequiredError } from "@/services/errors";
import type { PaperFile } from "@/types/author-submission";
import { monogram } from "../format";
import { conferenceDest } from "../links";
import { authorStatusOf } from "../status";
import { useAuthorPaper } from "../use-author-paper";
import { useConferenceCertificates } from "@/features/certificates/use-conference-certificates";
import { CERTIFICATES_ENABLED } from "@/lib/config";
import { DecisionCard, FilesTable, ManageCard, PaperBody, PlagiarismReports, PaperTimeline, PresentationPanel, ScreeningNotice, certificateTitleOf, lockReasonOf } from "./paper-parts";
import { StatusPill } from "./submission-parts";
import { authorPaperHref } from "@/lib/routes";
import { useCanonicalPath } from "@/lib/use-canonical-path";

/* A paper's own page, as its author sees it (the prototype's SubmissionDetailPage, author layout): the header with its status
   and the author's timeline, the presentation panel once accepted, the correction / revision request, keywords, abstract and
   authors, every file, the chair's note and shared comments, and "Manage submission". Reading is ported; the ways of changing a
   paper (edit details, authors, upload a new version, withdraw) still happen on the prototype's page of the same paper. */
export function AuthorPaperPage({ label }: { label: string }) {
  const { state, retry, reload } = useAuthorPaper(label);
  useCanonicalPath(state.status === "ready" ? authorPaperHref(state.paper.conference.id, label) : null);
  const certificates = useConferenceCertificates(state.status === "ready" ? state.paper.conference.id : "");
  const [fileError, setFileError] = useState("");
  const [dialog, setDialog] = useState<"details" | "authors" | "withdraw" | "files-paper" | "files-supporting" | null>(null);
  // A saved change that the emails could not follow: shown next to the page (the change itself worked).
  const [notice, setNotice] = useState("");

  const title = <PageHeader title={label} />;
  if (state.status === "loading") {
    return (
      <>
        {title}
        <div role="status" aria-label="Loading this paper" className="space-y-4 p-4 sm:p-8">
          <div className="h-48 animate-pulse rounded-2xl border border-line bg-white" />
          <div className="h-60 animate-pulse rounded-2xl border border-line bg-white" />
        </div>
      </>
    );
  }
  if (state.status === "auth") {
    return (
      <>
        {title}
        <div role="status" aria-label="Loading this paper" className="p-4 sm:p-8"><div className="h-60 animate-pulse rounded-2xl border border-line bg-white" /></div>
        <SessionEnded onRecovered={retry} />
      </>
    );
  }
  if (state.status === "error" || state.status === "missing") {
    const missing = state.status === "missing";
    return (
      <>
        <PageHeader title={label} breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label }]} />
        <div className="p-4 sm:p-8">
          <div className="max-w-4xl rounded-2xl border border-line bg-white">
            <EmptyState
              icon={TriangleAlert}
              title={missing ? "We couldn't find that paper." : state.config ? "The database connection isn't set up." : "Couldn't load this paper."}
              description={missing ? "It doesn't exist, or you are not one of its authors. Find your papers in My Conferences." : state.message}
              action={missing || state.config ? undefined : <Button size="sm" onClick={retry}>Try again</Button>}
            />
          </div>
        </div>
      </>
    );
  }

  const { paper, conference, roles, others } = state;
  const closed = conference.status === "archived";
  const registered = paper.result === "registered";
  const certificateTitle = certificateTitleOf(paper, registered);
  const lock = lockReasonOf(paper);
  const latest = paper.versions.at(-1);
  const versions = paper.versions.length;
  const listDest = conferenceDest.submissions(paper.conference.id);
  const certificatesDest = conferenceDest.certificates(paper.conference.id);

  // A paper file lives in storage: it opens (or downloads) through a short-lived link the database signs for its author.
  const saved = ({ notice: n }: Saved) => { setNotice(n ?? ""); reload(); };
  const open = async (f: PaperFile, download: boolean) => {
    if (!f.storagePath) return;
    setFileError("");
    // Opened first, so the browser sees it as the click's own tab (it is pointed at the link once that arrives).
    const tab = download ? null : window.open("", "_blank");
    try {
      const url = await (await getAuthorSubmissionService()).fileUrl(f.storagePath, download ? f.name : undefined);
      if (download) { const a = document.createElement("a"); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); }
      else if (tab) tab.location.href = url;
    } catch (e) {
      tab?.close();
      if (e instanceof AuthRequiredError) retry();
      else setFileError(e instanceof Error ? e.message : "Couldn't open this file.");
    }
  };

  return (
    <AuthorShell conference={conference} roles={roles} others={others} active={null}>
      <PageHeader
        title={paper.id}
        breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, ...(listDest ? [{ label: "My Submissions", href: listDest.href }] : [{ label: "My Submissions" }]), { label: paper.id }]}
      />
      <div className="hd-page p-8">
        {notice && <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-warning-soft px-3.5 py-2.5 text-sm font-medium text-warning-ink"><span>{notice}</span><button type="button" onClick={() => setNotice("")} className="shrink-0 text-xs font-bold underline">Dismiss</button></div>}
        {fileError && <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-ink"><span>{fileError}</span><button type="button" onClick={() => setFileError("")} className="shrink-0 text-xs font-bold underline">Dismiss</button></div>}

        <div className="mb-5">
          <PageHero
            label="Submission"
            tile={monogram(conference.acronym)}
            title={paper.title}
            badge={<StatusPill status={authorStatusOf({ ...paper, screeningRequest: paper.screeningNotice }, closed)} />}
            chips={(
              <>
                <HeroChip tone="var(--primary)">{conference.acronym}</HeroChip>
                <HeroChip icon={Hash}>{paper.id}</HeroChip>
                {paper.track && <HeroChip icon={Tag}>{paper.track}</HeroChip>}
                <HeroChip icon={Calendar}>Submitted {paper.status === "draft" ? "not yet" : paper.submittedAt || "—"}</HeroChip>
                <HeroChip icon={Clock}>Last updated {paper.lastUpdate || "—"}</HeroChip>
                {paper.withdrawn && <HeroChip icon={XCircle} tone="var(--danger)">Withdrawn{paper.withdrawnBy === "chair" ? " by the chair" : ""} {paper.withdrawnAt}</HeroChip>}
              </>
            )}
            actions={(
              <>
                {paper.status !== "draft" && (
                  <>
                    <HeroButton icon={Eye} onClick={() => { if (latest) void open(latest, false); }} disabled={!latest?.storagePath} title="Open the paper in a new tab">View submission</HeroButton>
                    <HeroButton icon={Download} primary onClick={() => { if (latest) void open(latest, true); }} disabled={!latest?.storagePath} title={latest ? `Download ${latest.name}${versions > 1 ? ` (latest of ${versions} versions)` : ""}` : "No file uploaded"}>
                      Download{versions > 1 ? ` v${versions}` : ""}
                    </HeroButton>
                  </>
                )}
                {CERTIFICATES_ENABLED && certificates > 0 && certificatesDest ? (
                  <HeroLink icon={Award} primary href={certificatesDest.href}>Certificate</HeroLink>
                ) : (
                  <button type="button" disabled title={certificateTitle} aria-label={certificateTitle} className="inline-flex h-12 cursor-not-allowed items-center gap-2 rounded-xl border border-line bg-white px-5 text-[14px] font-bold text-ink-faint">
                    <Award size={15} aria-hidden="true" /> Certificate
                  </button>
                )}
                <HeroButton icon={Pencil} onClick={() => setDialog("details")} disabled={Boolean(lock)} title={lock ?? "Edit title, abstract & keywords"}>Edit</HeroButton>
              </>
            )}
            footer={<div className="overflow-x-auto"><PaperTimeline paper={paper} registered={registered} certificateIssued={certificates > 0} /></div>}
          />
        </div>

        {!paper.withdrawn && <PresentationPanel paper={paper} />}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {!paper.withdrawn && paper.screeningNotice && <ScreeningNotice notice={paper.screeningNotice} onUpload={() => setDialog("files-paper")} />}
            {!paper.withdrawn && <PlagiarismReports reports={paper.plagiarismReports ?? []} onView={(f) => { void open(f, false); }} onDownload={(f) => { void open(f, true); }} />}
            <PaperBody paper={paper} />
            <FilesTable paper={paper} onView={(f) => { void open(f, false); }} onDownload={(f) => { void open(f, true); }} onAddSupporting={paper.withdrawn || paper.status === "rejected" ? null : () => setDialog("files-supporting")} />
            <DecisionCard paper={paper} onUpload={() => setDialog("files-paper")} />
          </div>
          <div className="space-y-5 lg:sticky lg:top-8">
            <ManageCard paper={paper} onDetails={() => setDialog("details")} onAuthors={() => setDialog("authors")} onFiles={() => setDialog("files-paper")} onWithdraw={() => setDialog("withdraw")} />
          </div>
        </div>
      </div>
      <EditDetailsDialog paper={paper} open={dialog === "details"} onClose={() => setDialog(null)} onSaved={saved} onSessionEnded={retry} />
      <EditAuthorsDialog paper={paper} open={dialog === "authors"} onClose={() => setDialog(null)} onSaved={saved} onSessionEnded={retry} />
      <UpdateFilesDialog paper={paper} open={dialog === "files-paper" || dialog === "files-supporting"} initialTab={dialog === "files-supporting" ? "supporting" : "paper"} onOpenFile={(f, d) => { void open(f, d); }} onClose={() => setDialog(null)} onSaved={saved} onSessionEnded={retry} />
      <WithdrawDialog paper={paper} open={dialog === "withdraw"} onClose={() => setDialog(null)} onSaved={saved} onSessionEnded={retry} />
    </AuthorShell>
  );
}

