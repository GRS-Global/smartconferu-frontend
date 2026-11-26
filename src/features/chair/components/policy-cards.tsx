"use client";

import { ChevronDown, Clock, Eye, EyeOff, FileText, Hash, Mail, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useOptionalProfile } from "@/features/profile/profile-context";
import { getChairService } from "@/services/chair";
import type { EmailTemplates, ReviewMode, ReviewPolicy, SubmissionPolicy } from "@/types/chair";
import { emailPreviewDoc, emailSubject } from "../email-preview";
import { EMAIL_SEND_DESC } from "../email-samples";
import type { ReviewField } from "@/features/reviewer/form-schema";
import { HelpLabel } from "./setting-label";

/* The cards the prototype's Submissions and Review settings have beyond tracks, types, limits and the timeline: Submission Period, Numbering &
   Limits, Guidelines, Review & Visibility, and the panels listing the emails the system sends. Their values are kept in
   `conferences.settings` (submissionPolicy / reviewPolicy). The server enforces the submission deadline, the published CFP and double-blind
   review; the other options are recorded for the conference. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const LABEL = "mb-1 block text-xs font-bold text-ink-soft";

export function PolicyCard({ id, icon: Icon, title, desc, children, footer }: { id?: string; icon: typeof Clock; title: string; desc: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section id={id} data-tour={id?.replace(/^rs-/, "rv-")} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={15} aria-hidden="true" /></span><h3 className="text-sm font-bold text-navy">{title}</h3></div></div>
      <p className="-mt-1 mb-4 text-xs text-ink-faint">{desc}</p>
      {children}
      {footer && <div className="mt-5 flex flex-wrap items-center justify-end gap-3">{footer}</div>}
    </section>
  );
}

/** A switch row in a bordered tile: title, one-line help, the switch. */
function Tile({ title, help, helpKey, checked, onChange, className }: { title: string; help: string; helpKey?: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3", className)}>
      <div className="min-w-0"><div className="text-sm font-semibold text-ink">{helpKey ? <HelpLabel help={helpKey}>{title}</HelpLabel> : title}</div><div className="mt-0.5 text-xs text-ink-faint">{help}</div></div>
      <Switch label={title} checked={checked} onChange={onChange} />
    </div>
  );
}

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const bad = (n: number | null) => n !== null && (!Number.isInteger(n) || n < 1);

export function SubmissionStatus({ policy, deadline, received, nextNo }: { policy: SubmissionPolicy; deadline: string; received: number; nextNo: number }) {
  const open = policy.accepting;
  const closes = deadline ? new Date(`${deadline}T23:59:59`).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  return (
    <div id="ss-status" role="status" className={cn("scroll-mt-24 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5 text-sm", open ? "border-[#BBF7D0] bg-success-soft" : "border-line bg-muted")}>
      <span className={cn("h-2 w-2 rounded-full", open ? "bg-success" : "bg-ink-faint")} aria-hidden="true" />
      <b className={open ? "text-success" : "text-ink-muted"}>{open ? "Submissions open" : "Submissions paused"}</b>
      <span className="text-ink-soft">{open ? (closes ? `Closes automatically on ${closes}` : "No deadline set yet") : "Authors can't submit until you switch it back on"}</span>
      <span className="ml-auto text-xs text-ink-muted">{received} received · Next ID: #{nextNo}</span>
    </div>
  );
}

export function PeriodCard({ initial, busy, onSave, slug }: { initial: SubmissionPolicy; busy: boolean; onSave: (p: SubmissionPolicy) => void; slug: string }) {
  const [p, setP] = useState(initial);
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);
  return (
    <PolicyCard id="ss-period" icon={Send} title="Submission Period" desc="Control when authors can submit — manually, or on a schedule."
      footer={<Button disabled={!dirty || busy} onClick={() => onSave(p)}>{busy ? "Saving…" : "Save period"}</Button>}>
      <div className="space-y-3">
        <Tile title="Accept New Submissions" help="Master switch for the submission portal. When off, submissions close immediately, regardless of the schedule below." checked={p.accepting} onChange={(v) => setP({ ...p, accepting: v })} />
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="flex items-center gap-2 text-[13.5px] font-bold text-navy"><Clock size={14} className="text-primary" aria-hidden="true" /> Scheduled Opening <span className="text-xs font-medium text-ink-faint">(Optional)</span></div>
          <label htmlFor="ss-opens" className={cn(LABEL, "mt-3")}>Submission Opens On</label>
          <input id="ss-opens" type="datetime-local" disabled={!p.accepting} value={p.opensAt} onChange={(e) => setP({ ...p, opensAt: e.target.value })} className={INPUT_CLASS} />
          <p className="mt-1.5 text-xs text-ink-faint">{p.accepting ? "Leave blank to open straight away. " : "Switch on “Accept New Submissions” to use a schedule. "}Submissions close at the end of the deadline set in <Link href={`/chair/${slug}/settings`} className="font-semibold text-primary hover:underline">Conference Details</Link>.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Tile title="Allow Submission Updates" help="Authors may revise their submission until the submission deadline." checked={p.allowUpdates} onChange={(v) => setP({ ...p, allowUpdates: v })} />
          <Tile title="Allow Multiple Submissions per Author" help="When off, each author may submit only one paper." checked={p.allowMultiple} onChange={(v) => setP({ ...p, allowMultiple: v })} />
          <Tile title="Allow Edits After Acceptance" help="Authors may modify accepted submissions, e.g. to correct metadata." checked={p.editAfterAccept} onChange={(v) => setP({ ...p, editAfterAccept: v })} />
        </div>
      </div>
    </PolicyCard>
  );
}

export function NumberingCard({ initial, prefix, received, nextNo, busy, onSave }: { initial: SubmissionPolicy; prefix: string; received: number; nextNo: number; busy: boolean; onSave: (p: SubmissionPolicy) => void }) {
  const [p, setP] = useState(initial);
  const [t, setT] = useState({ start: initial.startNumber === null ? "" : String(initial.startNumber), max: initial.maxSubmissions === null ? "" : String(initial.maxSubmissions), per: initial.maxPerAuthor === null ? "" : String(initial.maxPerAuthor) });
  const next = { ...p, startNumber: num(t.start), maxSubmissions: num(t.max), maxPerAuthor: num(t.per) };
  const invalid = bad(next.startNumber) || bad(next.maxSubmissions) || bad(next.maxPerAuthor);
  const dirty = JSON.stringify(next) !== JSON.stringify(initial);
  return (
    <PolicyCard id="ss-numbering" icon={Hash} title="Submission Numbering & Limits" desc="Define how submissions are identified and set capacity limits."
      footer={<Button disabled={!dirty || invalid || busy} onClick={() => onSave(next)}>{busy ? "Saving…" : "Save numbering & limits"}</Button>}>
      <div className="rounded-xl border border-line p-4">
        <div className="text-[13.5px] font-bold text-navy">Submission Identifier Format</div>
        <p className="mb-3 text-xs text-ink-faint">How each submission is referenced across chair, reviewer and author views.</p>
        <div role="group" aria-label="Identifier format" className="flex flex-wrap gap-2">
          {([["numeric", `Numeric (#${nextNo})`], ["prefixed", `Prefixed ID (${prefix}-${nextNo})`]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={p.idFormat === k} onClick={() => setP({ ...p, idFormat: k })} className={cn("rounded-full border px-3.5 py-1.5 text-xs font-bold", p.idFormat === k ? "border-navy bg-navy text-white" : "border-line bg-white text-ink-soft hover:bg-canvas")}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><label htmlFor="ss-start" className={LABEL}>Starting Submission Number</label><input id="ss-start" type="number" min={1} value={t.start} placeholder={String(nextNo)} onChange={(e) => setT({ ...t, start: e.target.value })} className={INPUT_CLASS} /><p className="mt-1 text-xs text-ink-faint">The next submission will be assigned #{nextNo}.</p></div>
        <div><label htmlFor="ss-max" className={LABEL}>Maximum Number of Submissions</label><input id="ss-max" type="number" min={1} value={t.max} placeholder="No limit" onChange={(e) => setT({ ...t, max: e.target.value })} className={INPUT_CLASS} /><p className="mt-1 text-xs text-ink-faint">{received} received to date. Leave blank for no limit.</p></div>
        <div><label htmlFor="ss-per" className={LABEL}>Maximum Submissions per Author</label><input id="ss-per" type="number" min={1} value={t.per} placeholder="No limit" onChange={(e) => setT({ ...t, per: e.target.value })} className={INPUT_CLASS} /><p className="mt-1 text-xs text-ink-faint">Leave blank for no limit.</p></div>
      </div>
      {invalid && <p role="alert" className="mt-3 text-xs font-semibold text-danger">Use whole numbers of 1 or more, or leave a box empty.</p>}
    </PolicyCard>
  );
}

export function GuidelinesCard({ initial, busy, onSave }: { initial: string; busy: boolean; onSave: (text: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <PolicyCard id="ss-guidelines" icon={FileText} title="Submission Guidelines" desc="Displayed at the top of the submission form for all authors."
      footer={<Button disabled={text === initial || busy} onClick={() => onSave(text)}>{busy ? "Saving…" : "Save Guidelines"}</Button>}>
      <label htmlFor="ss-guide" className="sr-only">Submission guidelines</label>
      <textarea id="ss-guide" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Papers must be original, in English, up to 10 pages, as a single PDF. Remove author names for double-blind review." className={INPUT_CLASS} />
      <p className="mt-1.5 text-xs text-ink-faint">Plain text; blank lines start a new paragraph. Authors read it at the top of the New Submission form.</p>
    </PolicyCard>
  );
}

export function VisibilityCard({ initial, mode, fields, onChange }: { initial: ReviewPolicy; mode: ReviewMode; fields: ReviewField[]; onChange: (policy: ReviewPolicy, mode: ReviewMode) => void }) {
  const [p, setP] = useState(initial);
  const [m, setM] = useState<ReviewMode>(mode);
  const [openList, setOpenList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // A click outside closes the list (the prototype's dropdown).
  useEffect(() => {
    if (!openList) return undefined;
    const down = (e: MouseEvent) => { if (listRef.current && !listRef.current.contains(e.target as Node)) setOpenList(false); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [openList]);
  // Like the prototype there is no Save button: each switch / checkbox is saved as soon as it changes.
  const put = (np: ReviewPolicy, nm: ReviewMode = m) => { setP(np); setM(nm); onChange(np, nm); };
  const shown = fields.filter((f) => !p.hiddenFields.includes(f.id)).length;
  const toggle = (id: string) => put({ ...p, hiddenFields: p.hiddenFields.includes(id) ? p.hiddenFields.filter((x) => x !== id) : [...p.hiddenFields, id] });
  return (
    <PolicyCard id="rs-visibility" icon={Eye} title="Review & Visibility" desc="Control what reviewers can access and what authors are asked to provide.">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Tile helpKey="doubleBlind" title="Double-blind review" help="Reviewers never see author names, emails or affiliations — in their queue, on the paper, or in search." checked={m === "double_blind"} onChange={(v) => put(p, v ? "double_blind" : "single_blind")} />
        <Tile helpKey="nonChairsSeeUnassigned" title="Reviewer Access to Unassigned Submissions" help="Reviewers can view submissions that are not assigned to them." checked={p.unassignedAccess} onChange={(v) => put({ ...p, unassignedAccess: v })} />
        <Tile helpKey="preSubmissionAbstracts" title="Allow Abstract Pre-Submission" help="Authors may submit an abstract ahead of the full paper." checked={p.abstractFirst} onChange={(v) => put({ ...p, abstractFirst: v })} />
        <Tile helpKey="authorsSelectPresenter" title="Require Presenter Selection" help="Authors must nominate the presenting author for each submission." checked={p.presenterRequired} onChange={(v) => put({ ...p, presenterRequired: v })} />
        <Tile helpKey="shareResultsToAuthors" title="Share Results to Authors" help="Authors see the reviewer feedback you share once a decision is recorded." checked={p.shareResults} onChange={(v) => put({ ...p, shareResults: v })} />
      </div>
      <div className="mt-4 border-t border-muted pt-4">
        <div className="mb-1.5 block text-sm font-semibold text-ink"><HelpLabel help="fieldsVisibleToReviewers">Fields visible to reviewers</HelpLabel></div>
        <div ref={listRef} className="relative max-w-md">
          <button type="button" aria-expanded={openList} onClick={() => setOpenList(!openList)} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none">{shown} selected<ChevronDown size={15} aria-hidden="true" className="text-ink-faint" /></button>
          {openList && (
            <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto overflow-hidden rounded-lg border border-line bg-white shadow-lg">
              {fields.map((f) => <label key={f.id} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-ink hover:bg-canvas"><input type="checkbox" checked={!p.hiddenFields.includes(f.id)} onChange={() => toggle(f.id)} className="cursor-pointer accent-[var(--primary)]" /><span className="flex-1">{f.label}</span></label>)}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-faint">Unchecked fields stay on the review form for the chair but are hidden from reviewers.</p>
      </div>
    </PolicyCard>
  );
}

export interface EmailItem { name: string; kind: "Automatic" | "Scheduled reminder" | "Chair action"; count: number; to: string; also?: string; when: string; /** The email template this is (Email Templates), when it has one. */ key?: string; /** Who it goes to: a reviewer's email shows the signed-in person as the sample recipient, as in the prototype. */ role?: "reviewer" | "chair" | "author" | "registration" }

const ROLE_TONE = { reviewer: { color: "var(--success)", bg: "var(--success-soft)" }, chair: { color: "var(--secondary)", bg: "var(--secondary-soft)" }, author: { color: "var(--primary)", bg: "var(--primary-soft)" }, registration: { color: "var(--warning)", bg: "var(--warning-soft)" } } as const;
const KIND_TONE = { Automatic: "bg-success-soft text-success", "Chair action": "bg-primary-soft text-primary", "Scheduled reminder": "bg-warning-soft text-warning" } as const;

/** One email of a panel: what it is, who gets it and when, "Edit template" (opens it in Email Templates, Back leads here again) and "See how email looks"
 *  (the email, with sample values, right under the row). */
function EmailRow({ rowId, e, slug, conferenceName, acronym, backLabel, backHref, templates, recipient, onNeedTemplates, href }: { rowId?: string; e: EmailItem; slug: string; conferenceName: string; acronym: string; backLabel: string; backHref?: string; templates: EmailTemplates | null; recipient: string; onNeedTemplates: () => void; href: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const tone = ROLE_TONE[e.role ?? "chair"];
  const t = e.key && templates ? (templates.mine[e.key] ?? templates.platform.find((x) => x.key === e.key) ?? null) : null;
  const plat = e.key && templates ? templates.platform.find((x) => x.key === e.key) : undefined;
  const to = e.role === "reviewer" && recipient ? recipient : e.to;
  const edit = e.key ? `/chair/${encodeURIComponent(slug)}/settings/email-templates?template=${encodeURIComponent(e.key)}&back=${encodeURIComponent(backHref ?? path)}&backLabel=${encodeURIComponent(backLabel)}` : href;
  const toggle = () => { if (!open) onNeedTemplates(); setOpen(!open); };
  return (
    <li id={rowId} style={{ border: "1px solid var(--primary-soft-border)", scrollMarginTop: 96 }} className="rounded-lg bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ background: tone.bg, color: tone.color }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"><Mail size={11} aria-hidden="true" /></span>
            <span className="text-xs font-bold text-navy">{e.name}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", KIND_TONE[e.kind])}>{e.kind}</span>
            <span className="text-[10.5px] font-semibold text-ink-faint">{e.count} email{e.count === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-1 space-y-0.5 text-[11px] text-ink-soft">
            <div className="truncate"><span className="font-semibold text-ink-muted">To:</span> {to}</div>
            {e.also && <div className="truncate"><span className="font-semibold text-ink-muted">Also to:</span> {e.also}</div>}
            <div className="truncate"><span className="font-semibold text-ink-muted">When:</span> {e.when}</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href={edit} title="Change this email's subject and message in Email Templates" className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-navy transition-colors hover:border-primary hover:text-primary"><Pencil size={12} aria-hidden="true" /> Edit template</Link>
          {e.key
            ? <button type="button" onClick={toggle} aria-expanded={open} style={{ border: "1px solid var(--primary-soft-border)", background: open ? "var(--primary)" : "#FFFFFF", color: open ? "#FFFFFF" : "var(--primary)" }} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold hover:opacity-90">{open ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />} {open ? "Hide email" : "See how email looks"}</button>
            : <Link href={href} className="flex items-center gap-1.5 rounded-lg border border-[var(--primary-soft-border)] bg-white px-2.5 py-1.5 text-[11px] font-bold text-primary hover:opacity-90"><Eye size={12} aria-hidden="true" /> See how email looks</Link>}
        </div>
      </div>
      {open && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
          {!templates ? <p className="px-4 py-6 text-center text-xs text-ink-faint">Loading the email…</p> : !t ? <p className="px-4 py-6 text-center text-xs text-ink-faint">This email&apos;s text isn&apos;t available here yet.</p> : (
            <>
              <div className="space-y-1 border-b border-line bg-canvas px-4 py-3 text-xs">
                <div className="flex gap-2"><span className="w-16 shrink-0 font-bold text-ink-faint">From:</span><span className="min-w-0 break-words font-medium text-navy">{plat?.module === "account" ? "Smartconferu <no-reply@smartconferu.com>" : `${acronym || "Smartconferu"} Secretariat <notifications@smartconferu.com>`}</span></div>
                <div className="flex gap-2"><span className="w-16 shrink-0 font-bold text-ink-faint">To:</span><span className="min-w-0 break-words font-medium text-navy">{to}</span></div>
                {e.also && <div className="flex gap-2"><span className="w-16 shrink-0 font-bold text-ink-faint">Also to:</span><span className="min-w-0 break-words font-medium text-navy">{e.also}</span></div>}
                <div className="flex gap-2 border-t border-line pt-1.5"><span className="w-16 shrink-0 font-bold text-ink-faint">Subject:</span><span className="font-bold text-primary">{emailSubject(t.subject, conferenceName, acronym)}</span></div>
              </div>
              <iframe title={`${e.name} preview`} sandbox="" srcDoc={emailPreviewDoc(t.subject, t.body, conferenceName, acronym, { title: e.name, soft: true })} className="block h-72 w-full bg-canvas" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-muted px-4 py-2 text-[11px] font-medium text-ink-muted"><span className="flex items-center gap-1.5"><Send size={12} aria-hidden="true" className="text-primary" /> {EMAIL_SEND_DESC[plat?.sendType ?? ""] ?? e.when}</span><span className="text-[10.5px] italic text-ink-faint">Edit in Settings › Email Templates</span></div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** The prototype's "…emails" panels: what the system sends around this part of the conference, to whom and when; the wording is edited under Email Templates. */
export function EmailsPanel({ id, title, desc, items, href, slug, conferenceName, acronym, backLabel, backHref }: { id?: string; title: string; desc: string; items: EmailItem[]; href: string; slug: string; conferenceName: string; acronym: string; backLabel: string; /** Where Back leads from Email Templates (default: this page). */ backHref?: string }) {
  const profile = useOptionalProfile();
  const me = profile?.state.status === "ready" ? profile.state.profile : null;
  const recipient = me ? `${[me.firstName, me.lastName].filter(Boolean).join(" ")} <${me.mainEmail}>` : "";
  const [templates, setTemplates] = useState<EmailTemplates | null>(null);
  const loading = useRef(false);
  // The templates are read the first time an email is opened, not with the page.
  const need = () => { if (templates || loading.current) return; loading.current = true; getChairService().then((s) => s.loadEmailTemplates(slug)).then(setTemplates).catch(() => { loading.current = false; }); };
  return (
    <section id={id} data-tour={id?.replace(/^rs-/, "rv-")} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-5">
      <div className="mb-3.5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><Clock size={16} aria-hidden="true" /></span>
        <div><h3 className="text-sm font-bold text-navy">{title}</h3><p className="mt-0.5 text-xs text-ink-faint">{desc}</p></div>
      </div>
      <ul className="space-y-2">
        {items.map((e) => <EmailRow key={e.name} rowId={id && e.key ? `${id}-${e.key}` : undefined} e={e} slug={slug} conferenceName={conferenceName} acronym={acronym} backLabel={backLabel} backHref={backHref} templates={templates} recipient={recipient} onNeedTemplates={need} href={href} />)}
      </ul>
    </section>
  );
}

export const SUBMISSION_EMAILS: EmailItem[] = [
  { key: "submissionsOpen", role: "chair", name: "Submissions open today", kind: "Automatic", count: 2, to: "Conference Chair", also: "Track Chairs", when: "Scheduled opening date reached" },
  { key: "draftReminder", role: "author", name: "Your paper is not submitted yet", kind: "Scheduled reminder", count: 1, to: "Author (submitting)", when: "Paper upload pending, deadline in 7 days and 1 day" },
  { key: "deadlineApproaching", role: "author", name: "Submission deadline approaching", kind: "Scheduled reminder", count: 1, to: "Author (submitting)", when: "Deadline in 7 days (optional 1 day)" },
  { key: "submissionsClosedSummary", role: "chair", name: "Submissions closed: summary", kind: "Automatic", count: 2, to: "Conference Chair", also: "Track Chairs", when: "Deadline passes" },
  { key: "similarityFlag", role: "chair", name: "Possible duplicate or similarity flag", kind: "Automatic", count: 2, to: "Conference Chair", also: "Track Chair", when: "System flags a paper" },
];
export const DECISION_EMAILS: EmailItem[] = [
  { key: "acceptance", role: "author", name: "Paper accepted", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases an Accept decision" },
  { key: "minorRevision", role: "author", name: "Minor revision required", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Minor revision decision" },
  { key: "majorRevision", role: "author", name: "Major revision required", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Major revision decision" },
  { key: "waitlisted", role: "author", name: "Paper waitlisted", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Waitlist decision" },
  { key: "rejection", role: "author", name: "Paper not accepted", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair releases a Reject decision" },
  { key: "registrationConfirmed", role: "registration", name: "Registration confirmed", kind: "Automatic", count: 1, to: "Registrant", when: "Attendee completes registration" },
  { key: "decisionChanged", role: "author", name: "Decision changed", kind: "Chair action", count: 2, to: "Author (submitting)", also: "Co-authors", when: "Chair overrides a released decision" },
  { key: "finalDecisionReviewers", role: "reviewer", name: "Final decision (for reviewers)", kind: "Automatic", count: 1, to: "Reviewer", when: "Decision released" },
  { key: "cameraReadyReminder", role: "author", name: "Camera-ready reminder", kind: "Scheduled reminder", count: 1, to: "Author (submitting)", when: "Ahead of the camera-ready deadline" },
];
export const RECRUITMENT_EMAILS: EmailItem[] = [
  { key: "reviewerActivateReminder", role: "reviewer", name: "Activate your reviewer account", kind: "Scheduled reminder", count: 1, to: "The invited reviewer", when: "Account not activated 3 and 7 days after being added" },
  { key: "reviewersInactiveChair", role: "chair", name: "Reviewers not yet active", kind: "Scheduled reminder", count: 1, to: "Conference Chair", when: "Daily while any added reviewer has not activated" },
  { key: "reviewerProfileReminder", role: "reviewer", name: "Complete your reviewer profile", kind: "Scheduled reminder", count: 1, to: "The reviewer", when: "Profile missing expertise or institution, 5 days after joining" },
];
export const REVIEW_EMAILS: EmailItem[] = [
  { key: "reviewDueSoon", role: "reviewer", name: "Review reminder 1 — days left", kind: "Scheduled reminder", count: 1, to: "The reviewer", when: "A set number of days before a reviewer's deadline (Peer Review › Review timeline)" },
  { key: "reviewLastDay", role: "reviewer", name: "Review reminder 2 — last day", kind: "Scheduled reminder", count: 1, to: "The reviewer", when: "The last day of a reviewer's deadline (Peer Review › Review timeline)" },
  { key: "reviewOverdue", role: "reviewer", name: "Review overdue", kind: "Scheduled reminder", count: 2, to: "The reviewer", also: "Track Chair on the last one", when: "Deadline passed: first day and last day of the grace period" },
  { key: "overdueDigestChair", role: "chair", name: "Overdue reviews: daily list", kind: "Scheduled reminder", count: 2, to: "Conference Chair", also: "Track Chair (own track)", when: "Every day during the grace period" },
  { key: "reviewFormLocked", role: "reviewer", name: "Grace period over: review form locked", kind: "Automatic", count: 1, to: "The reviewer", when: "Grace period ends without a review" },
  { key: "missedReviewsChair", role: "chair", name: "Papers need action: missed reviews", kind: "Automatic", count: 2, to: "Conference Chair", also: "Track Chair (own track)", when: "Grace period ends with reviews missing" },
  { key: "reviewProgressDigest", role: "chair", name: "Review progress digest", kind: "Scheduled reminder", count: 2, to: "Conference Chair", also: "Track Chairs", when: "Daily or weekly during review period" },
  { key: "chairDecisionReady", role: "chair", name: "Paper ready for decision", kind: "Automatic", count: 2, to: "Conference Chair", also: "Track Chair", when: "Last required review arrives" },
];
