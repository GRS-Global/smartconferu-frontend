"use client";

import { Clock, Mail, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EMAIL_SUMMARIES } from "@/features/chair/email-summaries";
import { getChairService } from "@/services/chair";
import type { EmailTemplates } from "@/types/chair";

/* "Team emails sent automatically" (the prototype's ScheduledEmailsPanel): the emails the system sends on its own after you invite someone to the team —
   what each is, who gets it and when, whether it is switched on for this conference, and a way to change its wording in Settings › Email Templates. */

const TONE: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: "Scheduled", bg: "var(--warning-soft)", color: "var(--warning)" },
  auto: { label: "Automatic", bg: "var(--primary-soft)", color: "var(--primary)" },
  chair: { label: "Sent by you", bg: "var(--muted)", color: "var(--ink-soft)" },
};

export function ScheduledEmailsPanel({ slug, title, desc, keys }: { slug: string; title: string; desc: string; keys: string[] }) {
  const [templates, setTemplates] = useState<EmailTemplates | null>(null);
  useEffect(() => {
    let cancelled = false;
    getChairService().then((s) => s.loadEmailTemplates(slug)).then((t) => { if (!cancelled) setTemplates(t); }).catch(() => { if (!cancelled) setTemplates({ platform: [], mine: {} }); });
    return () => { cancelled = true; };
  }, [slug]);
  const items = templates ? keys.flatMap((k) => { const p = templates.platform.find((x) => x.key === k); return p ? [{ p, on: templates.mine[k]?.enabled ?? true }] : []; }) : [];
  if (templates && items.length === 0) return null;
  return (
    <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="rounded-2xl bg-white p-5">
      <div className="mb-3.5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning"><Clock size={16} aria-hidden="true" /></span>
        <div className="min-w-0"><h2 className="text-sm font-bold text-navy">{title}</h2><p className="mt-0.5 text-xs text-ink-faint">{desc}</p></div>
      </div>
      {!templates ? <div role="status" aria-label="Loading the emails" className="h-20 animate-pulse rounded-lg border border-line bg-canvas" /> : (
        <div className="space-y-2">
          {items.map(({ p, on }) => {
            const tone = TONE[p.sendType] ?? TONE.chair;
            return (
              <div key={p.key} style={{ border: "1px solid var(--primary-soft-border)", opacity: on ? 1 : 0.65 }} className="rounded-lg bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"><Mail size={11} aria-hidden="true" /></span>
                      <span className="text-xs font-bold text-navy">{p.label}</span>
                      <span style={{ background: tone.bg, color: tone.color }} className="rounded-full px-1.5 py-0.5 text-[10px] font-bold">{tone.label}</span>
                      {!on && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">Turned off · not sent</span>}
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-ink-soft">
                      <div className="truncate"><span className="font-semibold text-ink-muted">To:</span> {p.recipients}</div>
                      {p.trigger && <div className="truncate"><span className="font-semibold text-ink-muted">When:</span> {p.trigger}</div>}
                      {EMAIL_SUMMARIES[p.key] && <div className="truncate"><span className="font-semibold text-ink-muted">Contains:</span> {EMAIL_SUMMARIES[p.key]}</div>}
                    </div>
                  </div>
                  <Link href={`/chair/${encodeURIComponent(slug)}/settings/email-templates?template=${encodeURIComponent(p.key)}`} title="Change this email's subject and message in Email Templates" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-ink-soft transition-colors hover:border-primary hover:text-primary"><Pencil size={12} aria-hidden="true" /> Edit</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
