// One-off edit helper (part 3): the "…emails" panels as the prototype's: coloured tile, real recipient, "Edit template" (opens that template in Email Templates, with a way back)
// and "See how email looks" (the email right there, no navigation).
import fs from "node:fs";
const f = "../src/features/chair/components/policy-cards.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const a = s.indexOf("export interface EmailItem");
const b = s.indexOf("export const SUBMISSION_EMAILS");
if (a < 0 || b < 0) { console.log("MISSING markers"); process.exit(1); }
const panel = `export interface EmailItem { name: string; kind: "Automatic" | "Scheduled reminder"; count: number; to: string; also?: string; when: string; /** The email template this is (Email Templates), when it has one. */ key?: string; /** Who it goes to: a reviewer's email shows the signed-in person as the sample recipient, as in the prototype. */ role?: "reviewer" | "chair" | "author" }

const ROLE_TONE = { reviewer: { color: "var(--success)", bg: "var(--success-soft)" }, chair: { color: "var(--primary)", bg: "var(--primary-soft)" }, author: { color: "#0369A1", bg: "#E0F2FE" } } as const;

/** One email of a panel: what it is, who gets it and when, "Edit template" (opens it in Email Templates, Back leads here again) and "See how email looks"
 *  (the email, with sample values, right under the row). */
function EmailRow({ e, slug, conferenceName, acronym, backLabel, templates, recipient, onNeedTemplates, href }: { e: EmailItem; slug: string; conferenceName: string; acronym: string; backLabel: string; templates: EmailTemplates | null; recipient: string; onNeedTemplates: () => void; href: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const tone = ROLE_TONE[e.role ?? "chair"];
  const t = e.key && templates ? (templates.mine[e.key] ?? templates.platform.find((x) => x.key === e.key) ?? null) : null;
  const to = e.role === "reviewer" && recipient ? recipient : e.to;
  const edit = e.key ? \`/chair/\${encodeURIComponent(slug)}/settings/email-templates?template=\${encodeURIComponent(e.key)}&back=\${encodeURIComponent(path)}&backLabel=\${encodeURIComponent(backLabel)}\` : href;
  const toggle = () => { if (!open) onNeedTemplates(); setOpen(!open); };
  return (
    <li style={{ border: "1px solid var(--primary-soft-border)" }} className="rounded-lg bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ background: tone.bg, color: tone.color }} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"><Mail size={11} aria-hidden="true" /></span>
            <span className="text-xs font-bold text-navy">{e.name}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", e.kind === "Automatic" ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>{e.kind}</span>
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
                <div className="flex gap-2"><span className="w-16 shrink-0 font-bold text-ink-faint">To:</span><span className="min-w-0 break-words font-medium text-navy">{to}</span></div>
                {e.also && <div className="flex gap-2"><span className="w-16 shrink-0 font-bold text-ink-faint">Also to:</span><span className="min-w-0 break-words font-medium text-navy">{e.also}</span></div>}
                <div className="flex gap-2 border-t border-line pt-1.5"><span className="w-16 shrink-0 font-bold text-ink-faint">Subject:</span><span className="font-bold text-primary">{emailSubject(t.subject, conferenceName, acronym)}</span></div>
              </div>
              <iframe title={\`\${e.name} preview\`} sandbox="" srcDoc={emailPreviewDoc(t.subject, t.body, conferenceName, acronym)} className="block h-72 w-full bg-canvas" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-muted px-4 py-2 text-[11px] font-medium text-ink-muted"><span className="flex items-center gap-1.5"><Send size={12} aria-hidden="true" className="text-primary" /> {e.when}</span><span className="text-[10.5px] italic text-ink-faint">Edit in Settings › Email Templates</span></div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** The prototype's "…emails" panels: what the system sends around this part of the conference, to whom and when; the wording is edited under Email Templates. */
export function EmailsPanel({ id, title, desc, items, href, slug, conferenceName, acronym, backLabel }: { id?: string; title: string; desc: string; items: EmailItem[]; href: string; slug: string; conferenceName: string; acronym: string; backLabel: string }) {
  const profile = useOptionalProfile();
  const me = profile?.state.status === "ready" ? profile.state.profile : null;
  const recipient = me ? \`\${[me.firstName, me.lastName].filter(Boolean).join(" ")} <\${me.mainEmail}>\` : "";
  const [templates, setTemplates] = useState<EmailTemplates | null>(null);
  const loading = useRef(false);
  // The templates are read the first time an email is opened, not with the page.
  const need = () => { if (templates || loading.current) return; loading.current = true; getChairService().then((s) => s.loadEmailTemplates(slug)).then(setTemplates).catch(() => { loading.current = false; }); };
  return (
    <section id={id} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><Clock size={16} aria-hidden="true" /></span>
        <div><h2 className="text-base font-extrabold text-navy">{title}</h2><p className="mt-0.5 text-xs text-ink-faint">{desc}</p></div>
      </div>
      <ul className="space-y-2">
        {items.map((e) => <EmailRow key={e.name} e={e} slug={slug} conferenceName={conferenceName} acronym={acronym} backLabel={backLabel} templates={templates} recipient={recipient} onNeedTemplates={need} href={href} />)}
      </ul>
    </section>
  );
}

`;
s = s.slice(0, a) + panel + s.slice(b);
const rep = (x, y) => { if (!s.includes(x)) { console.log("MISSING:", x.slice(0, 80)); return; } s = s.replace(x, () => y); n += 1; };
rep('import { Clock, Eye, FileText, Hash, Mail, Send } from "lucide-react";', 'import { Clock, Eye, EyeOff, FileText, Hash, Mail, Pencil, Send } from "lucide-react";');
rep('import Link from "next/link";\nimport { useState, type ReactNode } from "react";', 'import Link from "next/link";\nimport { usePathname } from "next/navigation";\nimport { useRef, useState, type ReactNode } from "react";');
rep('import type { ReviewMode, ReviewPolicy, SubmissionPolicy } from "@/types/chair";', 'import { useOptionalProfile } from "@/features/profile/profile-context";\nimport { getChairService } from "@/services/chair";\nimport type { EmailTemplates, ReviewMode, ReviewPolicy, SubmissionPolicy } from "@/types/chair";\nimport { emailPreviewDoc, emailSubject } from "../email-preview";');
// keys and roles of the review-side emails
rep('{ name: "Activate your reviewer account", kind: "Scheduled reminder", count: 1, to: "The invited reviewer",', '{ key: "reviewerActivateReminder", role: "reviewer", name: "Activate your reviewer account", kind: "Scheduled reminder", count: 1, to: "The invited reviewer",');
rep('{ name: "Reviewers not yet active", kind: "Scheduled reminder", count: 1, to: "Conference Chair",', '{ key: "reviewersInactiveChair", role: "chair", name: "Reviewers not yet active", kind: "Scheduled reminder", count: 1, to: "Conference Chair",');
rep('{ name: "Complete your reviewer profile", kind: "Scheduled reminder", count: 1, to: "The reviewer",', '{ key: "reviewerProfileReminder", role: "reviewer", name: "Complete your reviewer profile", kind: "Scheduled reminder", count: 1, to: "The reviewer",');
rep('{ name: "Review reminder 1 — days left",', '{ key: "reviewDueSoon", role: "reviewer", name: "Review reminder 1 — days left",');
rep('{ name: "Review reminder 2 — last day",', '{ key: "reviewLastDay", role: "reviewer", name: "Review reminder 2 — last day",');
rep('{ name: "Review overdue",', '{ key: "reviewOverdue", role: "reviewer", name: "Review overdue",');
rep('{ name: "Overdue reviews: daily list",', '{ key: "overdueDigestChair", role: "chair", name: "Overdue reviews: daily list",');
rep('{ name: "Grace period over: review form locked",', '{ key: "reviewFormLocked", role: "reviewer", name: "Grace period over: review form locked",');
rep('{ name: "Papers need action: missed reviews",', '{ key: "missedReviewsChair", role: "chair", name: "Papers need action: missed reviews",');
rep('{ name: "Review progress digest",', '{ key: "reviewProgressDigest", role: "chair", name: "Review progress digest",');
rep('{ name: "Paper ready for decision",', '{ key: "chairDecisionReady", role: "chair", name: "Paper ready for decision",');
fs.writeFileSync(f, s); console.log("applied", n);
