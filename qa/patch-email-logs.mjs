// One-off edit helper: Conference Settings › Email Logs as the prototype's (Bcc column and row, status dot, pagination, filters, detail window).
import fs from "node:fs";
const f = "../src/features/chair/components/email-logs-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 80)); return; } s = s.replace(a, () => b); n++; };
const cut = (startMark, endMark, neu) => { const a = s.indexOf(startMark); const b = s.indexOf(endMark, a); if (a < 0 || b < 0) { console.log("MISSING block", startMark.slice(0, 60)); return; } s = s.slice(0, a) + neu + s.slice(b); n++; };

rep(`const PAGE = 25;`, `const PAGE = 8;`);
rep(`const SELECT = "cursor-pointer rounded-lg border border-line bg-canvas px-2.5 py-2 text-xs font-semibold text-ink-muted outline-none focus:border-primary";`, `const SELECT = "cursor-pointer rounded-lg border border-line bg-canvas px-3 py-2 text-xs font-semibold text-ink outline-none";
const DATE_BOX = "rounded-lg border border-line bg-canvas px-2.5 py-2 text-xs outline-none";
/** A recipient list as one cell: the first person and "+n" for the rest, "—" when there is none (the prototype's EmailRecipientCell). */
function Recipients({ list }: { list: Array<{ name: string; email: string }> }) {
  if (list.length === 0) return <span className="text-ink-faint">—</span>;
  return <div><div className="font-semibold text-navy">{list[0].name || list[0].email}{list.length > 1 ? \` +\${list.length - 1}\` : ""}</div>{list[0].name && <div className="text-xs text-ink-faint">{list[0].email}</div>}</div>;
}
function StatusBadge({ status }: { status: "sent" | "failed" }) {
  const c = status === "failed" ? "text-danger bg-danger-soft" : "text-success bg-success-soft";
  return <span className={\`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold \${c}\`}><span className={\`h-1.5 w-1.5 shrink-0 rounded-full \${status === "failed" ? "bg-danger" : "bg-success"}\`} />{status === "failed" ? "Failed" : "Sent"}</span>;
}
function HeaderRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div className="flex items-start gap-2.5 text-sm"><span className="w-10 shrink-0 font-semibold text-ink-faint">{label}</span><span className="min-w-0 break-words text-ink">{value}</span></div>;
}`);

// ---- the detail window: the prototype's Modal (From / To / Bcc, status and recipient, the message)
cut(`function LogDialog(`, `export function EmailLogsPage`, `function LogDialog({ log, acronym, onClose }: { log: ChairEmailLog | null; acronym: string; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(() => {
    if (!log) return "";
    const logoUrl = typeof window === "undefined" ? "" : new URL("/smartconferu-lockup.png", window.location.origin).href;
    const framed = frameEmailHtml(log.body, { conferenceName: acronym, conferenceAcronym: acronym, title: log.subject.replace(/^\\[[^\\]]*\\]\\s*/, ""), logoUrl });
    return \`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="\${CSP}"><base target="_blank"><style>body{margin:0;background:#F8FAFC;font-family:Arial,sans-serif}</style></head><body>\${framed}</body></html>\`;
  }, [log, acronym]);
  const fit = () => { const fr = frame.current; const h = fr?.contentDocument?.documentElement?.scrollHeight; if (fr && h) fr.style.height = \`\${h + 2}px\`; };
  if (!log) return null;
  const when = \`\${utc(log.createdAt).date}, \${utc(log.createdAt).time} UTC\`;
  const to = log.toName ? \`\${log.toName} <\${log.toEmail}>\` : log.toEmail;
  return (
    <Modal title={log.subject} subtitle={\`\${log.template} · \${when}\`} icon={Mail} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="space-y-1.5 rounded-xl border border-line bg-canvas p-3.5">
          <HeaderRow label="From" value={\`\${acronym || "Smartconferu"} Secretariat <notifications@smartconferu.com>\`} />
          <HeaderRow label="To" value={to} />
          <HeaderRow label="Bcc" value={log.bcc && log.bcc.length > 0 ? log.bcc.map((r) => \`\${r.name} <\${r.email}>\`).join(", ") : null} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="text-ink-faint">Status</span><StatusBadge status={log.status} /></span>
          <span className="text-ink-faint">Recipient: <span className="font-semibold text-ink">{log.recipientType || "—"}</span></span>
        </div>
        {log.status === "failed" && log.error && <p role="alert" className="text-xs font-semibold text-danger">{log.error}</p>}
        <div>
          <div className="mb-1.5 text-xs font-semibold text-ink-faint">Message</div>
          {log.body
            ? <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-line bg-canvas"><iframe ref={frame} title={\`Email: \${log.subject}\`} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} onLoad={fit} className="block min-h-[240px] w-full border-0" /></div>
            : <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink-faint">The text of this email was not kept.</p>}
        </div>
      </div>
    </Modal>
  );
}

`);
rep(`import { Dialog } from "@/components/ui/dialog";`, `import { Modal } from "@/components/ui/modal";`);
rep(`import { Mail, Search } from "lucide-react";`, `import { ChevronLeft, ChevronRight, Mail, Search } from "lucide-react";`);

// ---- filters
rep(`className={\`\${SELECT} max-w-[220px]\`}`, `className={SELECT}`);
rep(`className="rounded-lg border border-line bg-canvas px-2.5 py-2 text-xs outline-none" /><span className="text-xs text-ink-faint">to</span>`, `className={\`\${DATE_BOX} \${from ? "text-ink" : "text-ink-faint"}\`} /><span className="text-xs text-ink-faint">to</span>`);

// ---- table + pagination
cut(`                <table className="w-full text-sm">`, `            </>
          ) : (`, `                <table className="ui-table w-full text-sm">
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
                  <button type="button" onClick={() => setPage(Math.max(1, safe - 1))} disabled={safe === 1} aria-label="Previous page" className={\`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-line transition-colors hover:bg-canvas disabled:cursor-not-allowed \${safe === 1 ? "text-ink-faint" : "text-ink-muted"}\`}><ChevronLeft size={14} aria-hidden="true" /></button>
                  <span className="px-1 text-xs font-semibold text-ink-muted">Page {safe} of {pages}</span>
                  <button type="button" onClick={() => setPage(Math.min(pages, safe + 1))} disabled={safe === pages} aria-label="Next page" className={\`flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-line transition-colors hover:bg-canvas disabled:cursor-not-allowed \${safe === pages ? "text-ink-faint" : "text-ink-muted"}\`}><ChevronRight size={14} aria-hidden="true" /></button>
                </div>
              </div>
`);
fs.writeFileSync(f, s);
const t = "../src/types/chair.ts"; let ts = fs.readFileSync(t, "utf8");
ts = ts.replace(`export interface ChairEmailLog {\n  id: string;`, () => `export interface ChairEmailLog {\n  /** Bcc recipients: the email log keeps one recipient per row and no Bcc, so this is empty (the prototype's Bcc column shows "—"). */\n  bcc?: Array<{ name: string; email: string }>;\n  id: string;`);
fs.writeFileSync(t, ts);
console.log("applied", n);
