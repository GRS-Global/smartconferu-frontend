"use client";

import { BookOpen, Calendar, ExternalLink, FileText, Globe, Mail, MapPin, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { CountryFlag } from "@/components/ui/country-flag";
import { countryCodeOf } from "@/lib/country-codes";
import type { ConferenceDetails } from "@/types/author-submission";
import type { Conference } from "@/types/conference";
import { cityOf, monogram, rangeLabel } from "../format";

/* The conference details drawer (the prototype's DetailsDrawer): dates, venue, website, contact, About and Tracks, sliding
   in from the right. It is a modal <dialog>: focus stays inside, Esc and a click on the backdrop close it. The organisers'
   full call for papers (topics, guidelines, speakers, committees, sponsors) is not in the database, so, as in the
   prototype for a conference without one, the drawer says so. */

const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : "");

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-ink-faint"><Icon size={13} aria-hidden="true" /> {title.toUpperCase()}</h3>
      {children}
    </section>
  );
}

export function DetailsDrawer({ open, conference, details, tracks, onClose }: { open: boolean; conference: Conference; details: ConferenceDetails | null; tracks: string[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const country = details?.country ?? "";
  const place = [cityOf({ city: details?.city ?? "", country }), details?.state, country].filter(Boolean).join(", ");
  const web = safeUrl(details?.webPage ?? "");
  const contact = details?.contactEmail ?? "";
  const facts: Array<{ icon: LucideIcon; label: string; value: string; href?: string; flag?: boolean }> = [
    { icon: Calendar, label: "Conference dates", value: rangeLabel(conference) },
    ...(place ? [{ icon: MapPin, label: "Venue", value: place, flag: true }] : []),
    ...(web ? [{ icon: Globe, label: "Website", value: web.replace(/^https?:\/\//i, "").replace(/\/$/, ""), href: web }] : []),
    ...(contact ? [{ icon: Mail, label: "Contact", value: contact, href: `mailto:${contact}` }] : []),
  ];

  return (
    <dialog
      ref={ref}
      onClose={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label={`${conference.acronym} details`}
      className="m-0 ml-auto h-full max-h-none w-full max-w-[680px] border-0 bg-transparent p-0 backdrop:bg-slate-900/45"
    >
      {open && (
        <aside className="hd-drawer flex h-full w-full flex-col bg-white shadow-2xl">
          <div className="hd-hero relative flex items-start gap-4 border-b px-6 py-5" style={{ borderColor: "var(--banner-border)" }}>
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-base font-extrabold text-primary shadow-[0_2px_10px_rgba(124,58,237,0.15)]">{monogram(conference.acronym)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold leading-tight text-navy" style={{ letterSpacing: "-0.02em" }}>{conference.acronym}</div>
              <div className="text-[13px] leading-snug text-ink-soft">{conference.name}</div>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-white/70"><X size={18} aria-hidden="true" /></button>
          </div>
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-2.5">
              {facts.map((f) => {
                const Icon = f.icon;
                const body = (
                  <>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-ink-faint"><Icon size={12} aria-hidden="true" /> {f.label}</span>
                    <span className={`flex items-center gap-1.5 break-words text-[13px] font-bold leading-snug ${f.href ? "text-primary" : "text-navy"}`}>
                      {f.flag && <CountryFlag code={countryCodeOf(country)} />}{f.value}{f.href && <ExternalLink size={11} aria-hidden="true" className="shrink-0" />}
                    </span>
                  </>
                );
                const cls = "flex flex-col gap-1 rounded-xl border border-line bg-canvas p-3";
                return f.href
                  ? <a key={f.label} href={f.href} target="_blank" rel="noreferrer noopener" className={`${cls} hover:border-primary`}>{body}</a>
                  : <div key={f.label} className={cls}>{body}</div>;
              })}
            </div>
            <Section icon={BookOpen} title="About"><p className="text-[13.5px] leading-relaxed text-ink">{conference.name}</p></Section>
            {tracks.length > 0 && (
              <Section icon={FileText} title="Tracks">
                <div className="flex flex-wrap gap-1.5">{tracks.map((t) => <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-[12.5px] font-semibold text-ink-soft">{t}</span>)}</div>
              </Section>
            )}
            <p className="text-[13px] text-ink-faint">The organisers haven&apos;t published a full call for papers for this conference.</p>
          </div>
        </aside>
      )}
    </dialog>
  );
}
