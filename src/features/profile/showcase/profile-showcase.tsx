"use client";

import { VerifyProfile } from "../components/verify-profile";
import { useMasterDataVersion } from "@/lib/master-data";
import { BadgeCheck, Briefcase, Building2, Calendar, Check, ChevronRight, ExternalLink, Globe2, GraduationCap, Layers, MapPin, Plus, Settings, Share2, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { CountryFlag } from "@/components/ui/country-flag";
import { countryCodeOf } from "@/lib/country-codes";
import { cn } from "@/lib/cn";
import { FEATURED_SOCIETY_COUNT, FEATURED_SOCIETY_IDS, SOCIETIES } from "@/lib/societies";
import type { Profile } from "@/types/profile";
import { PROFESSIONAL_FIELDS, SCHOLAR_FIELDS, profileLinkHref, type LinkField } from "../fields";
import { profileAffiliations } from "../affiliations";
import { ContactCard } from "./contact-card";
import {
  affiliationRelationshipLabel, formatEntryPeriod, formatLocation, membershipPending, membershipSociety, profileEmails, withEntryDates,
} from "./helpers";
import {
  AffiliationTimelineRow, BrandIcon, EditIf, EmptyText, OrgMonogram, ProfileEntryRow, ProfileIconAction, ProfileSectionCard, ShowMore, UserAvatar, VERIFIED_GREEN,
} from "./parts";

interface Fact {
  key: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub: string;
  wide?: boolean;
}

export interface ShowcaseEdit {
  settings: () => void;
  intro: () => void;
  photo: () => void;
  links: () => void;
  about: () => void;
  affiliation: () => void;
  phone: () => void;
  address: () => void;
  experience: () => void;
  education: () => void;
  memberships: () => void;
  /** A greyed header chip was clicked: open Add membership on that society. */
  addSociety: (id: string) => void;
  emails: () => void;
  share: () => void;
  /** The round "+" beside a list's pencil: the same editor, scrolled to its Add form. */
  add: (kind: "experience" | "education" | "membership") => void;
}

const SECTIONS: Array<[string, string]> = [
  ["sec-about", "About"], ["sec-affiliation", "Affiliation"], ["sec-experience", "Experience"], ["sec-education", "Education"], ["sec-memberships", "Memberships"],
];

/** My Profile as the prototype's showcase: header card (photo, name, facts, memberships, "Find me on"), a sticky
 *  section nav, the About / Affiliation / Experience / Education / Memberships cards, and the private contact card.
 *  Everything shown is read from the profile; each card's pencil opens its editor. */
export function ProfileShowcase({ profile, edit, readOnly = false }: { profile: Profile; edit: ShowcaseEdit; readOnly?: boolean }) {
  useMasterDataVersion(); // render again when the Super Admin's lists arrive from the backend
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const timeline = profile.timeline.map(withEntryDates);
  const exp = timeline.filter((x) => x.type === "experience");
  const edu = timeline.filter((x) => x.type === "education");
  const mems = timeline.filter((x) => x.type === "membership");
  const headerMems = mems.filter((x) => x.current && !membershipPending(x));
  /* Header chips: the best-known societies - lit when joined, "Ended" when it has ended, greyed out (click to add) when not on the profile -
     and "+N more" for the rest. All of it is read from the profile, so it follows every edit. */
  const featured = FEATURED_SOCIETY_IDS.map((id) => SOCIETIES.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x)).slice(0, FEATURED_SOCIETY_COUNT);
  const endedOf = (socId: string) => mems
    .filter((e) => !e.current && !membershipPending(e) && membershipSociety(e)?.id === socId)
    .sort((x, y) => Number(y.endYear || 0) - Number(x.endYear || 0))[0] ?? null;
  const memChips = featured.filter((soc) => !readOnly || headerMems.some((e) => membershipSociety(e)?.id === soc.id)).map((soc) => {
    const entry = headerMems.find((e) => membershipSociety(e)?.id === soc.id) ?? null;
    return { key: soc.id, soc, entry, ended: entry ? null : endedOf(soc.id) };
  });
  const shownMemIds = new Set(memChips.filter((c) => c.entry).map((c) => c.entry!.id));
  const moreMems = headerMems.filter((e) => !shownMemIds.has(e.id)).length;
  const showMems = !readOnly || headerMems.length > 0;

  const affs = profileAffiliations(profile);
  const otherAffs = affs.slice(1);
  const pastAffs = profile.pastAffiliations;
  const affLocation = formatLocation(profile);
  const interests = profile.researchInterests;
  const websiteLabel = profile.webPage.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const [more, setMore] = useState<Record<string, boolean>>({});
  const toggleMore = (key: string) => setMore((m) => ({ ...m, [key]: !m[key] }));
  const shown = <T,>(key: string, list: T[], limit: number) => (more[key] || list.length <= limit ? list : list.slice(0, limit));

  // One profile-level trust signal: "Verified researcher" only when the stored profile says an identity was verified
  // (ORCID verified by signing in, or a verified institutional email).
  const emails = profileEmails(profile).emails;
  const trustReasons = [
    profile.orcidId && profile.verifiedProfiles.orcidId && "ORCID iD verified by signing in",
    emails.professional.status === "verified" && emails.professional.value && "Institutional email verified",
    profile.profileVerification?.status === "verified" && "Profile verified by our team",
  ].filter((x): x is string => Boolean(x));
  const [trustOpen, setTrustOpen] = useState(false);

  // Sticky jump-nav with scroll-spy; once stuck under the 64px app bar a mini avatar + name appears in it.
  const navRef = useRef<HTMLDivElement>(null);
  const [activeSec, setActiveSec] = useState(SECTIONS[0][0]);
  const [navStuck, setNavStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const nav = navRef.current;
      if (!nav) return;
      setNavStuck(nav.getBoundingClientRect().top <= 64.5 && window.scrollY > 0);
      const line = 64 + nav.offsetHeight + 24;
      let cur = SECTIONS[0][0];
      SECTIONS.forEach(([id]) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = SECTIONS[SECTIONS.length - 1][0];
      setActiveSec(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const first = requestAnimationFrame(onScroll);
    return () => { cancelAnimationFrame(first); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  const jumpTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const bar = navRef.current ? navRef.current.offsetHeight : 52;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64 - bar - 16, behavior: "smooth" });
    setActiveSec(id);
  };

  const linkIcons = (fields: LinkField[]): ReactNode => fields.map((f) => {
    const value = profile[f.key];
    const status = profile.verifiedProfiles[f.key] ? "Verified" : profile.confirmedProfiles[f.key] ? "Confirmed by owner" : "";
    const label = [f.label, status].filter(Boolean).join(" · ");
    return value ? (
      <a key={f.key} href={profileLinkHref(f, value)} target="_blank" rel="noreferrer" aria-label={label} className="rounded-lg transition-transform hover:-translate-y-0.5">
        <BrandIcon field={f} size={32} connected title={label} />
      </a>
    ) : (
      <BrandIcon key={f.key} field={f} size={32} connected={false} />
    );
  });

  const facts: Fact[] = [];
  if (profile.affiliation) {
    facts.push({
      key: "org", icon: Building2, label: "Institution", wide: true,
      value: (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-navy">{profile.affiliation}</span>
          {affLocation && <span className="inline-flex items-center gap-1 text-[13px] text-ink-muted"><span aria-hidden="true">·</span><MapPin size={12} className="shrink-0" aria-hidden="true" /> {affLocation}</span>}
        </span>
      ),
      sub: profile.affiliationDepartment,
    });
  } else if (affLocation) {
    facts.push({ key: "loc", icon: MapPin, label: "Location", value: affLocation, sub: "" });
  }
  if (otherAffs.length > 0) {
    facts.push({
      key: "also", icon: Layers, label: "Also at",
      value: (
        <a href="#sec-affiliation" onClick={jumpTo("sec-affiliation")} className="hover:text-primary">
          {otherAffs[0].institution}
          {otherAffs.length > 1 && <span className="font-semibold text-primary"> +{otherAffs.length - 1}</span>}
        </a>
      ),
      sub: affiliationRelationshipLabel(otherAffs[0]),
    });
  }
  if (profile.memberSince) facts.push({ key: "since", icon: Calendar, label: "Member since", value: profile.memberSince, sub: "" });

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Header card ---- */}
      <section aria-label="Profile summary" className="overflow-hidden rounded-t-xl border border-b-0 border-line bg-white">
        <div className="flex flex-wrap items-start gap-5 px-5 pb-5 pt-6 sm:gap-8 sm:px-11 sm:pb-6 sm:pt-9">
          <div className="relative shrink-0">
            <UserAvatar profile={profile} size={112} />
            {!readOnly && (
              <button type="button" onClick={edit.photo} aria-label="Update profile photo" title="Update profile photo" className="absolute bottom-0 right-0 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-line bg-white text-ink-muted shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:border-line-strong hover:text-primary">
                <CameraIcon />
              </button>
            )}
          </div>

          <div className="min-w-0" style={{ flex: "1 1 420px" }}>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight text-navy sm:text-[32px]">{fullName || profile.mainEmail}</h1>
              {trustReasons.length > 0 && (
                <span className="relative -ml-1 shrink-0">
                  <button type="button" onClick={() => setTrustOpen((o) => !o)} onBlur={() => setTrustOpen(false)} aria-label="Verified researcher — see details" aria-expanded={trustOpen} title="Verified researcher" style={{ color: VERIFIED_GREEN }} className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-success-soft">
                    <BadgeCheck size={22} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                  {trustOpen && (
                    <div role="tooltip" className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-xl border border-line bg-white p-3.5 shadow-pop">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-navy"><BadgeCheck size={16} style={{ color: VERIFIED_GREEN }} aria-hidden="true" /> Verified researcher</div>
                      <ul className="mt-2 space-y-1">
                        {trustReasons.map((r) => <li key={r} className="flex items-start gap-1.5 text-[13px] leading-snug text-ink-soft"><Check size={13} strokeWidth={2.5} style={{ color: VERIFIED_GREEN }} className="mt-0.5 shrink-0" aria-hidden="true" /> {r}</li>)}
                      </ul>
                      <p className="mt-2.5 text-xs leading-normal text-ink-muted">Checked by Smartconferu, not self-declared.</p>
                    </div>
                  )}
                </span>
              )}
              {profile.country && countryCodeOf(profile.country) && (
                <span title={profile.country} className="shrink-0 rounded-[2px] leading-none shadow-[0_0_0_1px_var(--border)]"><CountryFlag code={countryCodeOf(profile.country)} size={16} /></span>
              )}
            </div>
            {profile.designation && <p className="mt-1.5 text-[17px] font-medium leading-normal text-[#334155]">{profile.designation}</p>}
            {!readOnly && <VerifyProfile profile={profile} />}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <EditIf show={!readOnly} onClick={edit.intro} label="Edit intro" size={36} />
            <ProfileIconAction icon={Share2} label="Share profile" hint="Copy your profile link, show a QR code or download your contact card." onClick={edit.share} />
            {!readOnly && <ProfileIconAction icon={Settings} label="Security & Settings" hint="Password, notifications and display." onClick={edit.settings} primary />}
          </div>
        </div>

        {/* Key facts: one full-width strip under the photo, name and actions. */}
        {facts.length > 0 && (
          <ul className="mx-5 mb-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:mx-11 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,0.8fr)]">
            {facts.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.key} className={cn("flex min-w-0 items-start gap-3", f.wide && "sm:col-span-2 lg:col-span-1")}>
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon size={17} strokeWidth={1.9} /></span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase leading-4 tracking-wider text-ink-muted">{f.label}</div>
                    <div className="mt-0.5 break-words text-sm leading-snug text-[#334155]">{f.value}</div>
                    {f.sub && <div className="mt-0.5 text-xs leading-snug text-ink-muted">{f.sub}</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Credentials panel: memberships (left) and "Find me on" (right). */}
        <div className={cn("mx-5 mb-6 grid rounded-xl border border-line bg-canvas sm:mx-11", showMems && "lg:grid-cols-[minmax(0,1fr)_auto]")}>
          {showMems && (
            <div className="min-w-0 px-5 py-4">
              <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Memberships
                {headerMems.length > 0 && <span className="rounded-full border border-line bg-white px-1.5 text-[10.5px] font-bold normal-case tracking-normal text-ink-soft">{headerMems.length}</span>}
              </div>
              <ul aria-label="Professional memberships" className="flex flex-wrap gap-2">
                {memChips.map(({ key, soc, entry, ended }) => {
                  const mark = soc.acronym;
                  const logo = (grey: boolean) => (
                    <span className={cn("inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1", grey ? "bg-muted" : "bg-canvas")}>
                      {soc.logo
                        // eslint-disable-next-line @next/next/no-img-element -- a small static logo from /public
                        ? <img src={soc.logo} alt="" aria-hidden="true" style={grey ? { filter: "grayscale(1)", opacity: 0.55 } : undefined} className="h-3.5 w-auto max-w-[1.75rem] object-contain" />
                        : <span className="text-[9px] font-extrabold text-primary">{mark.slice(0, 3)}</span>}
                    </span>
                  );
                  if (!entry && ended) {
                    return (
                      <li key={key} className="min-w-0 max-w-full">
                        <a href="#sec-memberships" data-society={soc.id} data-joined="ended" onClick={jumpTo("sec-memberships")} title={`${soc.name} · ${ended.title} · ${[ended.startYear, ended.endYear].filter(Boolean).join(" – ")} (ended)`} className="inline-flex h-8 max-w-full items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white pl-2 pr-3 text-[12.5px] transition-all hover:border-primary-soft-border">
                          {logo(false)}
                          <span className="shrink-0 font-bold text-navy">{mark}</span>
                          <span aria-hidden="true" className="h-3.5 w-px shrink-0 bg-line" />
                          <span className="truncate font-medium text-ink-muted">Ended{ended.endYear ? ` ${ended.endYear}` : ""}</span>
                        </a>
                      </li>
                    );
                  }
                  if (!entry) {
                    return (
                      <li key={key} className="min-w-0 max-w-full">
                        <button type="button" onClick={() => edit.addSociety(soc.id)} data-society={soc.id} data-joined="false" title={`${soc.name} — not on your profile yet. Click to add it.`} aria-label={`${soc.acronym}: not added. Add your ${soc.acronym} membership`} className="inline-flex h-8 max-w-full items-center gap-2 whitespace-nowrap rounded-lg border border-dashed border-line-strong bg-transparent pl-2 pr-2.5 text-[12.5px] text-ink-muted transition-all hover:border-primary-soft-border hover:text-primary">
                          {logo(true)}
                          <span className="shrink-0 font-bold">{mark}</span>
                          <Plus size={12} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key={key} className="min-w-0 max-w-full">
                      <a href="#sec-memberships" data-society={soc.id} data-joined="true" onClick={jumpTo("sec-memberships")} title={`${soc.name} · ${entry.title}${entry.startYear ? ` · since ${entry.startYear}` : ""}`} className="inline-flex h-8 max-w-full items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white pl-2 pr-3 text-[12.5px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-px hover:border-primary-soft-border">
                        {logo(false)}
                        <span className="shrink-0 font-bold text-navy">{mark}</span>
                        <span aria-hidden="true" className="h-3.5 w-px shrink-0 bg-line" />
                        <span className="truncate font-medium text-ink-soft">{entry.title}</span>
                      </a>
                    </li>
                  );
                })}
                {moreMems > 0 && (
                  <li className="min-w-0"><a href="#sec-memberships" onClick={jumpTo("sec-memberships")} className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-line bg-white px-3 text-[12.5px] font-bold text-primary transition-colors hover:border-primary-soft-border hover:bg-primary-soft">+{moreMems} more</a></li>
                )}
                {/* Any other society (not one of the featured chips): opens Memberships on its Add form, as the section's own "+" does. */}
                {!readOnly && (
                  <li className="min-w-0">
                    <button type="button" onClick={() => edit.add("membership")} title="Add a membership of another society" aria-label="Add another membership" className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-line-strong bg-transparent px-3 text-[12.5px] font-bold text-ink-muted transition-all hover:border-primary-soft-border hover:text-primary">
                      <Plus size={12} strokeWidth={2.5} className="shrink-0" aria-hidden="true" /> Other
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div role="group" aria-label="Find me on" className={cn("px-5 py-4", showMems && "border-t border-line lg:border-l lg:border-t-0")}>
            <div className="mb-2.5 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Find me on
              <span className="-my-1.5 normal-case tracking-normal"><EditIf show={!readOnly} onClick={edit.links} label="Edit social & profile links" /></span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div role="group" aria-label="Scholar profiles" className="flex items-center gap-3">
                <span className="w-[84px] shrink-0 text-xs font-semibold text-ink-soft">Scholar</span>
                <div className="flex flex-wrap gap-1.5">{linkIcons(SCHOLAR_FIELDS)}</div>
              </div>
              <div role="group" aria-label="Professional profiles" className="flex items-center gap-3">
                <span className="w-[84px] shrink-0 text-xs font-semibold text-ink-soft">Professional</span>
                <div className="flex flex-wrap gap-1.5">{linkIcons(PROFESSIONAL_FIELDS)}</div>
              </div>
              {websiteLabel && (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-[84px] shrink-0 text-xs font-semibold text-ink-soft">Website</span>
                  <a href={profile.webPage} target="_blank" rel="noreferrer" title={profile.webPage} className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[13px] font-semibold text-primary transition-colors hover:border-primary-soft-border hover:bg-primary-soft">
                    <Globe2 size={14} className="shrink-0" aria-hidden="true" /> <span className="max-w-[200px] truncate">{websiteLabel}</span> <ExternalLink size={12} className="shrink-0 opacity-70" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Sticky section jump-nav, flush under the header ---- */}
      <div ref={navRef} style={{ borderRadius: "0 0 0.7rem 0.7rem", boxShadow: navStuck ? "0 6px 16px rgba(11,16,32,0.08)" : "none" }} className="sticky top-16 z-[6] -mt-6 flex items-center border border-line bg-white pr-5 transition-shadow sm:pr-11">
        <nav aria-label="Profile sections" className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto overflow-y-hidden pl-5 pr-2 sm:gap-7 sm:pl-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navStuck && (
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="Back to top" className="-mr-1.5 hidden shrink-0 items-center gap-3 border-r border-line py-1 pr-6 text-left sm:inline-flex">
              <UserAvatar profile={profile} size={38} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 whitespace-nowrap text-sm font-bold leading-tight text-navy">
                  {fullName}
                  {trustReasons.length > 0 && <BadgeCheck size={15} strokeWidth={2.2} style={{ color: VERIFIED_GREEN }} aria-label="Verified researcher" />}
                </span>
                {(profile.designation || profile.affiliation) && <span className="mt-0.5 block max-w-[260px] truncate whitespace-nowrap text-xs text-ink-muted">{[profile.designation, profile.affiliation].filter(Boolean).join(" · ")}</span>}
              </span>
            </button>
          )}
          {SECTIONS.map(([id, label]) => {
            const active = activeSec === id;
            return (
              <a key={id} href={`#${id}`} onClick={jumpTo(id)} aria-current={active ? "location" : undefined} className={cn("whitespace-nowrap border-b-2 pb-[13px] pt-[15px] text-sm transition-colors hover:text-navy", active ? "border-primary font-semibold text-navy" : "border-transparent font-medium text-ink-muted")}>
                {label}
              </a>
            );
          })}
        </nav>
        {navStuck && (
          <div className="hidden shrink-0 items-center gap-2 pl-4 pr-4 lg:flex">
            <ProfileIconAction icon={Share2} label="Share profile" hint="Copy your profile link, show a QR code or download your contact card." onClick={edit.share} size={32} />
            {!readOnly && <ProfileIconAction icon={Settings} label="Security & Settings" hint="Password, notifications and display." onClick={edit.settings} primary size={32} />}
          </div>
        )}
      </div>

      {/* ---- Main column + sidebar ---- */}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6" style={{ flex: "1 1 560px" }}>
          <ProfileSectionCard id="sec-about" title="About" actions={<EditIf show={!readOnly} onClick={edit.about} label="Edit about" />}>
            <div className="pb-5 pt-4">
              {profile.bio ? <p className="whitespace-pre-line text-[15px] leading-[1.7] text-[#334155]">{profile.bio}</p> : <p className="text-sm text-ink-muted">Add a short summary of your research focus.</p>}
              {profile.primaryArea && (
                <div className="mt-5 flex flex-wrap items-end gap-x-2.5 gap-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-bold text-navy">Primary subject</h3>
                    <span className="inline-flex h-7 items-center rounded-full bg-primary px-3 text-[13px] font-semibold text-white">{profile.primaryArea}</span>
                  </div>
                  {profile.secondaryAreas.length > 0 && (
                    <>
                      <div className="flex h-7 items-center px-1" aria-hidden="true"><ChevronRight size={16} strokeWidth={2.4} className="text-ink-muted" /></div>
                      <div>
                        <h3 className="mb-2 text-sm font-bold text-navy">Secondary subject</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {profile.secondaryAreas.map((s) => <span key={s} className="inline-flex h-7 items-center rounded-full bg-primary-soft px-3 text-[13px] font-medium text-primary-hover">{s}</span>)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              {interests.length > 0 && (
                <>
                  <h3 className="mb-1.5 mt-5 text-sm font-bold text-navy">Research interests / Expertise</h3>
                  <p className="text-sm leading-[1.7] text-[#334155]">
                    {interests.map((t, i) => <Fragment key={t}>{i > 0 && <span aria-hidden="true" className="px-2 text-ink-muted">·</span>}<span>{t}</span></Fragment>)}
                  </p>
                </>
              )}
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard id="sec-affiliation" title={affs.length + pastAffs.length > 1 ? "Affiliations" : "Affiliation"} actions={<EditIf show={!readOnly} onClick={edit.affiliation} label="Edit affiliations" />}>
            {affs.length === 0 && pastAffs.length === 0 && <EmptyText>Add the institution you currently work or research at.</EmptyText>}
            {(affs.length > 0 || pastAffs.length > 0) && (() => {
              const rows = [...affs.map((a) => ({ a, current: true })), ...shown("pastAff", pastAffs, 3).map((a) => ({ a, current: false }))];
              return (
                <ol className="pb-1 pt-2">
                  {rows.map(({ a, current }, i) => <AffiliationTimelineRow key={a.id} a={a} current={current} last={i === rows.length - 1} showPrimary={current && "primary" in a && Boolean(a.primary) && affs.length > 1} owner />)}
                </ol>
              );
            })()}
            {pastAffs.length > 3 && <ShowMore open={Boolean(more.pastAff)} count={pastAffs.length} noun="past affiliations" controls="sec-affiliation" onToggle={() => toggleMore("pastAff")} />}
          </ProfileSectionCard>

          <ProfileSectionCard id="sec-experience" title="Experience" actions={<><EditIf show={!readOnly} onClick={() => edit.add("experience")} label="Add experience" icon={Plus} /><EditIf show={!readOnly} onClick={edit.experience} label="Edit experience" /></>}>
            {exp.length === 0 && <EmptyText>No experience added yet.</EmptyText>}
            {shown("exp", exp, 3).map((e, i) => (
              <ProfileEntryRow key={e.id} icon={Briefcase} first={i === 0}>
                <div className="text-[15px] font-semibold text-navy">{e.title}</div>
                <div className="mt-0.5 text-sm text-ink-soft">{e.org}</div>
                <div className="mt-2 text-[13px] text-ink-muted">{formatEntryPeriod(e)}</div>
              </ProfileEntryRow>
            ))}
            {exp.length > 3 && <ShowMore open={Boolean(more.exp)} count={exp.length} noun="positions" controls="sec-experience" onToggle={() => toggleMore("exp")} />}
          </ProfileSectionCard>

          <ProfileSectionCard id="sec-education" title="Education" actions={<><EditIf show={!readOnly} onClick={() => edit.add("education")} label="Add education" icon={Plus} /><EditIf show={!readOnly} onClick={edit.education} label="Edit education" /></>}>
            {edu.length === 0 && <EmptyText>No education added yet.</EmptyText>}
            {shown("edu", edu, 3).map((e, i) => (
              <ProfileEntryRow key={e.id} icon={GraduationCap} first={i === 0}>
                <div className="text-[15px] font-semibold text-navy">{e.org}</div>
                <div className="mt-2 text-[13px] text-ink-muted">{formatEntryPeriod(e)}</div>
                <div className="mt-0.5 text-sm text-[#334155]">{e.title}</div>
              </ProfileEntryRow>
            ))}
            {edu.length > 3 && <ShowMore open={Boolean(more.edu)} count={edu.length} noun="degrees" controls="sec-education" onToggle={() => toggleMore("edu")} />}
          </ProfileSectionCard>

          <ProfileSectionCard id="sec-memberships" title="Professional memberships" actions={<><EditIf show={!readOnly} onClick={() => edit.add("membership")} label="Add membership" icon={Plus} /><EditIf show={!readOnly} onClick={edit.memberships} label="Edit memberships" /></>}>
            {mems.length === 0 ? <EmptyText>No memberships added yet.</EmptyText> : (() => {
              const list = shown("mem", mems, 4);
              return (
                <div className="grid grid-cols-1 gap-x-8 pb-2.5 pt-1.5 sm:grid-cols-2">
                  {list.map((e, i) => {
                    const soc = membershipSociety(e);
                    const isLast = i === list.length - 1;
                    const inLastRow = list.length % 2 === 0 ? i >= list.length - 2 : isLast;
                    return (
                      <div key={e.id} className={cn("flex min-w-0 items-start gap-3 border-muted py-3.5", !isLast && "border-b", inLastRow && !isLast && "sm:border-b-0")}>
                        <OrgMonogram org={e.org} acronym={soc?.acronym} logo={soc?.logo} />
                        <div className="min-w-0 pt-px">
                          <div className="text-[15px] font-semibold leading-snug text-navy">
                            {soc?.name || e.org}
                            {membershipPending(e) && <span className="ml-2 align-middle text-xs font-semibold text-[#B45309]">Pending review</span>}
                            {e.verification === "rejected" && <span className="ml-2 align-middle text-xs font-semibold text-danger-ink">Not accepted{e.verificationReason ? `: ${e.verificationReason}` : ""}</span>}
                          </div>
                          <div className="mt-0.5 text-sm text-ink-soft">
                            {e.title}
                            <span aria-hidden="true" className="px-1.5 text-ink-muted">·</span>
                            <span className="text-ink-muted">{e.current ? `since ${e.startYear}` : [e.startYear, e.endYear].filter(Boolean).join(" – ")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {mems.length > 4 && <ShowMore open={Boolean(more.mem)} count={mems.length} noun="memberships" controls="sec-memberships" onToggle={() => toggleMore("mem")} />}
          </ProfileSectionCard>
        </div>

        <aside aria-label="Contact" className="flex min-w-0 max-w-full basis-full flex-col gap-4 self-start min-[980px]:sticky min-[980px]:top-[88px] min-[980px]:shrink min-[980px]:grow-0 min-[980px]:basis-[340px]">
          {!readOnly && <ContactCard profile={profile} onEditEmails={edit.emails} onEditPhone={edit.phone} onEditAddress={edit.address} onShare={edit.share} />}
        </aside>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" />
    </svg>
  );
}
