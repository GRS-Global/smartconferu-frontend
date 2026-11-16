"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Mail, Send } from "lucide-react";
import { useState } from "react";
import { resolveEmail, ROLE_TONE, SEND_TYPES, SEND_TYPE_TONE, type NoteEmail, type ResolvedEmail } from "@/lib/email-note";
import { SAMPLE_UI } from "@/lib/sample-mode";
import { cn } from "@/lib/cn";

const peopleSummary = (list: string[], max = 2) => (list.length <= max ? list.join(", ") : `${list.slice(0, max).join(", ")} +${list.length - max} more`);

function EmailPreviewCard({ email }: { email: ResolvedEmail }) {
  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-line bg-white">
      <div className="space-y-1.5 border-b border-line bg-canvas px-4 py-3 text-xs">
        {([["From", email.sender], ["To", email.to.join(", ")]] as const).map(([k, v]) => (
          <div key={k} className="flex gap-2"><span className="w-16 shrink-0 font-bold text-ink-faint">{k}:</span><span className="min-w-0 break-words font-medium text-navy">{v}</span></div>
        ))}
        <div className="flex gap-2 border-t border-line pt-1.5"><span className="w-16 shrink-0 font-bold text-ink-faint">Subject:</span><span className="font-bold text-primary">{email.subject}</span></div>
      </div>
      {/* The bodies are the fixed catalogue wording (lib/email-note.ts) plus form values escaped by the caller. */}
      <div className="max-h-64 space-y-2 overflow-y-auto p-4 text-xs leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: email.body }} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-muted px-4 py-2 text-[11px] font-medium text-ink-muted">
        <span className="flex items-center gap-1.5"><Send size={12} aria-hidden="true" className="text-primary" /> {SEND_TYPES[email.sendType].desc}</span>
        <span className="text-[10.5px] italic text-ink-faint">Edit in Settings › Email Templates</span>
      </div>
    </div>
  );
}

function EmailNoteRow({ email }: { email: ResolvedEmail }) {
  const [open, setOpen] = useState(false);
  const tone = SEND_TYPE_TONE[email.sendType], roleTone = ROLE_TONE[email.role];
  return (
    <div className="rounded-lg border border-primary-soft-border bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ background: roleTone.bg, color: roleTone.color }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"><Mail size={11} aria-hidden="true" /></span>
            <span className="text-xs font-bold text-navy">{email.label}</span>
            <span style={{ background: tone.bg, color: tone.color }} className="rounded-full px-1.5 py-0.5 text-[10px] font-bold">{SEND_TYPES[email.sendType].label}</span>
            <span className="text-[10.5px] font-semibold text-ink-faint">{email.count} email{email.count === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-1 space-y-0.5 text-[11px] text-ink-soft">
            <div className="truncate"><span className="font-semibold text-ink-muted">To:</span> {peopleSummary(email.to)}</div>
            {email.when && <div className="truncate"><span className="font-semibold text-ink-muted">When:</span> {email.when}</div>}
          </div>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn("flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-primary-soft-border px-2.5 py-1.5 text-[11px] font-bold hover:opacity-90", open ? "bg-primary text-white" : "bg-white text-primary")}>
          {open ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
          {open ? "Hide email" : "See how email looks"}
        </button>
      </div>
      {open && <EmailPreviewCard email={email} />}
    </div>
  );
}

function CompactRow({ email }: { email: ResolvedEmail }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-2.5 text-xs" style={{ background: "rgba(59, 130, 246, 0.05)", borderColor: "rgba(59, 130, 246, 0.2)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Mail size={13} aria-hidden="true" className="shrink-0 text-primary" />
          <span className="shrink-0 font-bold text-navy">Email:</span>
          <span className="truncate font-semibold text-primary">{email.label}</span>
          <span className="shrink-0 text-[10.5px] text-ink-faint">· {email.count} email{email.count === 1 ? "" : "s"}</span>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline">
          {open ? "Hide preview" : "View preview"}
          {open ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
        </button>
      </div>
      {open && <EmailPreviewCard email={email} />}
    </div>
  );
}

interface TriggeredEmailNoteProps {
  emails: NoteEmail[];
  conference?: { name: string; acronym: string };
  /** One row per email without the summary link / panel (the "After the Super Admin decides" rows). */
  compact?: boolean;
  className?: string;
  title?: string;
}

/** The prototype's TriggeredEmailNote: "This action sends N emails · View emails", opening a panel that lists each email (who gets
 *  it, when) with a preview. In the prototype this is an aid for the clickable demo and is hidden on the real database, so here it
 *  renders only in sample / mock mode; otherwise it leaves an empty spacer of the same size class, as the prototype does. */
export function TriggeredEmailNote({ emails, conference, compact = false, className = "", title = "Triggered Email Note" }: TriggeredEmailNoteProps) {
  const [expanded, setExpanded] = useState(false);
  if (!SAMPLE_UI) return <div aria-hidden="true" className={compact ? `mt-2 ${className}` : className || "my-3"} />;
  const items = emails.map((e, i) => resolveEmail(e, conference, i));
  const total = items.reduce((n, e) => n + e.count, 0);
  const summary = `This action sends ${total} email${total === 1 ? "" : "s"}`;

  if (compact) return <div className={`mt-2 space-y-1.5 ${className}`}>{items.map((e) => <CompactRow key={e.id} email={e} />)}</div>;

  if (!expanded) {
    return (
      <div className={className || "my-3"}>
        <button type="button" onClick={() => setExpanded(true)} aria-expanded={false} className="inline-flex cursor-pointer items-center gap-1.5 rounded text-[12px] font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Mail size={13} aria-hidden="true" className="shrink-0" />
          <span>{summary}</span>
          <span className="text-ink-faint">·</span>
          <span className="font-bold">View emails</span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-3.5 ${className || "my-3"}`} style={{ background: "linear-gradient(135deg, rgba(239, 246, 255, 0.85) 0%, rgba(243, 244, 246, 0.75) 100%)", borderColor: "rgba(59, 130, 246, 0.25)" }}>
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white"><Mail size={14} aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wide text-navy">{title}</div>
          <div className="text-[11px] text-ink-soft">{`${summary}${items.length > 1 ? ` using ${items.length} templates` : ""}.`}</div>
        </div>
        <button type="button" onClick={() => setExpanded(false)} aria-expanded={true} className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline">
          Hide <ChevronUp size={12} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-2">{items.map((e) => <EmailNoteRow key={e.id} email={e} />)}</div>
    </div>
  );
}
