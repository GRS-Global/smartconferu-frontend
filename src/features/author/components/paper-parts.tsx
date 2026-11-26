"use client";

import {
  AlertTriangle, Award, BookOpen, CalendarClock, Check, ChevronRight, Download, Eye, FileCheck, FileText, FileUp, Image as ImageIcon, Info, Lock,
  Mail, MessageSquare, Paperclip, Pencil, Plus, Tag, Ticket, User, UserPlus, Users, X, XCircle, type LucideIcon,
} from "lucide-react";
import { Fragment } from "react";
import type { AuthorPaper, AuthorRegistration, PaperFile, PaperPageAuthor, PaperScreeningNotice, SharedComment } from "@/types/author-submission";
import { conferenceDest, newSubmissionHref, type Dest } from "../links";
import { DestLink } from "./overview-parts";

/* The pieces of the Author's paper page (the prototype's SubmissionDetailPage, author layout, in author-journey.jsx):
   the timeline, the presentation panel, the screening notice, keywords / abstract / authors, the files table, the chair's
   comments and the "Manage submission" card. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const plural = (n: number) => (n === 1 ? "" : "s");

/* ---------------- timeline ---------------- */

type Tone = "primary" | "success" | "warning" | "danger";
interface Step { key: string; label: string; state: "done" | "current" | "upcoming" | "skipped"; tone?: Tone; date?: string | null; hint?: string | null }
const TONES: Record<Tone, { solid: string; soft: string }> = {
  primary: { solid: "var(--primary)", soft: "var(--primary-soft)" },
  success: { solid: "var(--success)", soft: "var(--success-soft)" },
  warning: { solid: "var(--warning)", soft: "var(--warning-soft)" },
  danger: { solid: "var(--danger)", soft: "var(--danger-soft)" },
};

/** The author's journey: Submitted → Under Review → Decision → Registration → Certificate. One step covers everything before the
 *  decision — authors never see which check a paper is in, only whether they are asked to fix something. */
function stepsOf(p: AuthorPaper, registered: boolean, certificateIssued: boolean): Step[] {
  const notSent = p.status === "draft" || p.uploadPending;
  const accepted = p.status === "accepted";
  const rejected = p.status === "rejected";
  const decided = accepted || rejected;
  const revise = p.decision === "revise" && !decided;
  const steps: Step[] = [
    notSent ? { key: "submitted", label: "Submitted", state: "current", tone: "warning", hint: "Upload your paper" } : { key: "submitted", label: "Submitted", state: "done", date: p.submittedAt },
  ];
  if (p.withdrawn) {
    return [...steps, { key: "withdrawn", label: "Withdrawn", state: "done", tone: "danger", date: p.withdrawnAt }, { key: "under_review", label: "Under Review", state: "skipped" },
      { key: "decision", label: "Decision", state: "skipped" }, { key: "registration", label: "Registration", state: "skipped" }, { key: "certificate", label: "Certificate", state: "skipped" }];
  }
  const asked = !notSent && !decided && !revise && Boolean(p.screeningNotice);
  steps.push(
    notSent ? { key: "under_review", label: "Under Review", state: "upcoming" }
      : decided || revise ? { key: "under_review", label: "Under Review", state: "done" }
        : asked ? { key: "under_review", label: "Under Review", state: "current", tone: "warning", hint: "Revision required" }
          : { key: "under_review", label: "Under Review", state: "current", hint: "In progress" },
    accepted ? { key: "decision", label: "Accepted", state: "done", tone: "success", date: p.lastUpdate }
      : rejected ? { key: "decision", label: "Rejected", state: "done", tone: "danger", date: p.lastUpdate }
        : revise ? { key: "decision", label: "Changes requested", state: "current", tone: "warning" }
          : { key: "decision", label: "Decision", state: "upcoming" },
    rejected ? { key: "registration", label: "Registration", state: "skipped" }
      : accepted && registered ? { key: "registration", label: "Registered", state: "done", tone: "success" }
        : accepted ? { key: "registration", label: "Registration", state: "current", tone: "warning", hint: "Pending" }
          : { key: "registration", label: "Registration", state: "upcoming" },
    rejected ? { key: "certificate", label: "Certificate", state: "skipped" }
      : certificateIssued ? { key: "certificate", label: "Certificate", state: "done", tone: "success", hint: "Issued" }
        : { key: "certificate", label: "Certificate", state: "upcoming", hint: accepted && registered ? "After you present" : null },
  );
  return steps;
}

export function PaperTimeline({ paper, registered, certificateIssued }: { paper: AuthorPaper; registered: boolean; certificateIssued: boolean }) {
  const steps = stepsOf(paper, registered, certificateIssued);
  return (
    <ol aria-label="Where this paper stands" className="flex w-full items-start pt-1">
      {steps.map((step, i) => {
        const tone = TONES[step.tone || "primary"];
        const done = step.state === "done";
        const current = step.state === "current";
        const skipped = step.state === "skipped";
        const next = steps[i + 1];
        const lineFilled = next && (next.state === "done" || next.state === "current");
        return (
          <Fragment key={step.key}>
            <li aria-current={current ? "step" : undefined} className="flex shrink-0 flex-col items-center" style={{ width: 110 }}>
              <span
                aria-hidden="true"
                style={{ width: 26, height: 26, background: done ? tone.solid : current ? tone.soft : "#FFFFFF", border: `2px solid ${done || current ? tone.solid : "var(--border-strong)"}`, opacity: skipped ? 0.45 : 1, ...(current ? { boxShadow: `0 0 0 4px ${tone.soft}` } : {}) }}
                className="flex items-center justify-center rounded-full"
              >
                {done && (step.tone === "danger" ? <X size={13} strokeWidth={3} color="#FFFFFF" /> : <Check size={13} strokeWidth={3} color="#FFFFFF" />)}
                {current && <span style={{ background: tone.solid }} className="h-2 w-2 rounded-full" />}
              </span>
              <span style={{ color: done || current ? (step.tone ? tone.solid : "var(--navy)") : "var(--ink-faint)", ...(skipped ? { textDecoration: "line-through" } : {}) }} className="mt-2 text-center text-[11.5px] font-bold leading-tight">{step.label}</span>
              {(step.date || step.hint) && !skipped && <span className="mt-0.5 text-center text-[10.5px] font-medium leading-tight text-ink-faint">{step.date || step.hint}</span>}
            </li>
            {next && <div aria-hidden="true" style={{ flex: 1, height: 2, marginTop: 12, minWidth: 12, background: lineFilled ? "var(--primary)" : "var(--border)" }} className="rounded-full" />}
          </Fragment>
        );
      })}
    </ol>
  );
}

/* ---------------- presentation ---------------- */

const PRIMARY_LINK = "rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover";

/** "Your presentation" — shown once the paper is accepted; before registration it is the one thing to do next (register). The
 *  programme is not in the database, so a registered paper has no slot yet; its flyer and certificate follow the prototype's rules. */
export function PresentationPanel({ paper }: { paper: AuthorPaper }) {
  if (paper.result !== "registered" && paper.result !== "not_registered") return null;
  // The own backend: no registration or programme module yet, so the author sees what the organisers recorded by hand.
  if (paper.registration) return <RegistrationPanel paper={paper} registration={paper.registration} />;
  const slug = paper.conference.id;
  if (paper.result === "not_registered") {
    return (
      <section style={{ border: "1px solid #FDE68A", background: "#FFFBEB" }} className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl p-5">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><Ticket size={20} /></span>
        <div className="min-w-[220px] flex-1">
          <div className="text-[15px] font-extrabold text-navy">Your paper was accepted. Register to present it</div>
          <div style={{ color: "#92400E" }} className="text-[13px]">Once you register you can book your presentation slot, and your speaker flyer is made for you.</div>
        </div>
        <DestLink dest={conferenceDest.registration(slug)} className={PRIMARY_LINK}>Register now</DestLink>
      </section>
    );
  }
  // Registered. No programme data yet: no slot, so the flyer (which waits for none by default) is ready and the certificate waits for the talk.
  return (
    <div className="mb-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <section aria-label="Your presentation" style={CARD} className="ui-accent-card overflow-hidden rounded-2xl bg-white lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-2 pt-5">
          <h3 className="text-base font-extrabold text-navy">Your presentation</h3>
          <span style={{ color: "#15803D", background: "var(--success-soft)" }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"><Check size={12} strokeWidth={3} aria-hidden="true" /> Registered</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-6 pt-2">
          <p className="text-sm text-ink-soft">Your date, time and room/hall appear here once your presentation slot is booked.</p>
          <DestLink dest={conferenceDest.programme(slug)} className={PRIMARY_LINK}>Book your slot</DestLink>
        </div>
      </section>
      <aside className="flex flex-col gap-4">
        <DestLink dest={conferenceDest.flyer(slug)} style={CARD} className="flex items-center gap-3.5 rounded-2xl bg-white p-4 text-left hover:border-primary">
          <div style={{ background: "linear-gradient(160deg,#2E1065,#7C3AED 70%,#06B6D4)" }} className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg"><ImageIcon size={20} aria-hidden="true" className="text-white/80" /></div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-navy">Your flyer is ready</div>
            <div className="mb-1.5 mt-0.5 text-[12.5px] text-ink-muted">&quot;I&apos;m presenting at {paper.conference.acronym}&quot;</div>
            <span className="text-[13px] font-bold text-primary">View &amp; download</span>
          </div>
        </DestLink>
        <div style={CARD} className="flex items-center gap-3.5 rounded-2xl bg-white p-4">
          <span aria-hidden="true" style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--border-strong)" }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Award size={19} /></span>
          <div>
            <div className="text-sm font-extrabold text-navy">Certificate of Presentation</div>
            <div className="text-[12.5px] text-ink-muted">Unlocks after you present.</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

const PAYMENT_TEXT: Record<AuthorRegistration["payment"], { label: string; color: string; bg: string; text: string }> = {
  paid: { label: "Paid", color: "#15803D", bg: "var(--success-soft)", text: "The organisers have received your registration fee." },
  waived: { label: "Fee waived", color: "#0369A1", bg: "#E0F2FE", text: "The organisers have waived the registration fee for this paper." },
  not_paid: { label: "Payment pending", color: "#B45309", bg: "var(--warning-soft)", text: "The organisers haven't recorded your registration fee yet. Follow the payment instructions in your acceptance email; once they receive it, it shows here." },
};

/** An accepted paper's registration as the organisers recorded it: payment, how it is presented and who presents it (read-only). */
function RegistrationPanel({ paper, registration: r }: { paper: AuthorPaper; registration: AuthorRegistration }) {
  const pay = PAYMENT_TEXT[r.payment];
  const done = r.payment !== "not_paid";
  const facts: Array<[string, string]> = [
    ["Payment", pay.label],
    ["Attending", r.attendance === "physical" ? "In person (physical)" : r.attendance === "virtual" ? "Online (virtual)" : "Not confirmed yet"],
    ["Presenter", r.presenterName || "Not confirmed yet"],
  ];
  return (
    <div className="mb-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <section aria-label="Registration and attendance" style={done ? CARD : { border: "1px solid #FDE68A", background: "#FFFBEB" }} className={`rounded-2xl p-5 ${done ? "bg-white" : ""} lg:col-span-2`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-navy"><Ticket size={17} aria-hidden="true" className={done ? "text-primary" : "text-warning"} /> Registration &amp; attendance</h3>
          <span style={{ color: pay.color, background: pay.bg }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold">{done && <Check size={12} strokeWidth={3} aria-hidden="true" />}{pay.label}</span>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-white px-3.5 py-2.5">
              <dt className="text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">{k}</dt>
              <dd className="mt-0.5 text-sm font-bold text-navy">{v}</dd>
            </div>
          ))}
        </dl>
        <p style={done ? undefined : { color: "#92400E" }} className={`mt-3 text-[12.5px] leading-relaxed ${done ? "text-ink-muted" : ""}`}>{pay.text} To change how you attend or who presents, write to the organisers of {paper.conference.acronym}.</p>
      </section>
      {done && (
        <aside className="flex flex-col gap-4">
          <DestLink dest={conferenceDest.flyer(paper.conference.id)} style={CARD} className="flex items-center gap-3.5 rounded-2xl bg-white p-4 text-left hover:border-primary">
            <div style={{ background: "linear-gradient(160deg,#2E1065,#7C3AED 70%,#06B6D4)" }} className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg"><ImageIcon size={20} aria-hidden="true" className="text-white/80" /></div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-navy">Your flyer is ready</div>
              <div className="mb-1.5 mt-0.5 text-[12.5px] text-ink-muted">&quot;I&apos;m presenting at {paper.conference.acronym}&quot;</div>
              <span className="text-[13px] font-bold text-primary">View &amp; download</span>
            </div>
          </DestLink>
        </aside>
      )}
    </div>
  );
}

/* ---------------- plagiarism / correction request ---------------- */

/** The correction or revision request on the newest version: what to fix, by when, and the upload button. */
export function ScreeningNotice({ notice, onUpload }: { notice: PaperScreeningNotice; onUpload: () => void }) {
  const correction = notice.kind === "correction";
  const overdue = notice.deadline && new Date(notice.deadline) < new Date(new Date().toDateString());
  return (
    <div style={{ border: "1px solid #FCD9A8", boxShadow: "var(--shadow-card)" }} className="overflow-hidden rounded-2xl bg-white">
      <div style={{ background: "#FFF4E5", borderBottom: "1px solid #FCD9A8" }} className="flex items-start gap-3 px-6 py-4">
        <span aria-hidden="true" style={{ color: "#B45309" }} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white"><AlertTriangle size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 style={{ color: "#92400E" }} className="text-sm font-bold">{correction ? "Your paper needs a few corrections" : "Plagiarism check: revision required"}</h3>
          <p style={{ color: "#92400E" }} className="mt-0.5 text-xs opacity-90">
            {correction ? `Version ${notice.version} didn't meet the submission requirements, so it hasn't been checked for plagiarism yet.` : `Version ${notice.version} was checked with iThenticate. Please revise it before it can go to peer review.`}
          </p>
        </div>
        {notice.deadline && (
          <span style={{ color: overdue ? "var(--danger)" : "#B45309", border: `1px solid ${overdue ? "#FECACA" : "#FCD9A8"}` }} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold">
            <CalendarClock size={12} aria-hidden="true" /> {overdue ? "Overdue · was due" : "Due"} {notice.deadline}
          </span>
        )}
      </div>
      <div className="space-y-4 px-6 py-5">
        <div>
          {notice.reasons.length > 0 && <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">What to fix</div>}
          <ul className="space-y-1.5">
            {notice.reasons.map((r) => (
              <li key={r} className="flex items-start gap-2 text-[13px] text-ink"><span aria-hidden="true" style={{ background: "#B45309" }} className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" /> {r}</li>
            ))}
          </ul>
          {notice.note && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[13px] text-ink-soft">“{notice.note}” <span className="text-xs text-ink-faint">— {notice.by}</span></p>}
        </div>
        {notice.similarity !== null && (
          <div className="rounded-xl border border-line px-4 py-3">
            <div className="text-xs font-semibold text-ink-soft">Similarity score</div>
            <div className="text-xl font-extrabold leading-tight tabular-nums text-danger">{notice.similarity}%</div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-muted pt-4">
          <p className="flex max-w-md items-center gap-1.5 text-xs text-ink-faint"><Lock size={12} aria-hidden="true" className="shrink-0" /> Upload the corrected file as a new version. It&apos;s checked again before peer review.</p>
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-hover"><FileUp size={13} aria-hidden="true" /> Upload version {notice.version + 1}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- keywords, abstract, authors ---------------- */

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2);
const H3 = "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint";

export function PaperBody({ paper }: { paper: AuthorPaper }) {
  return (
    <div style={CARD} className="divide-y divide-muted rounded-2xl bg-white">
      <section className="p-6">
        <h3 className={`${H3} mb-2.5`}><Tag size={12} aria-hidden="true" /> Keywords</h3>
        {paper.keywords.length > 0
          ? <div className="flex flex-wrap gap-1.5">{paper.keywords.map((k) => <span key={k} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{k}</span>)}</div>
          : <p className="text-xs text-ink-faint">No keywords added.</p>}
      </section>
      <section className="p-6">
        <h3 className={`${H3} mb-2.5`}><BookOpen size={12} aria-hidden="true" /> Abstract</h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{paper.abstract || "No abstract yet."}</p>
      </section>
      <section className="p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className={H3}><Users size={12} aria-hidden="true" /> Authors</h3>
          <span className="text-[11px] font-semibold text-ink-faint">{paper.authors.length} author{plural(paper.authors.length)}</span>
        </div>
        <div className="space-y-2">
          {paper.authors.map((a, i) => <AuthorRow key={`${a.email}-${i}`} a={a} first={i === 0} />)}
        </div>
      </section>
    </div>
  );
}

function AuthorRow({ a, first }: { a: PaperPageAuthor; first: boolean }) {
  return (
    <div style={{ border: `1px solid ${a.corresponding ? "var(--primary-soft-border)" : "var(--muted)"}`, background: a.corresponding ? "var(--primary-soft)" : "#FFFFFF" }} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5">
      <div aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary ${a.corresponding ? "bg-white" : "bg-primary-soft"}`}>{initials(a.name)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{a.name}</span>
          {a.isMe && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"><User size={10} strokeWidth={2.6} aria-hidden="true" /> You</span>}
          {a.corresponding && <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white"><Mail size={10} aria-hidden="true" /> Corresponding</span>}
        </div>
        <div className="truncate text-xs text-ink-faint">{[a.affiliation, a.corresponding ? a.email : null].filter(Boolean).join(" · ") || "—"}</div>
      </div>
      <span className={`shrink-0 rounded-full border border-line px-2 py-0.5 text-[10.5px] font-bold ${first ? "bg-white text-navy" : "bg-canvas text-ink-muted"}`}>{first ? "Main author" : "Co-author"}</span>
    </div>
  );
}

/* ---------------- files ---------------- */

interface FileRowData { key: string; type: string; version?: string; latest?: boolean; file: PaperFile; icon: LucideIcon }

/** Every paper version (newest first), then the supporting documents. Each can be viewed (new tab) and downloaded. */
export function FilesTable({ paper, onView, onDownload, onAddSupporting }: { paper: AuthorPaper; onView: (f: PaperFile) => void; onDownload: (f: PaperFile) => void; onAddSupporting: (() => void) | null }) {
  const n = paper.versions.length;
  const rows: FileRowData[] = [
    ...paper.versions.map((v, i) => ({ key: `v${i}`, type: "Paper", version: `v${i + 1}`, latest: i === n - 1, file: v, icon: FileCheck })).reverse(),
    ...paper.supporting.map((d, i) => ({ key: `s${i}`, type: d.type || "Supporting document", file: d, icon: Paperclip })),
  ];
  const th = "whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-bold";
  return (
    <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
      <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy"><FileText size={14} aria-hidden="true" /> Files</h3>
        {onAddSupporting && <button type="button" onClick={onAddSupporting} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus size={13} aria-hidden="true" /> Add supporting document</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-y border-line bg-canvas text-ink-soft">
              <th scope="col" className={`${th} w-16`}>S.No.</th>
              <th scope="col" className={th}>File type</th>
              <th scope="col" className={th}>File name</th>
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={`${th} pr-6 text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-6 py-5 text-center text-xs text-ink-faint">No files uploaded yet.</td></tr>}
            {rows.map((r, i) => {
              const Icon = r.icon;
              return (
                <tr key={r.key} className={i < rows.length - 1 ? "border-b border-muted" : ""}>
                  <td className="px-4 py-3 font-semibold tabular-nums text-ink-faint">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-bold text-navy">{r.type}</span>
                    {r.version && <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.latest ? "bg-primary-soft text-primary" : "bg-muted text-ink-muted"}`}>{r.version}{r.latest && n > 1 ? " · latest" : ""}</span>}
                  </td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 break-all font-semibold text-ink"><Icon size={14} aria-hidden="true" className="shrink-0 text-ink-faint" /> {r.file.name}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{r.file.uploadedAt || paper.lastUpdate || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 pr-6 text-right">
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      <button type="button" onClick={() => onView(r.file)} disabled={!r.file.storagePath} aria-label={`View ${r.file.name}`} title={r.file.storagePath ? "View" : "This file is not stored yet"} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-primary transition-colors hover:border-primary-soft-border hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"><Eye size={15} aria-hidden="true" /></button>
                      <button type="button" onClick={() => onDownload(r.file)} disabled={!r.file.storagePath} aria-label={`Download ${r.file.name}`} title={r.file.storagePath ? "Download" : "This file is not stored yet"} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Download size={15} aria-hidden="true" /></button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- the chair's decision note and shared comments ---------------- */

/** "Comments on your paper" as a thread: one message per shared comment, never reviewer names or scores. */
function Comments({ comments }: { comments: SharedComment[] }) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-navy"><MessageSquare size={14} aria-hidden="true" /> Comments on your paper</h3>
        {comments.length > 0 && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold text-primary">{comments.length} comment{plural(comments.length)}</span>}
      </div>
      {comments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-canvas px-4 py-5 text-center">
          <MessageSquare size={18} aria-hidden="true" className="mx-auto mb-1.5 text-line-strong" />
          <p className="text-xs text-ink-faint">No comments have been shared with you.</p>
        </div>
      ) : (
        <ol className="relative space-y-4">
          {comments.length > 1 && <span aria-hidden="true" className="absolute bottom-9 left-[17px] top-9 w-0.5 rounded-full bg-muted" />}
          {comments.map((c) => (
            <li key={c.n} className="relative flex items-start gap-3">
              <span aria-hidden="true" style={{ border: "2px solid #FFFFFF", boxShadow: "0 0 0 1px var(--primary-soft-border)" }} className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><MessageSquare size={15} /></span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-bold text-navy">Comment {c.n}</span>
                  {c.submittedAt && <span className="text-[11.5px] font-medium text-ink-faint">{c.submittedAt}</span>}
                </div>
                <div style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }} className="relative rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3">
                  <span aria-hidden="true" className="absolute -left-[6px] top-3 h-2.5 w-2.5 -rotate-45 border-l border-t border-line bg-white" />
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{c.text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function DecisionCard({ paper, onUpload }: { paper: AuthorPaper; onUpload: () => void }) {
  if (!paper.decisionTold) return null;
  return (
    <div style={CARD} className="rounded-2xl bg-white p-6">
      {paper.decisionNote && (
        <div className="mb-5 rounded-xl border border-primary-soft-border bg-primary-soft px-4 py-3.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wide text-primary-hover"><MessageSquare size={13} aria-hidden="true" /> A note from the programme chair</div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{paper.decisionNote}</p>
        </div>
      )}
      <Comments comments={paper.comments} />
      {paper.decisionTold === "revise" && !paper.withdrawn && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-muted pt-4">
          <p className="text-xs font-semibold text-warning">The organisers have asked for changes. Upload your revised paper.</p>
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover"><FileUp size={13} aria-hidden="true" /> Upload revised paper</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- manage submission ---------------- */

function ActionRow({ icon: Icon, title, subtitle, dest, onClick, disabled }: { icon: LucideIcon; title: string; subtitle: string; dest?: Dest | null; onClick?: () => void; disabled?: boolean }) {
  const cls = "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors";
  const inner = (
    <>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-navy">{title}</span>
        <span className="block truncate text-[11.5px] text-ink-faint">{subtitle}</span>
      </span>
      <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-line-strong" />
    </>
  );
  if (disabled || (!dest && !onClick)) return <span aria-disabled="true" className={`${cls} cursor-not-allowed opacity-50`}>{inner}</span>;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:bg-canvas`}>{inner}</button>
    : <a href={dest!.href} className={`${cls} hover:bg-canvas`}>{inner}</a>;
}

/** What may be changed, and why not. The prototype's lock rules: nothing after withdrawal or a final decision; an accepted
 *  paper only for final files (the organisers' "edits after acceptance" switch is not in the database and is off by default). */
export function lockReasonOf(p: AuthorPaper): string | null {
  if (p.withdrawn) return "This paper has been withdrawn, so it can no longer be changed.";
  if (p.status === "rejected") return "A final decision has been made, so this paper can no longer be changed.";
  if (p.status === "accepted") return "The organisers have closed edits to accepted papers. You can still upload final files.";
  return null;
}

const newHrefDest = (slug: string): Dest | null => { const h = newSubmissionHref(slug); return h ? { href: h, external: false } : null; };

export function ManageCard({ paper, onDetails, onAuthors, onFiles, onWithdraw }: { paper: AuthorPaper; onDetails: () => void; onAuthors: () => void; onFiles: () => void; onWithdraw: () => void }) {
  const lock = lockReasonOf(paper);
  const detailsLocked = Boolean(lock);
  const authorsLocked = detailsLocked || !paper.mySubmission;
  const filesLocked = paper.withdrawn || paper.status === "rejected";
  const canWithdraw = !paper.withdrawn && paper.status !== "rejected";
  const leads = paper.authors.filter((a) => a.corresponding).map((a) => a.name).join(", ") || "—";
  return (
    <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
      <div className="p-5 pb-3">
        <h3 className="text-sm font-extrabold text-navy">Manage submission</h3>
        <p className="mt-0.5 text-[11.5px] text-ink-faint">Changes are shared with the organisers straight away.</p>
      </div>
      {paper.status === "draft" && !paper.withdrawn && (
        <div className="px-5 pb-3">
          <DestLink dest={newHrefDest(paper.conference.id)} className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90">Continue editing &amp; submit</DestLink>
        </div>
      )}
      {lock && (
        <div className="px-5 pb-2"><div className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted"><Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" /> {lock}</div></div>
      )}
      <div className="px-2.5 pb-2">
        <ActionRow icon={Pencil} title="Update submission" subtitle="Title, abstract & keywords" onClick={onDetails} disabled={detailsLocked} />
        <ActionRow icon={UserPlus} title="Update / add authors" subtitle={`${paper.authors.length} author${plural(paper.authors.length)} · ${leads} corresponding`} onClick={onAuthors} disabled={authorsLocked} />
        <ActionRow icon={FileUp} title="Update files" subtitle="New paper version or supporting docs" onClick={onFiles} disabled={filesLocked} />
      </div>
      {canWithdraw && (
        <div className="border-t border-muted p-5">
          <button type="button" onClick={onWithdraw} className="flex w-full items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-danger-soft bg-white py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger-soft"><XCircle size={15} aria-hidden="true" /> Withdraw submission</button>
          <p className="mt-1.5 text-center text-[10.5px] text-ink-faint">Removes it from review. This can&apos;t be undone.</p>
        </div>
      )}
    </div>
  );
}

export const certificateTitleOf = (p: AuthorPaper, registered: boolean): string =>
  p.withdrawn || p.status === "rejected" ? "No certificate for this paper"
    : registered ? "Your certificate unlocks after you present"
      : p.status === "accepted" ? "Register for the conference to earn your certificate"
        : "Certificates are issued once an accepted paper is presented";

