"use client";

import { AlertTriangle, Check, ChevronDown, ClipboardCheck, FileText, Mail, Paperclip, Send, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { frameEmailHtml } from "@/lib/email-frame";
import { getChairService } from "@/services/chair";
import type { ChairAuthor, ChairEmailLog } from "@/types/chair";
import { fromIsoDay, toIsoDay, type CheckItem } from "../screening";
import { composeScreeningDraft, EMAIL_KINDS, SCREENING_EMAIL_KEYS, type EmailKind } from "../screening-email";

/* The email the author gets for a screening decision (the prototype's EmailDraftModal): it opens as a ready draft with the paper's ID and title,
   what to fix, the due date and the report, and the chair can edit the subject and the message (or look at it as the author will). The email type
   (Main / Reminder / Last chance) unlocks its later two once the main email has gone; "Also email co-authors" sends each co-author their own copy.
   Above the draft: what the authors of this paper were already sent. The email server sends exactly this subject and message; the greeting's
   first name is filled in for each author. */

export interface ScreeningSendInput { note: string; deadline: string; share: boolean; co: boolean; kind: EmailKind; subject: string; body: string }

export interface ScreeningEmailFormProps {
  stage: "initial" | "plag";
  slug: string;
  paperDbId: string;
  paperId: string;
  n: number;
  title: string;
  acronym: string;
  /** The conference's name (the preview's header). */
  confName: string;
  authors: ChairAuthor[];
  reject: boolean;
  problems: string[];
  /** The Initial Check's findings, shown as "Initial Check Report — included in the email" (Initial Check only). */
  items?: CheckItem[];
  /** A report can be shared with the email (Plagiarism Check, revision). */
  hasReport: boolean;
  reportFiles: string[];
  /** The due date as people read it ("Nov 20, 2026"). */
  defaultDue: string;
  /** The main email of this request has already gone out (so a reminder or a last chance can follow). */
  sent: boolean;
  /** The chair's note saved with the decision, kept as it is. */
  note: string;
  onClose: () => void;
  onSend: (input: ScreeningSendInput) => void;
  busy: boolean;
  error: string;
}

const FIELD = "w-full rounded-lg border-[1.5px] border-line bg-white px-3 text-[13px] outline-none focus:border-primary";
const stamp = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); };
const firstOf = (name: string) => name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "").trim().split(/\s+/)[0] || "Author";
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c] ?? c);
/** Plain text as the email's HTML: a blank line starts a paragraph, a single line break stays one. */
const paragraphs = (text: string) => text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\r?\n/g, "<br>")}</p>`).join("");

function Pills<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: Array<{ key: T; text: ReactLabel }>; onPick: (k: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="mb-2 flex gap-1.5">
      {options.map((o) => <button key={o.key} type="button" role="tab" aria-selected={value === o.key} onClick={() => onPick(o.key)} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-bold ${value === o.key ? "border-navy bg-navy text-white" : "border-line bg-white text-ink-soft"}`}>{o.text}</button>)}
    </div>
  );
}
type ReactLabel = ReactNode;

/** What was already sent to this paper's authors (the prototype's EmailHistory): a count, the last one, and a switch between this step's emails and all of them. */
function History({ logs, label, keys }: { logs: ChairEmailLog[]; label: string; keys: string[] }) {
  const focused = logs.filter((l) => l.templateKey && keys.includes(l.templateKey));
  const [open, setOpen] = useState(logs.length > 0);
  const [tab, setTab] = useState<"focus" | "all">("focus");
  const last = focused[0] ?? logs[0];
  const shown = tab === "focus" ? focused : logs;
  return (
    <div className="rounded-xl border border-line bg-canvas">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2.5 text-left">
        <Mail size={14} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="text-xs font-bold text-navy">Emails already sent to the authors of this paper</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${focused.length ? "bg-primary-soft text-primary" : "bg-muted text-ink-muted"}`}>{focused.length ? `${focused.length} sent` : "none yet"}</span>
        {logs.length > focused.length && <span className="text-[11.5px] text-ink-faint">· {logs.length} in all</span>}
        {last && <span className="truncate text-[11.5px] text-ink-faint">last {stamp(last.createdAt)}</span>}
        <ChevronDown size={15} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none" }} className="ml-auto shrink-0 text-ink-faint transition-transform" />
      </button>
      {open && (
        <div className="px-3.5 pb-3">
          <Pills label="Which emails" value={tab} onPick={setTab} options={[{ key: "focus", text: <>{label} <span className="opacity-70">{focused.length}</span></> }, { key: "all", text: <>All emails <span className="opacity-70">{logs.length}</span></> }]} />
          {shown.length === 0 ? <p className="py-2 text-xs text-ink-faint">{tab === "focus" ? `No ${label.toLowerCase()} email has been sent for this paper yet.` : "No email has been sent yet."}</p> : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
              {shown.map((l) => {
                const ok = l.status !== "failed";
                return (
                  <li key={l.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink"}`}>{ok ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : <X size={11} strokeWidth={3} aria-hidden="true" />}</span>
                    <div className="min-w-0 flex-1"><div className="break-words text-[12.5px] font-semibold leading-snug text-ink">{l.subject}</div><div className="mt-0.5 break-words text-[11.5px] text-ink-muted">To {l.toName || l.toEmail || "—"}{l.template ? ` · ${l.template}` : ""}</div></div>
                    <div className="shrink-0 text-right"><div className="whitespace-nowrap text-[11.5px] font-semibold text-ink-soft">{stamp(l.createdAt)}</div><div className={`text-[11px] font-bold ${ok ? "text-success-ink" : "text-danger-ink"}`}>{ok ? "Sent" : "Failed"}</div></div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function ScreeningEmailForm(p: ScreeningEmailFormProps) {
  const primaries = p.authors.filter((a) => a.corresponding && a.email);
  const to = primaries.length ? primaries : p.authors.filter((a) => a.email).slice(0, 1);
  const coAuthors = p.authors.filter((a) => a.email && !to.includes(a));
  const greet = firstOf(to[0]?.name ?? "");
  const [kind, setKind] = useState<EmailKind>("main");
  const [due, setDue] = useState(toIsoDay(p.defaultDue));
  // The report always goes with a Plagiarism Check email when one was added (attached, and shown on the author's page).
  const share = p.hasReport;
  const [co, setCo] = useState(false);
  const [edited, setEdited] = useState(false);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState<ChairEmailLog[] | null>(null);
  const compose = (k: EmailKind, dueIso: string, shareReport: boolean) => composeScreeningDraft({
    reject: p.reject, kind: k, greet, paperId: p.paperId, n: p.n, title: p.title, acronym: p.acronym, problems: p.problems,
    due: p.reject || !dueIso ? "" : fromIsoDay(dueIso), reportFiles: shareReport ? p.reportFiles : [],
  });
  const first = compose("main", due, p.hasReport);
  const [subject, setSubject] = useState(first.subject);
  const [body, setBody] = useState(first.body);

  // The draft follows the due date and the report until the chair edits the words; after that their words stay.
  const redo = (k: EmailKind, dueIso: string, shareReport: boolean) => { const c = compose(k, dueIso, shareReport); setSubject(c.subject); setBody(c.body); };
  const changeDue = (iso: string) => { setDue(iso); if (!edited) redo(kind, iso, share); };
  const changeKind = (k: EmailKind) => {
    if (k === kind) return;
    if (edited && !window.confirm("Switching the email type rewrites the message and drops your edits. Continue?")) return;
    setKind(k); setEdited(false); redo(k, due, share);
  };

  useEffect(() => {
    let cancelled = false;
    getChairService().then((s) => s.loadEmailLogs(p.slug)).then((l) => { if (!cancelled) setHistory(l.filter((x) => x.submissionId === p.paperDbId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }).catch(() => { if (!cancelled) setHistory([]); });
    return () => { cancelled = true; };
  }, [p.slug, p.paperDbId]);

  const count = to.length + (co && !p.reject ? coAuthors.length : 0);
  const k = p.reject ? "main" : kind;
  const label = p.stage === "initial" ? "Initial check" : "Plagiarism check";
  const previewDoc = () => {
    const framed = frameEmailHtml(paragraphs(body), { conferenceName: p.confName, conferenceAcronym: p.acronym, title: subject.replace(/^\[[^\]]*\]\s*/, ""), logoUrl: typeof window === "undefined" ? "" : new URL("/smartconferu-lockup.png", window.location.origin).href });
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'"><base target="_blank"><style>body{margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif}</style></head><body>${framed}</body></html>`;
  };
  // The greeting names the first author; every author is greeted by their own name.
  const send = () => {
    const mine = `Dear ${greet},`;
    const text = body.startsWith(mine) ? `Dear {{first_name}},${body.slice(mine.length)}` : body;
    p.onSend({ note: p.note, deadline: p.reject ? "" : fromIsoDay(due), share: p.stage === "plag" && p.hasReport, co: co && !p.reject, kind: k, subject: subject.trim(), body: text });
  };
  return (
    <>
      <div className="space-y-3.5">
        {!p.reject && (
          <div>
            <div className="mb-1.5 text-xs font-bold text-ink-soft">Email type</div>
            <div role="radiogroup" aria-label="Email type" className="inline-flex max-w-full gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
              {EMAIL_KINDS.map((o) => {
                const locked = o.key !== "main" && !p.sent;
                const on = kind === o.key;
                return <button key={o.key} type="button" role="radio" aria-checked={on} disabled={locked} onClick={() => changeKind(o.key)} title={locked ? "Send the main email first" : o.hint} className={`h-8 rounded-md px-3.5 text-xs font-semibold ${on ? "bg-primary text-white" : locked ? "cursor-not-allowed text-ink-faint" : "cursor-pointer text-ink-soft hover:brightness-95"}`}>{o.label}</button>;
              })}
            </div>
            <span className="mt-1 block text-[11px] text-ink-faint">{p.sent ? EMAIL_KINDS.find((o) => o.key === kind)?.hint : "Reminder and Last chance unlock after the main email is sent."}</span>
          </div>
        )}
        <div className="space-y-1.5 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-soft">
          {to.length === 0 && <div className="font-semibold text-danger-ink">No author of this paper has an email address on file.</div>}
          {to.map((a) => <div key={a.email}><b>To:</b> {a.name} &lt;{a.email}&gt; <span className="text-ink-faint">· corresponding author{to.length > 1 ? " · gets their own email" : ""}</span></div>)}
          {!p.reject && coAuthors.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={co} onChange={(e) => setCo(e.target.checked)} className="mt-0.5" />
              <span><b className="text-ink">Also email co-authors ({coAuthors.length})</b> <span className="text-ink-faint">— each gets their own copy by name. It only informs them; the corresponding author is the one asked to act.</span></span>
            </label>
          )}
          {co && !p.reject && coAuthors.map((a) => <div key={a.email} className="pl-6"><span className="font-semibold text-ink">{a.name}</span> <span>&lt;{a.email}&gt;</span></div>)}
        </div>

        {history && <History logs={history} label={label} keys={SCREENING_EMAIL_KEYS[p.stage]} />}

        <div className={`grid gap-3 ${p.reject ? "" : "sm:grid-cols-[1fr_200px]"}`}>
          <label className="block"><span className="mb-1 block text-xs font-bold text-ink-soft">Subject</span><input value={subject} onChange={(e) => { setSubject(e.target.value); setEdited(true); }} maxLength={300} className={`${FIELD} h-9`} /></label>
          {!p.reject && <label className="block"><span className="mb-1 block text-xs font-bold text-ink-soft">New Version Due By</span><input type="date" value={due} onChange={(e) => changeDue(e.target.value)} className={`${FIELD} h-9`} /></label>}
        </div>

        {p.stage === "plag" ? (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-soft"><Paperclip size={13} aria-hidden="true" /> Attachments</div>
            {p.reportFiles.length ? (
              <>
                {/* Always sent now: the report goes with every revision / rejection email and is shown on the author's paper page. */}
                <p className="mb-1.5 text-xs text-ink-soft">The report is attached to this email and shown on the author&apos;s paper page.</p>
                <div className="flex flex-wrap gap-2">{p.reportFiles.map((name) => <span key={name} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-primary-soft-border bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary"><FileText size={13} aria-hidden="true" className="shrink-0" /> <span className="truncate">{name}</span></span>)}</div>
              </>
            ) : (
              <p className="inline-flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-ink"><AlertTriangle size={13} aria-hidden="true" /> No plagiarism report is uploaded for V{p.n} — upload it in the table first so the author can see it.</p>
            )}
          </div>
        ) : (p.items?.length ?? 0) > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-soft"><ClipboardCheck size={13} aria-hidden="true" /> Initial Check Report <span className="font-medium text-ink-faint">— included in the email</span></div>
            <ul className="grid divide-y divide-line rounded-lg border border-line sm:grid-cols-2 sm:divide-y-0">
              {p.items!.map((it) => (
                <li key={it.key} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${it.ok ? "bg-success-soft text-success-ink" : "bg-danger-soft text-danger-ink"}`}>{it.ok ? <Check size={10} strokeWidth={3} aria-hidden="true" /> : <X size={10} strokeWidth={3} aria-hidden="true" />}</span>
                  <span className="font-semibold text-ink">{it.label}</span>
                  <span className={`ml-auto text-right ${it.ok ? "text-ink-muted" : "text-danger-ink"}`}>{it.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2"><span className="text-xs font-bold text-ink-soft">Message</span><span className="text-[11px] text-ink-faint">{preview ? "This is how the email looks to the author — the header, title, sign-off and footer are added automatically." : edited ? "Edited by you — changing the due date won't rewrite it." : "A ready draft — change any part of it before sending. The header, sign-off and footer are added automatically."}</span></div>
          <Pills label="Message view" value={preview ? "preview" : "edit"} onPick={(v) => setPreview(v === "preview")} options={[{ key: "edit", text: "Edit" }, { key: "preview", text: "Preview" }]} />
          {preview ? (
            <iframe title="Email preview" sandbox="" srcDoc={previewDoc()} className="block h-[420px] w-full rounded-lg border border-line bg-canvas" />
          ) : (
            <textarea value={body} onChange={(e) => { setBody(e.target.value); setEdited(true); }} rows={13} maxLength={20000} aria-label="Message" className={`${FIELD} resize-y px-4 py-3 leading-relaxed`} />
          )}
        </div>
      </div>
      {p.error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{p.error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={p.onClose} disabled={p.busy}>Cancel</Button>
        <Button disabled={p.busy || to.length === 0 || !subject.trim() || !body.trim() || (!p.reject && !due)} onClick={send}>
          <Send size={14} aria-hidden="true" /> {p.busy ? "Sending…" : count > 1 ? `Send ${count} emails` : k === "main" ? "Send to author" : k === "last" ? "Send last chance" : "Send reminder"}
        </Button>
      </div>
    </>
  );
}
