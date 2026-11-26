"use client";

import { Eye, EyeOff, Mail, Send } from "lucide-react";
import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import { frameEmailHtml } from "@/lib/email-frame";
import { sendEmailEvent } from "@/services/action-emails";
import type { ChairPaper } from "@/types/chair";
import { authorPaperHref } from "@/lib/routes";

/* Chair › a paper's page › "Email authors" (the prototype's EmailAuthorsModal): write to the authors of this one paper. The greeting ("Hi <first name>,") is
   fixed around what the chair writes and the sign-off comes from the email's frame, so nothing important is deleted by accident and no {{tokens}} are on
   screen; each person gets their own copy greeted by name. Quick starts fill the message, the chips put the paper's title / ID / link where the cursor is,
   and Preview shows the email as the first person will read it. It goes through the email server (event `paper_message`; Email Logs lists it). */

const STARTS = [
  { label: "Request a revision", subject: "Revision needed", body: "Thank you for submitting “{{paper_title}}” ({{submission_id}}). After a first look, we need a few changes before it can move forward:\n\n• \n• \n\nYou can update the paper from your submission page. Please send the revised version by the date below.\n\nDeadline: " },
  { label: "Ask for missing details", subject: "Information needed", body: "We're missing a few details for “{{paper_title}}” ({{submission_id}}). Could you please send us:\n\n• \n\nYou can update the paper from your submission page." },
  { label: "General update", subject: "An update on your paper", body: "A quick update on “{{paper_title}}” ({{submission_id}}):\n\n" },
];
const INSERTS = [["Paper title", "{{paper_title}}"], ["Paper ID", "{{submission_id}}"], ["Paper link", "{{submission_link}}"]] as const;

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
const firstName = (name: string) => name.replace(/^(Dr\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "").trim().split(/\s+/)[0] || "there";
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** Plain text as email HTML: blank lines split paragraphs and "• " lines become a list. */
function textToHtml(text: string): string {
  return text.split(/\n{2,}/).filter((p) => p.trim()).map((para) => {
    const lines = para.split("\n");
    if (lines.every((l) => /^\s*[•-]\s?/.test(l))) return `<ul style="margin:0 0 14px;padding-left:20px;">${lines.map((l) => `<li>${esc(l.replace(/^\s*[•-]\s?/, ""))}</li>`).join("")}</ul>`;
    return `<p style="margin:0 0 14px;">${lines.map(esc).join("<br>")}</p>`;
  }).join("");
}

export function EmailAuthorsDialog({ open, paper, conferenceName, acronym, conferenceSlug, onClose, onSent }: { open: boolean; paper: ChairPaper; conferenceName: string; acronym: string; /** For the paper link the authors get. */ conferenceSlug: string; onClose: () => void; onSent: (count: number, notice: string | null) => void }) {
  const authors = paper.authors.filter((a) => a.email.trim());
  const [picked, setPicked] = useState<string[]>(() => { const c = authors.filter((a) => a.corresponding).map((a) => a.email); return c.length ? c : authors.slice(0, 1).map((a) => a.email); });
  const [subject, setSubject] = useState(`${paper.id}: `);
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const toggle = (e: string) => setPicked((l) => (l.includes(e) ? l.filter((x) => x !== e) : [...l, e]));
  const all = authors.length > 0 && picked.length === authors.length;
  // What is sent: the greeting and the chair's message; empty bullets are dropped.
  const clean = body.split("\n").filter((l) => !/^\s*[•-]\s*$/.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const html = textToHtml(`Hi {{first_name}},\n\n${clean}`).replaceAll("{{submission_link}}", '<a href="{{submission_link}}" style="color:#4F46E5;">{{submission_link}}</a>');
  const first = authors.find((a) => picked.includes(a.email)) ?? authors[0];
  const link = typeof window === "undefined" ? "" : `${window.location.origin}${authorPaperHref(conferenceSlug, paper.id)}`;
  const previewDoc = () => {
    const filled = html.replaceAll("{{first_name}}", esc(first ? firstName(first.name) : "there")).replaceAll("{{paper_title}}", esc(paper.title)).replaceAll("{{submission_id}}", esc(paper.id)).replaceAll("{{submission_link}}", esc(link));
    const framed = frameEmailHtml(filled, { conferenceName, conferenceAcronym: acronym, title: subject.replace(`${paper.id}:`, "").trim() });
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'"><base target="_blank"><style>body{margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif}</style></head><body>${framed}</body></html>`;
  };
  const canSend = picked.length > 0 && subject.trim() !== "" && body.trim() !== "" && !sending;
  const why = !picked.length ? "Choose who to email" : !subject.trim() ? "Add a subject" : !body.trim() ? "Write your message" : "";
  const insert = (token: string) => {
    const el = area.current;
    if (!el) { setBody((b) => b + token); return; }
    const s = el.selectionStart ?? body.length; const e = el.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + token + body.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
  };
  const start = (t: (typeof STARTS)[number]) => {
    if (body.trim() && !window.confirm("This replaces what you've written. Continue?")) return;
    setSubject(`${paper.id}: ${t.subject}`); setBody(t.body); setPreview(false);
    requestAnimationFrame(() => area.current?.focus());
  };
  const send = async () => {
    setError(""); setSending(true);
    try {
      const res = await sendEmailEvent("paper_message", { submissionId: paper.dbId, to: picked, subject: subject.trim(), body: html });
      if (res.error || res.failed) { setError(res.error ?? `${res.failed} email${res.failed === 1 ? "" : "s"} couldn't be sent.`); setSending(false); return; }
      setSending(false);
      onSent(picked.length, null);
    } catch (e) { setError(e instanceof Error ? e.message : "The email couldn't be sent."); setSending(false); }
  };

  return (
    <Dialog open={open} onClose={() => { if (!sending) onClose(); }} title="Email authors" description={`${paper.id} · ${paper.title}`} icon={Mail} size="xl">
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-bold text-navy">To</span>{authors.length > 1 && <button type="button" onClick={() => setPicked(all ? [] : authors.map((a) => a.email))} className="cursor-pointer text-xs font-bold text-primary hover:underline">{all ? "Clear all" : "Select all"}</button>}</div>
          {authors.length === 0 && <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-ink-faint">This paper has no author with an email address.</p>}
          <div className="flex flex-wrap gap-2">
            {authors.map((a) => { const on = picked.includes(a.email); return (
              <button key={a.email} type="button" aria-pressed={on} onClick={() => toggle(a.email)} style={on ? { background: "var(--primary-soft)", borderColor: "var(--primary)" } : undefined} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left ${on ? "" : "border-line bg-white hover:bg-canvas"}`}>
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">{initials(a.name)}</span>
                <span className="min-w-0"><span className="block text-xs font-bold text-navy">{a.name}{a.corresponding && <span className="ml-1.5 text-[10px] font-semibold text-primary">Corresponding</span>}</span><span className="block text-[11px] text-ink-faint">{a.email}</span></span>
              </button>
            ); })}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-bold text-navy">Quick start</div>
          <div className="flex flex-wrap gap-2">{STARTS.map((t) => <button key={t.label} type="button" onClick={() => start(t)} className="cursor-pointer rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-canvas">{t.label}</button>)}</div>
        </div>
        <div>
          <label htmlFor="ea-subject" className="mb-1.5 block text-xs font-bold text-navy">Subject</label>
          <input id="ea-subject" value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="ea-body" className="text-xs font-bold text-navy">Message <span className="font-normal text-ink-faint">· greeted by first name, signed off by the email&apos;s frame</span></label>
            <button type="button" onClick={() => setPreview((p) => !p)} aria-pressed={preview} className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-primary hover:underline">{preview ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />} {preview ? "Edit" : "Preview"}</button>
          </div>
          {preview
            ? <iframe title="Email preview" sandbox="" srcDoc={previewDoc()} className="block h-[360px] w-full rounded-xl border border-line bg-canvas" />
            : (
              <>
                <textarea id="ea-body" ref={area} rows={9} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" className={`${INPUT_CLASS} resize-y leading-relaxed`} />
                <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[11px] text-ink-faint">Insert:</span>{INSERTS.map(([l, t]) => <button key={t} type="button" onClick={() => insert(t)} className="cursor-pointer rounded-full border border-[var(--primary-soft-border)] bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-white">{l}</button>)}</div>
              </>
            )}
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 border-t border-muted pt-4">
        <span style={{ color: error ? "var(--danger)" : "var(--ink-muted)" }} className="min-w-0 truncate text-xs font-semibold">{error || (canSend ? `Goes to ${picked.length} author${picked.length === 1 ? "" : "s"} · each gets their own copy` : why)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button type="button" onClick={onClose} disabled={sending} className="h-10 cursor-pointer rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink-soft hover:bg-canvas disabled:opacity-50">Cancel</button>
          <button type="button" disabled={!canSend} onClick={() => void send()} title={why} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"><Send size={14} aria-hidden="true" /> {sending ? "Sending…" : picked.length > 1 ? `Send to ${picked.length} authors` : "Send email"}</button>
        </div>
      </div>
    </Dialog>
  );
}
