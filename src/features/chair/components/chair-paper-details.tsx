"use client";

import { AlignLeft, Check, ChevronRight, Download, Eye, FilePlus, FileText, FileUp, MessageSquare, Paperclip, Pencil, Tag, Upload, UserPlus, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { getChairService } from "@/services/chair";
import type { AuthorPaper } from "@/types/author-submission";
import { ATTENDANCE_LABELS, PAYMENT_LABELS, type ChairFile, type ChairPaperDetail, type DecisionType } from "@/types/chair";
import { plagDecisionOf } from "../screening";
import { checkDecisionOf, isDecision } from "../stage";

/* The body of the chair's paper details page (the prototype's SubmissionDetailPage, chair layout): the status timeline (Submitted → Initial check →
   Plagiarism check → Review → decision → Registration), the paper (keywords, abstract, authors), its files with View / Download, and the chair's note and
   the comments shared with the authors. Not ported: Email authors, Manage submission (update the submission, the authors or the files, withdraw for the
   authors) and "Upload on their behalf" — they change the authors' own submission on their behalf, which the database does not allow a chair to do. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

type StepState = "done" | "current" | "upcoming";
interface Step { key: string; label: string; sub: string; state: StepState; color?: string }

/** The pipeline the paper is in: each step done, the first one not done current, the rest to come. */
export function paperSteps(detail: ChairPaperDetail, outcomeType: DecisionType | null): Step[] {
  const { paper, data } = detail;
  const rec = paper.screening[String(paper.versions)];
  const steps: Array<Omit<Step, "state"> & { done: boolean }> = [{ key: "sub", label: "Submitted", sub: paper.submittedAt || "—", done: true }];
  if (data.screening.initialCheck) {
    const d = checkDecisionOf(rec);
    steps.push({ key: "ic", label: "Initial check", sub: d === "passed" ? "Passed" : d === "revision" ? "Revision" : d === "reject" ? "Rejected" : d === "hold" ? "On hold" : "Not decided", done: d === "passed" || paper.reviewersAssigned > 0 || isDecision(paper.outcome) });
  }
  if (data.screening.plagiarism) {
    const d = plagDecisionOf(rec);
    steps.push({ key: "pl", label: "Plagiarism check", sub: d === "clear" ? "Cleared" : d === "pending" ? "Not decided" : d === "revision" ? "Revision" : d === "reject" ? "Rejected" : "On hold", done: d === "clear" || paper.reviewersAssigned > 0 || isDecision(paper.outcome) });
  }
  const decided = isDecision(paper.outcome);
  const reviewsIn = paper.reviewsReceived;
  steps.push({ key: "rv", label: "Review", sub: paper.reviewersAssigned === 0 ? "No reviewers yet" : `${reviewsIn} review${reviewsIn === 1 ? "" : "s"}`, done: decided || (paper.reviewersAssigned > 0 && reviewsIn >= paper.reviewersAssigned) });
  const accepted = paper.outcome === "accept" || paper.outcome === "registered";
  steps.push({ key: "dc", label: decided ? (outcomeType?.label ?? "Decision") : "Decision", sub: "", done: accepted, color: decided && !accepted ? outcomeType?.color : undefined });
  const r = paper.registration;
  const paid = r?.payment === "paid" || r?.payment === "waived";
  steps.push({ key: "rg", label: "Registration", sub: r ? `${PAYMENT_LABELS[r.payment]}${r.attendance ? ` · ${ATTENDANCE_LABELS[r.attendance]}` : ""}` : "", done: paper.outcome === "registered" || paid });
  const first = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ key: s.key, label: s.label, sub: s.sub, color: s.color, state: s.done ? "done" : i === first ? "current" : "upcoming" }));
}

export function PaperTimeline({ detail, outcomeType }: { detail: ChairPaperDetail; outcomeType: DecisionType | null }) {
  const steps = paperSteps(detail, outcomeType);
  return (
    <ol aria-label="Where the paper stands" className="flex items-start">
      {steps.map((s, i) => {
        const on = s.state === "done" ? "var(--success)" : s.state === "current" ? (s.color ?? "var(--primary)") : "var(--line-strong)";
        return (
          <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : ""}`} style={i === 0 ? undefined : { background: steps[i - 1].state === "done" ? "var(--success)" : "var(--border)" }} aria-hidden="true" />
              <span aria-current={s.state === "current" ? "step" : undefined} style={s.state === "done" ? { background: on, color: "#FFFFFF" } : { border: `2px solid ${on}`, background: "#FFFFFF" }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                {s.state === "done" ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : s.state === "current" ? <span style={{ background: on }} className="h-2.5 w-2.5 rounded-full" /> : null}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? "bg-transparent" : ""}`} style={i === steps.length - 1 ? undefined : { background: s.state === "done" ? "var(--success)" : "var(--border)" }} aria-hidden="true" />
            </div>
            <div style={{ color: s.state === "upcoming" ? "var(--ink-faint)" : on }} className="mt-1.5 text-center text-[11px] font-bold leading-tight">{s.label}</div>
            {s.sub && <div className="text-center text-[10px] text-ink-faint">{s.sub}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function PaperCard({ detail }: { detail: ChairPaperDetail }) {
  const { paper } = detail;
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      {detail.keywords.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint"><Tag size={12} aria-hidden="true" /> Keywords</div>
          <div className="flex flex-wrap gap-1.5">{detail.keywords.map((k) => <span key={k} className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">{k}</span>)}</div>
        </div>
      )}
      <div className="mb-2 flex items-center gap-1.5 border-t border-muted pt-4 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint"><AlignLeft size={12} aria-hidden="true" /> Abstract</div>
      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">{detail.abstract || "No abstract."}</p>
      <div className="mb-2 mt-5 flex items-center justify-between border-t border-muted pt-4 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint"><span className="flex items-center gap-1.5"><Users size={12} aria-hidden="true" /> Authors</span><span className="font-semibold normal-case tracking-normal">{paper.authors.length} author{paper.authors.length === 1 ? "" : "s"}</span></div>
      <ul className="space-y-2">
        {paper.authors.map((a) => (
          <li key={`${a.email}-${a.name}`} style={a.corresponding ? { background: "var(--primary-soft)", borderColor: "var(--primary-soft-border)" } : undefined} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{initials(a.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-navy">{a.name}{a.corresponding && <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">Corresponding</span>}</div>
              <div className="truncate text-[11.5px] text-ink-faint">{[a.affiliation, a.country].filter(Boolean).join(", ")}{a.corresponding && a.email ? ` · ${a.email}` : ""}</div>
            </div>
            <span className="shrink-0 rounded-full border border-line bg-white px-2 py-0.5 text-[10.5px] font-semibold text-ink-muted">{a.corresponding ? "Main author" : "Co-author"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The paper as the author dialogs (update details, authors, files; withdraw) read it: they only need its ids, text, authors and files, and the database
 *  decides who may change it (a chair of the conference may). */
export function toAuthorPaper(detail: ChairPaperDetail): AuthorPaper {
  const { paper } = detail;
  return {
    dbId: paper.dbId, id: paper.id, title: paper.title, abstract: detail.abstract, keywords: detail.keywords,
    status: paper.outcome === "accept" || paper.outcome === "registered" ? "accepted" : paper.outcome === "reject" ? "rejected" : "under_review",
    result: paper.outcome === "registered" ? "registered" : null,
    authors: paper.authors.map((a) => ({ ...a, isMe: false })), myEmails: [],
    versions: detail.files.map((f) => ({ name: f.name, uploadedAt: f.uploadedAt, storagePath: f.storagePath })),
    supporting: detail.supporting.map((f) => ({ name: f.name, uploadedAt: f.uploadedAt, storagePath: f.storagePath })),
    withdrawn: paper.withdrawn,
  } as unknown as AuthorPaper;
}

function ActionRow({ icon: Icon, title, subtitle, onClick, disabled }: { icon: typeof Pencil; title: string; subtitle: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={14} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-navy">{title}</span><span className="block truncate text-[11px] text-ink-faint">{subtitle}</span></span>
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-line-strong" />
    </button>
  );
}

/** Manage submission: the chair changes the paper for its authors (the changes are shared with them straight away). */
export function ManageCard({ detail, onDetails, onAuthors, onFiles, onWithdraw }: { detail: ChairPaperDetail; onDetails: () => void; onAuthors: () => void; onFiles: () => void; onWithdraw: () => void }) {
  const { paper } = detail;
  const lead = paper.authors.filter((a) => a.corresponding).map((a) => a.name).join(", ") || "—";
  const closed = paper.withdrawn;
  return (
    <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
      <div className="p-5 pb-3"><h3 className="text-sm font-extrabold text-navy">Manage submission</h3><p className="mt-0.5 text-[11.5px] text-ink-faint">Changes are shared with the authors straight away.</p></div>
      <div className="px-2.5 pb-2">
        <ActionRow icon={Pencil} title="Update submission" subtitle="Title, abstract & keywords" onClick={onDetails} disabled={closed} />
        <ActionRow icon={UserPlus} title="Update / add authors" subtitle={`${paper.authors.length} author${paper.authors.length === 1 ? "" : "s"} · ${lead} corresponding`} onClick={onAuthors} disabled={closed} />
        <ActionRow icon={FileUp} title="Update files" subtitle="New paper version or supporting docs" onClick={onFiles} disabled={closed} />
      </div>
      {!closed && (
        <div className="border-t border-muted p-5">
          <button type="button" onClick={onWithdraw} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-danger-soft bg-white py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger-soft"><XCircle size={14} aria-hidden="true" /> Withdraw for the authors</button>
          <p className="mt-1.5 text-center text-[10.5px] text-ink-faint">Only when the authors ask. The authors are emailed. This can&apos;t be undone.</p>
        </div>
      )}
    </div>
  );
}

export function FilesCard({ detail, onNotice, onAddSupporting }: { detail: ChairPaperDetail; onNotice: (title: string, text: string) => void; onAddSupporting?: (() => void) | null }) {
  const [busy, setBusy] = useState("");
  const rows: Array<{ f: ChairFile; type: string; latest: boolean }> = [
    ...detail.files.map((f, i) => ({ f, type: `Paper`, latest: i === detail.files.length - 1 })),
    ...detail.supporting.map((f) => ({ f, type: "Supplementary material", latest: false })),
  ];
  const open = async (f: ChairFile, download: boolean) => {
    if (!f.storagePath) { onNotice("No file here", "This file isn't stored in this workspace."); return; }
    setBusy(`${f.name}:${download}`);
    try { window.open(await (await getChairService()).fileUrl(f.storagePath, download ? f.name : undefined), "_blank", "noopener"); } catch (e) { onNotice("Couldn't open the file", e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(""); }
  };
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-[15px] font-extrabold text-navy"><FileText size={15} aria-hidden="true" className="text-primary" /> Files</h2>{onAddSupporting && <button type="button" onClick={onAddSupporting} className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline"><FilePlus size={13} aria-hidden="true" /> Add supporting document</button>}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-[11.5px] font-semibold text-ink-muted"><th className="py-2 pr-3 font-semibold">S.No.</th><th className="py-2 pr-3 font-semibold">File type</th><th className="py-2 pr-3 font-semibold">File name</th><th className="py-2 pr-3 font-semibold">Date</th><th className="py-2 text-right font-semibold">Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="border-t border-muted py-6 text-center text-ink-faint">No files.</td></tr>}
            {rows.map(({ f, type, latest }, i) => (
              <tr key={`${f.name}-${f.uploadedAt}-${i}`} className="border-t border-muted">
                <td className="py-3 pr-3 text-ink-muted">{i + 1}</td>
                <td className="py-3 pr-3 font-semibold text-navy">{type}{type === "Paper" && <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">v{i + 1}{latest ? " · latest" : ""}</span>}</td>
                <td className="py-3 pr-3"><span className="inline-flex items-center gap-1.5 text-ink">{type === "Paper" ? <FileText size={13} aria-hidden="true" className="text-ink-faint" /> : <Paperclip size={13} aria-hidden="true" className="text-ink-faint" />}<span className="break-all">{f.name}</span></span></td>
                <td className="whitespace-nowrap py-3 pr-3 text-ink-soft">{f.uploadedAt || "—"}</td>
                <td className="py-3"><span className="flex justify-end gap-2">
                  <button type="button" disabled={busy !== ""} onClick={() => void open(f, false)} aria-label={`View ${f.name}`} title="View" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-line text-primary hover:bg-primary-soft disabled:opacity-50"><Eye size={14} aria-hidden="true" /></button>
                  <button type="button" disabled={busy !== ""} onClick={() => void open(f, true)} aria-label={`Download ${f.name}`} title="Download" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"><Download size={14} aria-hidden="true" /></button>
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** The chair's note that went with the decision, and the reviewers' comments the chair chose to share with the authors. */
export function NoteCard({ detail, onUpload }: { detail: ChairPaperDetail; onUpload?: (() => void) | null }) {
  const shared = detail.reviewers.flatMap((r) => (r.review?.shared && r.review.commentsToAuthor ? [{ text: r.review.commentsToAuthor, at: r.review.submittedAt }] : []));
  const note = detail.decisionNote.trim();
  const asked = detail.paper.outcome === "revise" && !detail.paper.withdrawn;
  if (!note && shared.length === 0 && !asked) return null;
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      {note && (
        <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="rounded-xl px-4 py-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-primary"><MessageSquare size={12} aria-hidden="true" /> A note from the programme chair</div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-navy">{note}</p>
        </div>
      )}
      {shared.length > 0 && (
        <div className={note ? "mt-5" : ""}>
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-extrabold text-navy"><MessageSquare size={14} aria-hidden="true" /> Comments shared with the authors</h2><span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">{shared.length} comment{shared.length === 1 ? "" : "s"}</span></div>
          <ol className="space-y-3">{shared.map((c, i) => (
            <li key={i}>
              <div className="mb-1 text-xs"><b className="text-navy">Comment {i + 1}</b> <span className="text-ink-faint">{c.at}</span></div>
              <p className="whitespace-pre-wrap rounded-xl border border-line px-4 py-3 text-[13px] leading-relaxed text-ink-soft">{c.text}</p>
            </li>
          ))}</ol>
        </div>
      )}
      {asked && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-muted pt-4"><p className="text-xs font-semibold text-[#B45309]">You asked the authors for changes — waiting for their revised paper.</p>{onUpload && <button type="button" onClick={onUpload} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--primary-soft-border)] bg-white px-3 text-xs font-bold text-primary hover:bg-primary-soft"><Upload size={13} aria-hidden="true" /> Upload on their behalf</button>}</div>}
    </section>
  );
}
