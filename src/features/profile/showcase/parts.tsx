"use client";

import { BadgeCheck, ChevronDown, Clock, MapPin, Pencil, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BRAND_COLORS, BRAND_ICON_PATHS, BRAND_ICON_VIEWBOX } from "@/lib/brand-icons";
import { cn } from "@/lib/cn";
import type { Affiliation, PastAffiliation, Profile } from "@/types/profile";
import type { LinkField } from "../fields";
import { affiliationPeriod, affiliationRelationshipLabel, entryDuration, orgMonogram, pastAffiliationPeriod } from "./helpers";

export const VERIFIED_GREEN = "#15803D";
export const PENDING_AMBER = "#B45309";

/* ---------- avatar ---------- */

/** The default avatar: a silhouette tile with the initials (or a plain person when there is no name yet), or the
 *  neutral / male / female illustration when the profile chose one (avatarStyle). */
export function DefaultAvatar({ variant = "initials", size = 40, initials = "" }: { variant?: string; size?: number; initials?: string }) {
  if (variant === "initials") {
    const blank = !initials || initials === "?";
    return (
      <span aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: "#E2E8F0", color: blank ? "#94A3B8" : "#334155", letterSpacing: "0.02em" }} className="inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none">
        {blank ? (
          <svg width="100%" height="100%" viewBox="0 0 64 64" className="block"><circle cx="32" cy="25" r="11" fill="currentColor" /><path d="M12 58c1.5-11 9.5-18 20-18s18.5 7 20 18z" fill="currentColor" /></svg>
        ) : initials}
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="block shrink-0">
      <circle cx="32" cy="32" r="32" fill="var(--primary-soft)" />
      {variant === "female" && <path d="M18 30c0-11 6-18 14-18s14 7 14 18v13c-3 2-7 3-10 3h-8c-3 0-7-1-10-3z" fill="var(--navy)" />}
      <path d="M11 64c2-12 10-19 21-19s19 7 21 19z" fill="var(--primary)" />
      <circle cx="32" cy="28" r="11" fill="var(--primary)" opacity="0.85" />
      {variant === "male" && <path d="M20.5 26c0-8 5-13.5 11.5-13.5S43.5 18 43.5 26c-2.5-3.5-6.5-5.5-11.5-5.5S23 22.5 20.5 26z" fill="var(--navy)" />}
      {variant === "female" && <path d="M21 25c1-7 5.5-11 11-11s10 4 11 11c-4-2-7-5-8-8-2 4-7 7-14 8z" fill="var(--navy)" />}
    </svg>
  );
}

/** The uploaded photo, else the default avatar — from real data only. */
export function UserAvatar({ profile, size = 36 }: { profile: Pick<Profile, "photo" | "photoUrl" | "avatarStyle" | "firstName" | "lastName">; size?: number }) {
  if (profile.photo && profile.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a user-uploaded Supabase Storage URL
    return <img src={profile.photoUrl} alt="" style={{ width: size, height: size }} className="block shrink-0 rounded-full object-cover" />;
  }
  const initials = `${profile.firstName.trim()[0] ?? ""}${profile.lastName.trim()[0] ?? ""}`.toUpperCase();
  return <DefaultAvatar variant={profile.avatarStyle || "initials"} size={size} initials={initials} />;
}

/* ---------- buttons ---------- */

export function EditIconButton({ onClick, label = "Edit", icon: Icon = Pencil, size = 32 }: { onClick: () => void; label?: string; icon?: LucideIcon; size?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-white text-ink-muted transition-colors hover:border-primary-soft-border hover:bg-primary-soft hover:text-primary">
      <Icon size={Icon === Pencil ? 13 : 15} aria-hidden="true" />
    </button>
  );
}

/** The round header actions (share / settings) with a tooltip. */
export function ProfileIconAction({ icon: Icon, label, hint, onClick, href, primary = false, size = 40 }: { icon: LucideIcon; label: string; hint?: string; onClick?: () => void; href?: string; primary?: boolean; size?: number }) {
  const className = cn("inline-flex items-center justify-center rounded-full transition-colors", primary ? "bg-primary text-white shadow-[0_6px_14px_-6px_rgba(124,58,237,0.6)] hover:bg-primary-hover" : "border border-line bg-white text-ink-soft hover:border-primary-soft-border hover:bg-primary-soft hover:text-primary");
  const icon = <Icon size={size >= 40 ? 18 : 15} strokeWidth={2.1} aria-hidden="true" />;
  return (
    <span className="group relative inline-flex">
      {href ? (
        <a href={href} aria-label={label} style={{ width: size, height: size }} className={className}>{icon}</a>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} style={{ width: size, height: size }} className={className}>{icon}</button>
      )}
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-max max-w-[240px] translate-y-1 rounded-lg bg-navy px-3 py-2 text-left opacity-0 shadow-lg transition-all duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
        <span className="block text-xs font-bold text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-[#CBD5E1]">{hint}</span>}
      </span>
    </span>
  );
}

/* ---------- brand marks ---------- */

export function BrandIcon({ field, size = 32, connected = true, title }: { field: LinkField; size?: number; connected?: boolean; title?: string }) {
  const path = BRAND_ICON_PATHS[field.key];
  return (
    <span
      title={title || (connected ? field.label : `${field.label} — not connected`)}
      style={{ width: size, height: size, color: connected ? BRAND_COLORS[field.key] : "var(--ink-faint)", opacity: connected ? 1 : 0.65 }}
      className={cn("flex shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold", connected ? "border-line bg-white" : "border-muted bg-canvas")}
    >
      {path && (
        <svg viewBox={BRAND_ICON_VIEWBOX[field.key] || "0 0 24 24"} width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} fill="currentColor" aria-hidden="true"><path d={path} /></svg>
      )}
    </span>
  );
}

/* ---------- cards and rows ---------- */

/** One card anatomy for every section: title row + hairline + round actions, 12px radius. */
export function ProfileSectionCard({ id, title, actions, children }: { id: string; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} style={{ scrollMarginTop: 128 }} className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex min-h-16 items-center justify-between gap-3 border-b border-muted px-5 py-3.5 sm:px-7">
        <h2 id={`${id}-heading`} className="text-[17px] font-bold text-navy">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="px-5 pb-2 pt-1 sm:px-7">{children}</div>
    </section>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <p className="py-5 text-sm text-ink-muted">{children}</p>;
}

export function ProfileEntryRow({ icon: Icon, first, children }: { icon: LucideIcon; first: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex gap-4 py-5", !first && "border-t border-muted")}>
      <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-ink-muted"><Icon size={22} strokeWidth={1.7} /></div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ShowMore({ open, count, noun, controls, onToggle }: { open: boolean; count: number; noun: string; controls: string; onToggle: () => void }) {
  return (
    <div className="-mx-5 flex justify-center border-t border-muted px-5 pb-1.5 pt-3 sm:-mx-7 sm:px-7">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={controls} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas">
        {open ? "Show less" : `Show all ${count} ${noun}`}
        <ChevronDown size={14} aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}

/** A society's logo, or its acronym when it has none (56×40, so a list of memberships lines up). */
export function OrgMonogram({ org, acronym, logo }: { org: string; acronym?: string; logo?: string }) {
  if (logo) {
    return (
      <div aria-hidden="true" className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white px-1.5 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small static logo from /public */}
        <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  const text = acronym || orgMonogram(org);
  const twoLine = text.includes(" ");
  return (
    <div aria-hidden="true" className={cn("flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-canvas font-bold leading-none tracking-tight text-navy", twoLine ? "gap-px text-[10px]" : text.length > 3 ? "text-[11px]" : "text-[13px]")}>
      {twoLine ? text.split(" ").map((w) => <span key={w}>{w}</span>) : text}
    </div>
  );
}

/** One affiliation on the timeline: an initials tile, the name with its pills, the department, then location · dates · duration. */
export function AffiliationTimelineRow({ a, current, last, showPrimary, owner }: { a: Affiliation | (PastAffiliation & { primary?: boolean; pending?: boolean; departmentPending?: boolean; rejectReason?: string }); current: boolean; last: boolean; showPrimary: boolean; owner: boolean }) {
  const period = current ? affiliationPeriod(a) : pastAffiliationPeriod(a as PastAffiliation);
  const duration = entryDuration(current ? { ...a, endMonth: "", endYear: "", current: true } : { ...a, endMonth: (a as PastAffiliation).endMonth ?? "", endYear: (a as PastAffiliation).endYear ?? "" });
  const meta = [period, duration].filter(Boolean).join(" · ");
  const pill = "align-middle text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap";
  const relationship = affiliationRelationshipLabel(a);
  return (
    <li className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-4">
      {!last && <span aria-hidden="true" className="absolute bottom-[-6px] left-[19.5px] top-[48px] w-px bg-line" />}
      <div aria-hidden="true" className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg border text-[12px] font-extrabold tracking-tight", current ? "border-primary-soft-border bg-primary-soft text-primary" : "border-line bg-canvas text-ink-muted")}>
        {orgMonogram(a.institution)}
      </div>
      <div className={cn("min-w-0", last ? "pb-1" : "pb-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className={cn("min-w-0 text-[15px] font-semibold leading-snug", current ? "text-navy" : "text-ink-soft")}>
            <span className="mr-2">{a.institution}</span>
            {showPrimary && <span className={`${pill} mr-1.5 bg-primary-soft font-bold text-primary`}>Primary</span>}
            {relationship && <span className={`${pill} mr-1.5 bg-muted text-ink-soft`}>{relationship}</span>}
            {owner && current && a.pending && <span title="Our team is checking this institution's official name" style={{ color: PENDING_AMBER }} className="inline-flex items-center gap-1 align-middle text-xs font-semibold"><Clock size={12} strokeWidth={2.2} aria-hidden="true" /> Pending review</span>}
            {owner && current && a.rejectReason && !a.pending && <span className="ml-1 text-xs font-semibold text-danger">Not accepted: {a.rejectReason}</span>}
          </div>
          {current ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11.5px] font-bold text-[#15803D]"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" /> Current</span>
          ) : (
            <span className="shrink-0 pt-0.5 text-[11.5px] font-semibold text-ink-muted">Past</span>
          )}
        </div>
        {a.department && (
          <div className={cn("mt-0.5 text-sm", current ? "text-[#334155]" : "text-ink-muted")}>
            {a.department}
            {owner && current && a.departmentPending && <span title="Our team is verifying this department" style={{ color: PENDING_AMBER }} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold"><Clock size={12} strokeWidth={2.2} aria-hidden="true" /> Pending review</span>}
          </div>
        )}
        {(a.location || meta) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-ink-muted">
            {a.location && <span className="inline-flex items-center gap-1"><MapPin size={12} className="shrink-0" aria-hidden="true" /> {a.location}</span>}
            {a.location && meta && <span aria-hidden="true">·</span>}
            {meta && <span>{meta}</span>}
          </div>
        )}
      </div>
    </li>
  );
}

export function VerifyStatus({ status }: { status: string }) {
  if (status === "verified") return <span style={{ color: VERIFIED_GREEN }} className="inline-flex items-center gap-1 text-xs font-semibold"><BadgeCheck size={13} strokeWidth={2.4} aria-hidden="true" /> Verified</span>;
  if (status === "pending" || status === "new") return <span style={{ color: PENDING_AMBER }} className="inline-flex items-center gap-1 text-xs font-semibold"><Clock size={13} strokeWidth={2.2} aria-hidden="true" /> Not verified</span>;
  return null;
}

/** An edit pencil that is simply absent on a read-only view (the public profile). */
export function EditIf({ show, ...props }: { show: boolean } & Parameters<typeof EditIconButton>[0]) {
  return show ? <EditIconButton {...props} /> : null;
}
