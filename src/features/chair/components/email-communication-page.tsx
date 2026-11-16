"use client";

import { Bold, BookOpen, Check, ChevronDown, Clock, FileCheck, FileText, Italic, Layers, Link2, List, ListOrdered, Mail, Pencil, Send, Tag, Underline, User, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { frameEmailHtml } from "@/lib/email-frame";
import { sendEmailEvent } from "@/services/action-emails";
import { useChairConference } from "../use-chair-conference";
import { useEmailTemplates } from "../use-email-templates";
import { EmailTemplatesPane } from "./email-templates-page";

/* Email Communication › Send Email (the prototype's ComposeEmailPane): a one-off email to a chosen audience — all authors, the
   corresponding authors, the accepted ones, the ones still under review, the reviewers. The email server (`custom_email`) works out the
   people, sends each one their own copy with their own merge fields filled in and logs every email (Settings › Email Logs); the
   count here is the same people counted from the conference’s papers and committee, each once. The message is plain text (blank line
   = new paragraph) turned into HTML; the prototype's rich-text editor is not ported. The page has the prototype's two tabs: Email Templates (the same pane as
   Settings › Email Templates) and Send Email, which can start from a template. Registered attendees are not offered (no registrations in the database). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const FIELD_GROUPS: Array<{ label: string; fields: string[] }> = [
  { label: "Recipient", fields: ["first_name", "last_name"] },
  { label: "Paper", fields: ["paper_title", "submission_id", "track", "presentation_type", "submission_link"] },
  { label: "Conference & dates", fields: ["conference_name", "conference_acronym", "deadline"] },
];
const SAMPLE: Record<string, string> = { first_name: "Asha", last_name: "Verma", paper_title: "Your paper title", submission_id: "ABC-12", track: "General Track", presentation_type: "Paper Presentation", deadline: "the deadline", submission_link: "https://example.org/paper" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);
/** Plain text → minimal HTML: one paragraph per blank-line-separated chunk, line breaks kept (the prototype's textToHtml). */
const toHtml = (t: string) => (t.split(/\n\n+/).filter((p) => p.trim()).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") || "");
const CSP = "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'";

const bodyHtml = (t: string) => (/<\/?[a-z][\s\S]*>/i.test(t) ? t : toHtml(t));
const textOf = (html: string) => html.replace(/<[^>]*>|&nbsp;/g, " ").trim();

interface EditorHandle { insertText: (t: string) => void; setHtml: (h: string) => void }
/** The message box with a small toolbar (bold, italic, underline, lists, link) — the prototype's CKEditor field. */
const RichBox = forwardRef<EditorHandle, { onChange: (html: string) => void; placeholder: string }>(function RichBox({ onChange, placeholder }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const emit = () => { const e = el.current; if (!e) return; if (!e.textContent?.trim() && !e.querySelector("li,a")) e.innerHTML = ""; onChange(e.innerHTML); };
  useImperativeHandle(ref, () => ({
    insertText: (t) => { el.current?.focus(); document.execCommand("insertText", false, t); emit(); },
    setHtml: (h) => { if (el.current) { el.current.innerHTML = h; emit(); } },
  }));
  const cmd = (name: string, value?: string) => { el.current?.focus(); document.execCommand(name, false, value); emit(); };
  const link = () => { const url = window.prompt("Link address (https://…)"); if (url && /^https?:\/\//i.test(url.trim())) cmd("createLink", url.trim()); };
  const tool = "flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-canvas hover:text-navy";
  const sep = <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;
  return (
    <div className="overflow-hidden rounded-lg border border-line focus-within:border-primary">
      <div role="toolbar" aria-label="Formatting" className="flex items-center gap-1 border-b border-line bg-white px-3 py-2">
        <button type="button" aria-label="Bold" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} className={tool}><Bold size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Italic" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} className={tool}><Italic size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Underline" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")} className={tool}><Underline size={16} aria-hidden="true" /></button>
        {sep}
        <button type="button" aria-label="Bulleted list" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertUnorderedList")} className={tool}><List size={16} aria-hidden="true" /></button>
        <button type="button" aria-label="Numbered list" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("insertOrderedList")} className={tool}><ListOrdered size={16} aria-hidden="true" /></button>
        {sep}
        <button type="button" aria-label="Link" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={link} className={tool}><Link2 size={16} aria-hidden="true" /></button>
      </div>
      <div ref={el} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Message" data-placeholder={placeholder} onInput={emit} className="min-h-[170px] px-4 py-3 text-sm leading-relaxed text-ink outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5" />
    </div>
  );
});

interface TemplateOption { key: string; group: "System Emails" | "Custom Emails"; label: string; subject: string; body: string }
/** "Start from a template": write from scratch, or one of the author emails / the conference's own custom emails (the prototype's TemplatePicker). */
function TemplatePicker({ options, value, onChange }: { options: TemplateOption[]; value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const selected = options.find((t) => t.key === value) ?? null;
  const pick = (key: string) => { onChange(key); setOpen(false); };
  const row = (opt: TemplateOption, Icon: LucideIcon) => {
    const active = opt.key === value;
    return (
      <button key={opt.key} type="button" onClick={() => pick(opt.key)} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-canvas ${active ? "bg-primary-soft" : ""}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-primary ${active ? "bg-white" : "bg-canvas"}`}><Icon size={14} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className={`block truncate text-xs font-semibold ${active ? "text-primary" : "text-ink"}`}>{opt.label}</span>{opt.subject && <span className="block truncate text-[11px] text-ink-faint">{opt.subject}</span>}</span>
        {active && <Check size={14} aria-hidden="true" className="shrink-0 text-primary" />}
      </button>
    );
  };
  const groupHead = "mt-1 border-t border-muted px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint";
  const system = options.filter((o) => o.group === "System Emails");
  const custom = options.filter((o) => o.group === "Custom Emails");
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} style={{ border: "1.5px solid var(--primary-soft-border)" }} className="flex w-full items-center gap-2.5 rounded-lg bg-white px-3 py-2.5 text-sm text-ink outline-none">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{selected ? <Mail size={14} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}</span>
        <span className="min-w-0 flex-1 text-left"><span className={`block truncate font-semibold ${selected ? "text-ink" : "text-ink-faint"}`}>{selected ? selected.label : "Write from scratch"}</span></span>
        <ChevronDown size={15} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} className="shrink-0 text-ink-faint" />
      </button>
      {open && (
        <div role="listbox" style={{ border: "1px solid var(--border)" }} className="absolute inset-x-0 z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-white py-1.5 shadow-lg">
          <button type="button" onClick={() => pick("")} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-canvas ${!value ? "bg-primary-soft" : ""}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-primary ${!value ? "bg-white" : "bg-canvas"}`}><Pencil size={14} aria-hidden="true" /></span>
            <span className={`flex-1 text-xs font-semibold ${!value ? "text-primary" : "text-ink"}`}>Write from scratch</span>
            {!value && <Check size={14} aria-hidden="true" className="shrink-0 text-primary" />}
          </button>
          {system.length > 0 && <><div className={groupHead}>System Emails</div>{system.map((o) => row(o, Mail))}</>}
          {custom.length > 0 && <><div className={groupHead}>Custom Emails</div>{custom.map((o) => row(o, Pencil))}</>}
        </div>
      )}
    </div>
  );
}

function CardHead({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return <div className="mb-4 flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={15} aria-hidden="true" /></div><h3 className="text-sm font-bold text-navy">{title}</h3></div>;
}

export function EmailCommunicationPage({ slug }: { slug: string }) {
  const { state, retry } = useChairConference(slug, { pool: true, logs: true });
  const [picked, setPicked] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ sent: number; failed: number; names: string } | null>(null);
  const editor = useRef<EditorHandle>(null);
  const [templateKey, setTemplateKey] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const [tab, setTab] = useState<"templates" | "send">("templates");
  const tpl = useEmailTemplates(slug);

  const ready = state.status === "ready" ? state : null;
  const doc = useMemo(() => {
    if (!ready) return "";
    const values: Record<string, string> = { ...SAMPLE, conference_name: ready.conference.name, conference_acronym: ready.conference.acronym };
    const html = bodyHtml(message).replace(/{{\s*(\w+)\s*}}/g, (_, k: string) => esc(values[k] ?? ""));
    const logoUrl = typeof window === "undefined" ? "" : new URL("/smartconferu-lockup.png", window.location.origin).href;
    const framed = frameEmailHtml(html || "<p><em>Your message will appear here.</em></p>", { conferenceName: ready.conference.name, conferenceAcronym: ready.conference.acronym, title: subject.replace(/{{\s*(\w+)\s*}}/g, (_, k: string) => values[k] ?? "") || "(No subject yet)", logoUrl });
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"><style>body{margin:0;background:#F8FAFC;font-family:Arial,Helvetica,sans-serif}</style></head><body>${framed}</body></html>`;
  }, [ready, message, subject]);

  const gate = workspaceGate(state, retry, { title: "Email Communication", loadingLabel: "Loading the audiences", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the audiences." });
  if (gate || state.status !== "ready" || !state.pool) return gate;
  const { conference, roles, others, data, pool, logs } = state;
  // Emails sent from here (one row in the log per person): grouped by subject and the minute they went out.
  const sentGroups = [...(logs ?? []).filter((l) => l.event === "custom_email").reduce((m, l) => { const k = `${l.subject}|${l.createdAt.slice(0, 16)}`; const g = m.get(k) ?? { subject: l.subject, at: l.createdAt, people: 0, failed: 0, template: l.template }; g.people += 1; if (l.status === "failed") g.failed += 1; return m.set(k, g); }, new Map<string, { subject: string; at: string; people: number; failed: number; template: string }>()).values()].sort((a, b) => b.at.localeCompare(a.at));
  const lower = (e: string) => e.trim().toLowerCase();
  const live = data.papers.filter((p) => !p.withdrawn);
  const authorSet = (test: (p: (typeof live)[number]) => boolean, onlyCorresponding = false) => new Set(live.filter(test).flatMap((p) => p.authors.filter((a) => !onlyCorresponding || a.corresponding).map((a) => lower(a.email))).filter(Boolean));
  const told = (p: (typeof live)[number]) => p.notifiedOutcome;
  const sets: Record<string, Set<string>> = {
    all_authors: authorSet(() => true),
    corresponding_authors: authorSet(() => true, true),
    accepted_authors: authorSet((p) => told(p) === "accept" || told(p) === "registered"),
    under_review_authors: authorSet((p) => !["accept", "registered", "reject"].includes(told(p) ?? "")),
    reviewers: new Set(pool.reviewers.filter((r) => r.status === "active").map((r) => lower(r.email) || r.memberId)),
  };
  const audiences: Array<{ key: string; label: string; desc: string; icon: LucideIcon }> = [
    { key: "all_authors", label: "All Authors", desc: "Everyone who has submitted a paper", icon: Users },
    { key: "corresponding_authors", label: "Corresponding Authors", desc: "Only the designated corresponding author per paper", icon: User },
    { key: "accepted_authors", label: "Accepted Authors", desc: "Papers whose authors were told Accept", icon: Check },
    { key: "under_review_authors", label: "Under-Review Authors", desc: "Papers awaiting a decision", icon: Clock },
    { key: "reviewers", label: "Reviewers", desc: "Everyone who joined the program committee", icon: FileCheck },
  ];
  const total = new Set(audiences.filter((a) => picked.includes(a.key)).flatMap((a) => [...sets[a.key]])).size;
  const hasMessage = textOf(message).length > 0;
  const canSend = picked.length > 0 && subject.trim().length > 0 && hasMessage && total > 0 && !sending;
  const insert = (field: string) => editor.current?.insertText(`{{${field}}}`);
  // "Start from a template": the author emails (the conference's own copy when it has one) and the conference's custom emails.
  const options: TemplateOption[] = tpl.state.status === "ready" ? [
    ...tpl.state.templates.platform.filter((t) => t.role === "author").map((t): TemplateOption => { const mine = tpl.state.status === "ready" ? tpl.state.templates.mine[t.key] : undefined; return { key: `system:${t.key}`, group: "System Emails", label: t.label, subject: mine?.subject || t.subject, body: mine?.body || t.body }; }),
    ...Object.values(tpl.state.templates.mine).filter((m) => m.custom && m.enabled).map((m): TemplateOption => ({ key: `custom:${m.key}`, group: "Custom Emails", label: m.label || "Untitled Email", subject: m.subject, body: m.body })),
  ] : [];
  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const t = options.find((o) => o.key === key);
    setSubject(t?.subject ?? "");
    editor.current?.setHtml(t ? bodyHtml(t.body) : "");
  };
  const send = async () => {
    if (!canSend) return;
    setSending(true); setError("");
    const names = audiences.filter((a) => picked.includes(a.key)).map((a) => a.label.toLowerCase());
    const res = await sendEmailEvent("custom_email", { conferenceId: data.dbId, audiences: picked, subject: subject.trim(), body: bodyHtml(message), templateLabel: options.find((o) => o.key === templateKey)?.label ?? "" });
    setSending(false);
    if (res.error) { setError(res.error); return; }
    setDone({ sent: res.sent, failed: res.failed, names: names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] });
  };
  const again = () => { setDone(null); setPicked([]); setSubject(""); setMessage(""); setTemplateKey(""); setError(""); };

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="submissions/email" screening={data.screening}>
      <PageHeader title="Email Communication" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }]} />
      <div className="hd-page p-8">
        <div role="tablist" aria-label="Email Communication" className="mb-6 flex items-center gap-2">
          {([["templates", "Email Templates"], ["send", "Send Email"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border border-line px-4 py-2 text-xs font-bold transition-colors ${tab === k ? "bg-navy text-white" : "bg-white text-ink-muted"}`}>{l}</button>)}
        </div>
        {tab === "templates" ? (
          <>
            {tpl.state.status === "ready" ? <EmailTemplatesPane slug={slug} conferenceName={conference.name} conferenceAcronym={conference.acronym} templates={tpl.state.templates} reload={tpl.reload} authorOnly /> : tpl.state.status === "loading" ? <div role="status" aria-label="Loading the email templates" className="h-60 animate-pulse rounded-2xl border border-line bg-white" /> : <p role="alert" className="text-sm font-semibold text-danger">Couldn&apos;t load the email templates. <button type="button" onClick={tpl.retry} className="underline">Try again</button></p>}
          </>
        ) : (<>
        {/* what has already gone out from here */}
        <div style={CARD} className="mb-5 overflow-hidden rounded-2xl bg-white">
          <button type="button" onClick={() => setShowSent((v) => !v)} aria-expanded={showSent} className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
            <Mail size={14} aria-hidden="true" className="shrink-0 text-primary" />
            <span className="text-[13px] font-bold text-navy">Emails sent from here</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{sentGroups.length ? `${sentGroups.length} sent` : "none yet"}</span>
            <ChevronDown size={15} aria-hidden="true" style={{ transform: showSent ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} className="ml-auto shrink-0 text-ink-faint" />
          </button>
          {showSent && (
            <>
              {sentGroups.length === 0 ? <p className="border-t border-muted px-5 py-4 text-sm text-ink-faint">You haven&apos;t sent an email from here yet.</p> : (
                <ul className="divide-y divide-muted border-t border-muted">
                  {sentGroups.map((g) => <li key={`${g.subject}-${g.at}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]"><span className="min-w-0 flex-1 truncate font-semibold text-navy" title={g.subject}>{g.subject}</span><span className="text-xs text-ink-muted">{new Date(g.at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span><span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">{g.people} recipient{g.people === 1 ? "" : "s"}</span>{g.failed > 0 && <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[11px] font-bold text-danger">{g.failed} failed</span>}</li>)}
                </ul>
              )}
              <p className="border-t border-muted px-5 py-2.5 text-[11px] text-ink-faint">Every email is also listed, with its text, in <Link href={`/chair/${encodeURIComponent(conference.id)}/settings/email-logs`} className="font-bold text-primary hover:underline">Email Logs</Link>.</p>
            </>
          )}
        </div>
        {done ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft"><Check size={28} strokeWidth={2.5} aria-hidden="true" className="text-success" /></div>
              <h2 className="mb-2 text-lg font-bold text-navy">Email sent</h2>
              <p className="mb-6 text-sm text-ink-muted">Sent to {done.failed ? `${done.sent} of ${done.sent + done.failed} recipients (${done.names})` : done.names}, each with their own name and paper details filled in. Every email is listed in Email Logs.</p>
              <button type="button" onClick={again} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-95">Compose another</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[7fr_3fr]">
            <div className="space-y-4">
              <section style={CARD} className="space-y-5 rounded-2xl bg-white p-6">
                <CardHead icon={Send} title="Compose Email" />
                <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="rounded-xl p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-navy"><Layers size={14} aria-hidden="true" className="text-primary" /> Start from a template</div>
                  <TemplatePicker options={options} value={templateKey} onChange={applyTemplate} />
                  <p className="mt-2 text-[11px] leading-relaxed text-navy opacity-80">Fills in Subject and Message below — both stay editable, so tweak away or ignore this and write your own.</p>
                </div>
                <div>
                  <label htmlFor="ce-subject" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-muted"><FileText size={13} aria-hidden="true" /> Subject</label>
                  <input id="ce-subject" value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} placeholder="What's this email about?" style={{ border: "1px solid var(--border)" }} className="w-full rounded-lg px-3 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400" />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-muted"><BookOpen size={13} aria-hidden="true" /> Message</div>
                  <RichBox ref={editor} onChange={setMessage} placeholder="Write your message here..." />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-muted"><Tag size={13} aria-hidden="true" /> Merge fields</div>
                  <p className="mb-2.5 text-[11px] text-ink-faint">Click one to insert it — each gets swapped for the real value when the email actually goes out.</p>
                  <div className="space-y-2.5">
                    {FIELD_GROUPS.map((g) => (
                      <div key={g.label}>
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-faint">{g.label}</div>
                        <div className="flex flex-wrap gap-1.5">{g.fields.map((f) => <button key={f} type="button" onClick={() => insert(f)} style={{ border: "1px solid var(--primary-soft-border)" }} className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary transition-opacity hover:opacity-80">{`{{${f}}}`}</button>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
            <div className="space-y-4 lg:sticky lg:top-8">
              <section style={CARD} className="rounded-2xl bg-white p-4">
                <CardHead icon={Users} title="Recipients" />
                <div className="-mt-2 space-y-1.5">
                  {audiences.map((a) => {
                    const Icon = a.icon; const on = picked.includes(a.key);
                    return (
                      <label key={a.key} style={{ background: on ? "var(--primary-soft)" : "transparent", border: `1px solid ${on ? "var(--primary-soft-border)" : "transparent"}` }} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-canvas">
                        <input type="checkbox" checked={on} onChange={() => setPicked((l) => (l.includes(a.key) ? l.filter((k) => k !== a.key) : [...l, a.key]))} style={{ accentColor: "var(--primary)" }} className="h-4 w-4 shrink-0 cursor-pointer rounded" />
                        <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${on ? "bg-white" : "bg-canvas"}`}><Icon size={14} className={on ? "text-primary" : "text-ink-faint"} /></span>
                        <span className="min-w-0 flex-1"><span className={`block truncate text-xs font-semibold ${on ? "text-primary" : "text-ink"}`}>{a.label}</span><span className="block truncate text-[11px] text-ink-faint">{a.desc}</span></span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? "bg-primary text-white" : "bg-muted text-ink-muted"}`}>{sets[a.key].size}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-muted pt-3"><span className="text-xs font-semibold text-ink-faint">Total recipients</span><span className="text-sm font-extrabold text-navy">{total}</span></div>
              </section>
              <button type="button" onClick={() => void send()} disabled={!canSend} style={{ background: canSend ? "var(--gradient-primary)" : "var(--muted)", color: canSend ? "#FFFFFF" : "var(--ink-faint)" }} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition-opacity disabled:cursor-not-allowed"><Send size={15} aria-hidden="true" /> {sending ? "Sending…" : "Send Email"}</button>
              <div>
                <button type="button" onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview} className="flex items-center gap-1.5 text-xs text-primary"><Mail size={13} aria-hidden="true" /> This action sends {total || 1} email{(total || 1) === 1 ? "" : "s"} <span aria-hidden="true">·</span> <span className="font-semibold hover:underline">View emails</span> <ChevronDown size={13} aria-hidden="true" style={{ transform: showPreview ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} /></button>
                {showPreview && (
                  <div style={CARD} className="mt-2 rounded-xl bg-white p-3">
                    <p className="mb-2 text-[11px] text-ink-faint">To: {audiences.filter((a) => picked.includes(a.key)).map((a) => a.label).join(", ") || "Selected Audience"} · as the email will look, with sample values.</p>
                    <iframe title="Email preview" sandbox="" srcDoc={doc} className="block h-[420px] w-full rounded-lg border border-line bg-canvas" />
                  </div>
                )}
              </div>
              {error && <p role="alert" style={{ background: "var(--danger-soft)" }} className="rounded-lg px-3 py-2 text-xs font-semibold leading-relaxed text-danger">{error}</p>}
              {!canSend && <p className="text-center text-[11px] leading-relaxed text-ink-faint">Pick at least one audience with people in it, and add a subject and a message to send.</p>}
            </div>
          </div>
        )}
        </>)}
      </div>
    </ConferenceShell>
  );
}
