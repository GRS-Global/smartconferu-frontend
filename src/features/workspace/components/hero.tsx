import { Calendar, Clock, Globe, Info, type LucideIcon } from "lucide-react";
import { createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CountryFlag } from "@/components/ui/country-flag";
import { cityOf, monogram, rangeLabel } from "@/features/author/format";
import { countryCodeOf } from "@/lib/country-codes";
import type { Conference } from "@/types/conference";
import type { ConferenceDetails } from "@/types/author-submission";

/* One header design for the workspace pages — the prototype's PageHero / ConferenceHero (src/author-module/ConferenceParts.jsx):
   a tinted wash, dot grid, drifting glows and a shine, a gradient tile on the left, the big title with its status pill, fact
   chips and the page's buttons on the right. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const rise = (i: number) => ({ animationDelay: `${Math.min(i, 10) * 60}ms` });

interface PageHeroProps { /** The page title is the h2 under the page header's h1; a page without a PageHeader passes 1. */ level?: 1 | 2; tile: ReactNode; title: string; badge?: ReactNode; subtitle?: ReactNode; chips?: ReactNode; actions?: ReactNode; /** Full-width content under everything (a progress timeline). */ footer?: ReactNode; label?: string; /** Put the buttons under the chips (a long title), not beside them. */ actionsBelow?: boolean }

export function PageHero({ level = 2, tile, title, badge, subtitle, chips, actions, footer, label = "Page header", actionsBelow = false }: PageHeroProps) {
  return (
    <section aria-label={label} style={{ ...CARD, ...rise(0) }} className="hd-rise hd-shine ui-accent-card hd-hero flex flex-wrap items-center gap-5 rounded-2xl px-5 py-6 sm:gap-6 sm:px-8 sm:py-8">
      <span aria-hidden="true" className="hd-grid" />
      <span aria-hidden="true" className="hd-orb hd-orb-a" />
      <span aria-hidden="true" className="hd-orb hd-orb-b" />
      <div aria-hidden="true" style={{ background: "var(--primary)" }} className="hd-float flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-[22px] text-[28px] font-extrabold text-white shadow-[0_12px_28px_rgba(124,58,237,0.32)]">{tile}</div>
      <div className="min-w-0 flex-1 basis-[240px]">
        <div className="flex flex-wrap items-center gap-2">
          {createElement(`h${level}`, { className: "text-[28px] font-extrabold leading-tight text-navy", style: { letterSpacing: "-0.02em" } }, title)}
          {badge}
        </div>
        {subtitle && <div className="mt-0.5 text-[15px] leading-snug text-ink-soft">{subtitle}</div>}
        {chips && <div className="mt-3.5 flex flex-wrap items-center gap-2">{chips}</div>}
        {actions && actionsBelow && <div className="mt-4 flex max-w-full flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
      {actions && !actionsBelow && <div className="flex max-w-full flex-wrap items-center gap-2.5">{actions}</div>}
      {footer && <div style={{ borderTop: "1px solid var(--banner-border)" }} className="-mb-2 w-full pt-5">{footer}</div>}
    </section>
  );
}

/** A fact chip on the header's wash. */
export function HeroChip({ icon: Icon, children, tone }: { icon?: LucideIcon; children: ReactNode; tone?: string }) {
  return <span style={tone ? { color: tone } : undefined} className={`hd-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${tone ? "" : "text-ink"}`}>{Icon && <Icon size={13} aria-hidden="true" />} {children}</span>;
}

const BTN_PRIMARY = "inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-bold text-white transition-shadow enabled:hover:shadow-[0_0_24px_rgba(124,58,237,0.35)] disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PLAIN = "inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-5 text-[14px] font-bold text-navy transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

/** The header's buttons: `primary` is the filled one, otherwise white with a border. */
export function HeroButton({ icon: Icon, primary = false, children, ...rest }: { icon?: LucideIcon; primary?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...rest} className={primary ? BTN_PRIMARY : BTN_PLAIN}>{Icon && <Icon size={15} aria-hidden="true" />} {children}</button>;
}

/** The same look for a link (a page of this app or of the prototype). */
export function HeroLink({ icon: Icon, href, primary = false, children }: { icon?: LucideIcon; href: string; primary?: boolean; children: ReactNode }) {
  return <a href={href} className={primary ? BTN_PRIMARY : BTN_PLAIN}>{Icon && <Icon size={15} aria-hidden="true" />} {children}</a>;
}

/** The green "Active" / grey "Archived" pill that sits after a conference's name. */
export function ConferenceStatusPill({ conference }: { conference: Pick<Conference, "status"> }) {
  const finished = conference.status === "archived";
  return (
    <span style={finished ? undefined : { color: "#15803D", background: "var(--success-soft)" }} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${finished ? "bg-muted text-ink-soft" : ""}`}>
      {!finished && <span className="relative h-1.5 w-1.5"><span className="hd-ping absolute inset-0 rounded-full bg-success" /><span className="absolute inset-0 rounded-full bg-success" /></span>}
      {finished ? "Archived" : "Active"}
    </span>
  );
}

export function DeadlineChip({ deadline }: { deadline: { open: boolean; text: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${deadline.open ? "bg-primary-soft text-primary-hover" : "bg-muted text-ink-muted"}`}>
      <Clock size={13} aria-hidden="true" /> {deadline.text}
    </span>
  );
}

interface ConferenceHeroProps { conference: Conference; details: ConferenceDetails | null; onDetails: () => void; extraChip?: ReactNode; children?: ReactNode }

/** The conference card: its acronym and name, dates, place, website, and the role's own buttons next to "Conference details". */
export function ConferenceHero({ conference, details, onDetails, extraChip, children }: ConferenceHeroProps) {
  const country = details?.country ?? "";
  const place = [cityOf({ city: details?.city ?? "", country }), country].filter(Boolean).join(", ");
  const web = details?.webPage ?? "";
  return (
    <PageHero
      label="Conference"
      tile={monogram(conference.acronym)}
      title={conference.acronym}
      badge={<ConferenceStatusPill conference={conference} />}
      subtitle={conference.name}
      chips={(
        <>
          <HeroChip icon={Calendar}>{rangeLabel(conference)}</HeroChip>
          {place && <span className="hd-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-ink"><CountryFlag code={countryCodeOf(country)} /> {place}</span>}
          {extraChip}
          {/^https?:\/\//i.test(web) && (
            <a href={web} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[12.5px] font-semibold text-primary hover:border-primary"><Globe size={13} aria-hidden="true" /> {web.replace(/^https?:\/\//i, "").replace(/\/$/, "")}</a>
          )}
        </>
      )}
      actions={(
        <>
          <HeroButton icon={Info} onClick={onDetails}>Conference details</HeroButton>
          {children}
        </>
      )}
    />
  );
}
