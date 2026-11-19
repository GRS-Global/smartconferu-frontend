"use client";

import { ChevronLeft, ChevronRight, Mail, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Modal } from "@/components/ui/modal";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { frameEmailHtml } from "@/lib/email-frame";
import type { ChairEmailLog } from "@/types/chair";
import { useEmailLogs } from "../use-email-logs";

/* Conference Settings › Email Logs (the prototype's EmailLogsPage): the history and delivery status of the emails this conference sent
   (`email_log`, written by the email server; chairs can only read it). Filters on status, recipient type, template and dates, a
   search on subject or recipient, 25 a page, and the full email in a sandboxed frame. The prototype’s Bcc column has no counterpart
   (the log keeps one recipient per row). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const PAGE = 8;
const CSP = "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'";
const utc = (iso: string) => { const d = new Date(iso); return { date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) }; };
const SELECT = "cursor-pointer rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-semibold text-ink outline-none";
const DATE_BOX = "rounded-lg border border-line bg-canvas px-2.5 py-2 text-xs outline-none";
/** A recipient list as one cell: the first person and "+n" for the rest, "—" when there is none (the prototype's EmailRecipientCell). */
function Recipients({ list }: { list: Array<{ name: string; email: string }> }) {
  if (list.length === 0) return <span className="text-ink-faint">—</span>;
  return <div><div className="font-semibold text-navy">{list[0].name || list[0].email}{list.length > 1 ? ` +${list.length - 1}` : ""}</div>{list[0].name && <div className="text-xs text-ink-faint">{list[0].email}</div>}</div>;
}
function StatusBadge({ status }: { status: "sent" | "failed" | "queued" }) {
  const c = status === "failed" ? "text-danger bg-danger-soft" : status === "queued" ? "text-warning bg-warning-soft" : "text-success bg-success-soft";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === "failed" ? "bg-danger" : status === "queued" ? "bg-warning" : "bg-success"}`} />{status === "failed" ? "Failed" : status === "queued" ? "Sending" : "Sent"}</span>;
}
function HeaderRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div className="flex items-start gap-2.5 text-sm"><span className="w-10 shrink-0 font-semibold text-ink-faint">{label}</span><span className="min-w-0 break-words text-ink">{value}</span></div>;
}

function LogDialog({ log, acronym, onClose }: { log: ChairEmailLog | null; acronym: string; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(() => {
    if (!log) return "";
    const logoUrl = typeof window === "undefined" ? "" : new URL("/smartconferu-lockup.png", window.location.origin).href;
    const framed = frameEmailHtml(log.body, { conferenceName: acronym, conferenceAcronym: acronym, title: log.subject.replace(/^\[[^\]]*\]\s*/, ""), logoUrl });
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><base target="_blank"><style>body{margin:0;background:#F8FAFC;font-family:Arial,sans-serif}</style></head><body>${framed}</body></html>`;
  }, [log, acronym]);
  const fit = () => { const fr = frame.current; const h = fr?.contentDocument?.documentElement?.scrollHeight; if (fr && h) fr.style.height = `${h + 2}px`; };
  if (!log) return null;
  const when = `${utc(log.createdAt).date} · ${utc(log.createdAt).time} UTC`;
  const to = log.toName ? `${log.toName} <${log.toEmail}>` : log.toEmail;
  return (
    <Modal title={log.subject} subtitle={`${log.template} · ${when}`} icon={Mail} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-xl border border-line bg-canvas p-3.5">
          <HeaderRow label="From" value={`${acronym || "Smartconferu"} Secretariat <notifications@smartconferu.com>`} />
          <HeaderRow label="To" value={to} />
          <HeaderRow label="Bcc" value={log.bcc && log.bcc.length > 0 ? log.bcc.map((r) => `${r.name} <${r.email}>`).join(", ") : null} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="text-ink-faint">Status</span><StatusBadge status={log.status} /></span>
          <span className="text-ink-faint">Recipient: <span className="font-semibold text-ink">{log.recipientType || "—"}</span></span>
        </div>
        {log.status === "failed" && log.error && <p role="alert" className="text-xs font-semibold text-danger">{log.error}</p>}
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-faint">Message</div>
          {log.body
            ? <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line bg-canvas"><iframe ref={frame} title={`Email: ${log.subject}`} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} onLoad={fit} className="block min-h-[240px] w-full border-0" /></div>
            : <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink-faint">The text of this email was not kept.</p>}
        </div>
      </div>
    </Modal>
  );
}

export function EmailLogsPage({ slug }: { slug: string }) {
  const { state, retry } = useEmailLogs(slug);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [recipient, setRecipient] = useState("all");
  const [template, setTemplate] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<ChairEmailLog | null>(null);

  const gate = workspaceGate(state, retry, { title: "Email Logs", loadingLabel: "Loading the email logs", missingTitle: "We couldn't find that conference.", missingText: "It doesn't exist, or you are not a chair of it. Pick one from My Conferences.", errorTitle: "Couldn't load the email logs." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, screening, logs } = state;
  const recipients = [...new Set(logs.map((l) => l.recipientType).filter(Boolean))].sort();
  const templates = [...new Set(logs.map((l) => l.template).filter(Boolean))].sort();
  const q = search.trim().toLowerCase();
  const filtered = logs.filter((l) => (status === "all" || l.status === status) && (recipient === "all" || l.recipientType === recipient) && (template === "all" || l.template === template)
    && (!from || l.createdAt.slice(0, 10) >= from) && (!to || l.createdAt.slice(0, 10) <= to)
    && (!q || l.subject.toLowerCase().includes(q) || l.toEmail.toLowerCase().includes(q) || l.toName.toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safe = Math.min(page, pages);
  const shown = filtered.slice((safe - 1) * PAGE, safe * PAGE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <ConferenceShell role="chair" conference={conference} roles={roles} others={others} active="settings/email-logs" screening={screening}>
      <PageHeader title="Email Logs" breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: conference.acronym }, { label: "Conference Settings" }, { label: "Email Logs", strong: true }]} />
      <div className="hd-page p-8">
        <div className="mb-6 max-w-3xl rounded-xl border border-line bg-canvas p-5 text-sm leading-relaxed text-ink-soft">View the history and delivery status of emails sent by this conference. Editing what an email says happens on Email Templates — this is the delivery record only.</div>
        <div data-tour="el-filters" className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className={SELECT}><option value="all">All Statuses</option><option value="sent">Sent</option><option value="queued">Sending</option><option value="failed">Failed</option></select>
            <select aria-label="Recipient type" value={recipient} onChange={(e) => reset(setRecipient)(e.target.value)} className={SELECT}><option value="all">All Recipients</option>{recipients.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <select aria-label="Template" value={template} onChange={(e) => reset(setTemplate)(e.target.value)} className={SELECT}><option value="all">All Templates</option>{templates.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <span className="flex items-center gap-1.5"><input type="date" aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={`${DATE_BOX} ${from ? "text-ink" : "text-ink-faint"}`} /><span className="text-xs text-ink-faint">to</span><input type="date" aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-xs outline-none" /></span>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2"><Search size={15} aria-hidden="true" className="text-ink-faint" /><input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Search by subject or recipient..." aria-label="Search by subject or recipient" className="w-56 bg-transparent text-sm outline-none" /></label>
        </div>
        <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
          {shown.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="ui-table w-full text-sm">
                  <thead><tr className="border-b border-line bg-canvas"><th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-muted">Date UTC</th><th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">Subject</th><th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">To</th><th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">Bcc</th><th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-muted">Status</th><th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-ink-muted">Details</th></tr></thead>
                  <tbody>
                    {shown.map((l, i) => {
                      const t = utc(l.createdAt);
                      return (
                        <tr key={l.id} style={{ borderBottom: i < shown.length - 1 ? "1px solid var(--muted)" : "none" }} className="transition-colors">
                          <td className="whitespace-nowrap px-4 py-3.5"><div className="text-xs font-semibold text-ink">{t.date}</div><div className="text-xs text-ink-faint">{t.time}</div></td>
                          <td className="max-w-[210px] truncate px-4 py-3.5 text-ink" title={l.subject}>{l.subject}</td>
                          <td className="px-4 py-3.5"><Recipients list={[{ name: l.toName, email: l.toEmail }]} /></td>
                          <td className="px-4 py-3.5"><Recipients list={l.bcc ?? []} /></td>
                          <td className="px-4 py-3.5"><StatusBadge status={l.status} /></td>
                          <td className="px-4 py-3.5 text-center"><button type="button" onClick={() => setOpen(l)} className="cursor-pointer whitespace-nowrap text-xs font-semibold text-primary hover:underline">View Details</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line px-5 py-3">
                <span className="text-xs text-ink-faint">Showing {(safe - 1) * PAGE + 1}–{Math.min(safe * PAGE, filtered.length)} of {filtered.length}</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setPage(Math.max(1, safe - 1))} disabled={safe === 1} aria-label="Previous page" className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-line transition-colors hover:bg-canvas disabled:cursor-not-allowed ${safe === 1 ? "text-ink-faint" : "text-ink-muted"}`}><ChevronLeft size={14} aria-hidden="true" /></button>
                  <span className="px-1 text-xs font-semibold text-ink-muted">Page {safe} of {pages}</span>
                  <button type="button" onClick={() => setPage(Math.min(pages, safe + 1))} disabled={safe === pages} aria-label="Next page" className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-line transition-colors hover:bg-canvas disabled:cursor-not-allowed ${safe === pages ? "text-ink-faint" : "text-ink-muted"}`}><ChevronRight size={14} aria-hidden="true" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-14 text-center"><Mail size={28} aria-hidden="true" className="mx-auto mb-2 text-line-strong" /><p className="mb-1 text-sm font-semibold text-ink">{logs.length ? "No emails match these filters" : "No emails sent yet"}</p><p className="text-xs text-ink-faint">{logs.length ? "Change or clear the filters." : "Emails sent by this conference will appear here."}</p></div>
          )}
        </div>
      </div>
      <LogDialog log={open} acronym={conference.acronym} onClose={() => setOpen(null)} />
    </ConferenceShell>
  );
}
