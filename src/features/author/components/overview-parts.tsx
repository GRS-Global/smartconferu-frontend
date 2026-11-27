"use client";

import Link from "next/link";
import { Award, Check, ChevronRight, Image as ImageIcon, MessageSquare, Mic, Sparkles, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { CERTIFICATES_ENABLED, FEEDBACK_ENABLED, FLYER_ENABLED } from "@/lib/config";
import type { Dest } from "../links";
import type { Todo } from "../todos";

/* The Overview's own cards (the prototype's AuthorHomeD.jsx and WrapUpRow): the to-do list, this conference's numbers and the
   wrap-up row of a finished conference. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const rise = (i: number) => ({ animationDelay: `${Math.min(i, 10) * 60}ms` });

/** A button that goes somewhere: a page of this app (client navigation) or of the prototype (a full page load). */
export function DestLink({ dest, className, children, ...rest }: { dest: Dest | null; className: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!dest) return <span aria-disabled="true" className={`${className} cursor-not-allowed opacity-50`}>{children}</span>;
  return dest.external
    ? <a href={dest.href} className={className} {...rest}>{children}</a>
    : <Link href={dest.href} className={className} {...rest}>{children}</Link>;
}

const PRIMARY = "bg-primary text-white";
const PLAIN = "border border-line bg-white text-navy";

/* ---------------- to-do list ---------------- */

export function TodoPanel({ todos }: { todos: Todo[] }) {
  const dot = (tone: Todo["tone"]) => (tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : "var(--primary)");
  return (
    // On wide screens the to-do list fills the height the key dates set, and scrolls inside it.
    <section aria-label="Your to-do list" style={CARD} className="flex max-h-[420px] flex-col overflow-hidden rounded-2xl bg-white lg:absolute lg:inset-0 lg:max-h-none">
      <div className="flex shrink-0 items-center justify-between border-b border-muted px-5 py-3.5">
        <h2 className="text-[15px] font-extrabold text-navy">Your to-do list</h2>
        {todos.length > 0 && <span style={{ color: "#92400E", background: "var(--warning-soft)" }} className="rounded-full px-2.5 py-0.5 text-[12px] font-bold">{todos.length} thing{todos.length === 1 ? "" : "s"} to do</span>}
      </div>
      {todos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft"><Check size={18} aria-hidden="true" className="text-success-ink" /></span>
          <p className="text-sm text-ink-soft">All clear. Nothing needs you right now.</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {todos.map((t, i) => (
            <li key={`${t.title}-${t.sub}`} className={`flex items-center gap-3.5 px-5 py-3 ${i ? "border-t border-muted" : ""}`}>
              <span aria-hidden="true" style={{ background: dot(t.tone) }} className="h-2.5 w-2.5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-navy">{t.title}</div>
                <div className="truncate text-[12.5px] text-ink-muted">{t.sub}</div>
              </div>
              <DestLink dest={t.dest} className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-bold hover:brightness-95 ${t.primary ? PRIMARY : PLAIN}`}>{t.cta}</DestLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- this conference's numbers ---------------- */

export interface Numbers { submitted: number; accepted: number; rejected: number; noDecision: number; registered: number; notRegistered: number; pending: number }

// Same order as the My Conferences author table: Submitted · Accepted · Rejected · No decision · then the accepted papers split by registration.
export function NumbersStrip({ n }: { n: Numbers }) {
  const items: Array<{ label: string; value: number; color?: string; sub?: boolean; warn?: boolean }> = [
    { label: "Submitted", value: n.submitted },
    { label: "Accepted", value: n.accepted, color: "var(--success-ink)" },
    { label: "Rejected", value: n.rejected, color: "var(--ink-soft)" },
    { label: "No Decision", value: n.noDecision, color: "var(--ink-soft)" },
    { label: "Registered", value: n.registered, color: "var(--success-ink)", sub: true },
    { label: "Not Registered", value: n.notRegistered, color: "var(--danger-ink)", sub: true },
    { label: "Registration Pending", value: n.pending, color: "var(--warning-ink)", sub: true, warn: true },
  ];
  return (
    <section aria-label="Your numbers for this conference" style={{ ...CARD, ...rise(1) }} className="hd-rise sub-strip flex overflow-hidden rounded-2xl bg-white">
      {items.map((it, i) => (
        <div
          key={it.label}
          style={{ borderLeft: i ? "1px solid var(--muted)" : "none", background: it.warn && it.value ? "var(--warning-soft)" : it.sub ? "rgba(238,242,255,0.45)" : "#FFFFFF" }}
          className="flex min-w-0 flex-1 basis-0 flex-col items-start justify-center gap-0.5 px-3.5 py-3"
        >
          {it.sub && <span className="text-[10px] font-bold uppercase leading-none tracking-wide text-ink-faint">Accepted</span>}
          <b style={{ color: it.value ? it.color || "var(--navy)" : "var(--border-strong)" }} className="text-xl leading-tight"><AnimatedNumber value={it.value} /></b>
          <span className="text-xs font-semibold leading-tight text-ink-muted">{it.label}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------------- finished conference: what you got from it ---------------- */

interface WrapItem { key: string; icon: LucideIcon; tone: string; bg: string; title: string; sub: string; cta: string; primary?: boolean; dest: Dest | null }

export function WrapUp({ acronym, flyerCount, presented, certificates = 0, feedbackDest, certificatesDest, flyerDest }: { acronym: string; flyerCount: number; presented: number; certificates?: number; feedbackDest: Dest | null; certificatesDest: Dest | null; flyerDest: Dest | null }) {
  // The first card reads the certificates the organisers have issued to this person; the second always asks (no stored feedback here).
  const items: WrapItem[] = [
    ...(!CERTIFICATES_ENABLED ? [] : [certificates > 0
      ? { key: "cert", icon: Award, tone: "var(--primary)", bg: "var(--primary-soft)", title: `${certificates} certificate${certificates === 1 ? "" : "s"} ready`, sub: "Download them any time. They were also sent to your email.", cta: `View certificate${certificates === 1 ? "" : "s"}`, primary: true, dest: certificatesDest }
      : { key: "cert", icon: Award, tone: "var(--ink-faint)", bg: "var(--muted)", title: "No certificate yet", sub: "The organisers haven't sent certificates yet.", cta: "Open certificates", dest: certificatesDest }]),
    ...(FEEDBACK_ENABLED ? [{ key: "feedback", icon: MessageSquare, tone: "var(--warning)", bg: "var(--warning-soft)", title: "How was it?", sub: "Tell the organisers in 2 minutes.", cta: "Give feedback", primary: true, dest: feedbackDest }] : []),
    ...(!FLYER_ENABLED ? [] : [{
      key: "flyer", icon: flyerCount ? ImageIcon : Mic, tone: "var(--cat-virtual)", bg: "var(--cat-virtual-soft)",
      title: presented ? `You presented ${presented} paper${presented === 1 ? "" : "s"}` : "Your flyer",
      sub: flyerCount ? "Your speaker flyer is still here to download and share." : "Flyers are made for registered papers.",
      cta: "Open flyer", dest: flyerDest,
    }]),
  ];
  return (
    <section aria-label="Wrap-up" className="hd-rise flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} aria-hidden="true" className="text-primary" />
        <h2 className="text-[15px] font-extrabold text-navy">{acronym} has finished</h2>
        {items.length > 0 && <span className="text-[13px] font-semibold text-ink-muted">· here&apos;s everything you got from it</span>}
      </div>
      <div className={`grid grid-cols-1 gap-3.5 ${items.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={it.key} style={{ ...CARD, ...rise(i + 1) }} className="hd-rise hd-lift flex flex-col gap-3 rounded-2xl bg-white p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden="true" style={{ background: it.bg, color: it.tone }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Icon size={18} /></span>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold leading-tight text-navy">{it.title}</div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{it.sub}</div>
                </div>
              </div>
              <DestLink dest={it.dest} className={`mt-auto inline-flex items-center gap-1 self-start rounded-lg px-3.5 py-2 text-[13px] font-bold hover:brightness-95 ${it.primary ? PRIMARY : PLAIN}`}>{it.cta} <ChevronRight size={14} aria-hidden="true" /></DestLink>
            </div>
          );
        })}
      </div>
    </section>
  );
}
