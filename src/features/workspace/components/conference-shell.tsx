"use client";

import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, ChevronRight, HelpCircle, Lock, Menu as MenuIcon, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { openSetupGuide, SETUP_OPEN_EVENT, START_EVENT, startConferenceTour } from "@/features/tour/tour-events";
import { SoonBadge, SoonDot } from "@/components/ui/soon-badge";

// The guided tour is a large module and only a chair needs it: it loads after the page is shown.
const ConferenceTour = dynamic(() => import("@/features/tour/conference-tour").then((m) => m.ConferenceTour), { ssr: false });
import { readTourState } from "@/features/tour/tour-state";
import { setupLocked, useConferenceSetup } from "@/features/tour/use-setup";
import type { Conference, ConferenceRole } from "@/types/conference";
import { SOON, SOON_ORDER, MENUS, hrefOf, roleLanding, type MenuItem } from "../menus";

/* The frame of a conference workspace (the prototype's Sidebar + ConferenceShell): the conference's menu on the left, the page on
   the right. One component for the Author, Reviewer and Chair workspaces; each has its own menu (features/workspace/menus.ts).
   Below lg the menu folds behind a "conference menu" bar; on desktop it can be hidden to a slim rail (kept in this browser).
   Entries for screens that are not ported yet open the same page in the prototype. A menu group (Submissions, Peer Review …)
   opens when one of its pages is the current one. The chair's setup lock (the menu stays shut except Conference Settings until the required setup is done) and the guided tour are part of it, from features/tour. */

export type WorkspaceRole = "author" | "reviewer" | "chair";

const ROLE_LABEL: Record<ConferenceRole, string> = { chair: "Chair", author: "Author", reviewer: "Reviewer", committee: "Committee Member" };
const ROLE_COLOR: Record<ConferenceRole, { color: string; bg: string }> = {
  chair: { color: "var(--secondary)", bg: "var(--secondary-soft)" },
  author: { color: "var(--primary)", bg: "var(--primary-soft)" },
  reviewer: { color: "var(--success-ink)", bg: "var(--success-soft)" },
  committee: { color: "var(--cat-virtual)", bg: "var(--cat-virtual-soft)" },
};
const PIN_KEY = "smartconferu.sidebarPinned";

/* The menu is a slim icon rail by default (the page gets the whole width) and opens over the page while the pointer is on it; "Keep menu open" pins it, a choice kept in this browser (localStorage can be unavailable: then it just isn't remembered). */
const COLLAPSE_EVENT = "smartconferu:sidebar-collapsed";
const subscribeCollapsed = (notify: () => void) => {
  window.addEventListener(COLLAPSE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(COLLAPSE_EVENT, notify); window.removeEventListener("storage", notify); };
};
/* A page can fold the menu away while it is open (the review form needs the width); this is not remembered, and the saved choice is back on leaving. */
let foldedByPage = false;
const readCollapsed = () => { if (foldedByPage) return true; try { return window.localStorage.getItem(PIN_KEY) !== "1"; } catch { return true; } };
const setCollapsed = (v: boolean) => {
  foldedByPage = false;
  try { window.localStorage.setItem(PIN_KEY, v ? "0" : "1"); } catch { /* storage off */ }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
};

/** Initials tile standing in for a conference logo ("ICTCS 2026" → "IC"). */
export function ConferenceMonogram({ acronym, size = 40, logoUrl, onTint = false }: { acronym: string; size?: number; /** The conference's own logo, when it has one (drawn instead of the initials). */ logoUrl?: string; /** On a tinted banner the tile is white. */ onTint?: boolean }) {
  const initials = acronym.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "C";
  // eslint-disable-next-line @next/next/no-img-element
  if (logoUrl) return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), border: "1px solid var(--border)" }} className="flex shrink-0 items-center justify-center overflow-hidden bg-white p-[3px]"><img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" /></div>;
  if (onTint) return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), fontSize: Math.round(size * 0.34), letterSpacing: "-0.02em" }} className="flex shrink-0 items-center justify-center bg-white font-extrabold text-primary shadow-sm">{initials}</div>;
  return (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), fontSize: Math.round(size * 0.34), letterSpacing: "-0.02em" }} className="flex shrink-0 items-center justify-center bg-primary-soft font-extrabold text-primary">
      {initials}
    </div>
  );
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) close(); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function RoleSwitcher({ roles, active, slug }: { roles: ConferenceRole[]; active: WorkspaceRole; slug: string }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const box = "w-full flex items-center rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs font-semibold text-ink-soft";
  if (roles.length <= 1) return <div className={box}>Viewing as <span className="ml-1 font-bold text-navy">{ROLE_LABEL[active]}</span></div>;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className={`${box} justify-between gap-1.5 transition-colors hover:border-primary-soft-border`}>
        <span>Viewing as <span className="font-bold text-navy">{ROLE_LABEL[active]}</span></span>
        <ChevronDown size={13} aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute z-20 mt-1.5 w-full min-w-[12rem] overflow-hidden rounded-xl border border-line bg-white p-1 shadow-pop">
          <div className="border-b border-muted px-3 py-2 text-xs font-semibold text-ink-faint">Switch role for this conference</div>
          {roles.map((r) => {
            const on = r === active;
            const cls = "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-canvas";
            if (on) return <span key={r} role="menuitem" aria-current="true" style={{ background: ROLE_COLOR[r].bg, color: ROLE_COLOR[r].color }} className={cls}>{ROLE_LABEL[r]}<Check size={13} aria-hidden="true" /></span>;
            const { href, external } = roleLanding(slug, r);
            return external
              ? <a key={r} role="menuitem" href={href} className={`${cls} text-ink`}>{ROLE_LABEL[r]}</a>
              : <Link key={r} role="menuitem" href={href} onClick={() => setOpen(false)} className={`${cls} text-ink`}>{ROLE_LABEL[r]}</Link>;
          })}
        </div>
      )}
    </div>
  );
}

function ConferenceSwitcher({ others, role }: { others: Conference[]; role: WorkspaceRole }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  if (!others.length) return null;
  return (
    <div ref={ref} className="relative mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-primary-soft-border bg-primary-soft px-2.5 py-1.5 text-xs font-bold text-primary-hover transition hover:brightness-95">
        <span className="inline-flex items-center gap-1.5"><ArrowLeftRight size={13} aria-hidden="true" /> Switch conference</span>
        <ChevronDown size={13} aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul role="listbox" aria-label="Your conferences" className="absolute z-30 mt-1.5 max-h-72 w-full min-w-[15rem] overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-pop">
          <li className="list-none border-b border-muted px-3 py-2 text-xs font-semibold text-ink-faint">Your conferences as {ROLE_LABEL[role].toLowerCase()}</li>
          {others.map((c) => {
            const { href, external } = roleLanding(c.id, role);
            const cls = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50";
            const inner = (
              <>
                <ConferenceMonogram acronym={c.acronym} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold leading-tight text-navy">{c.acronym}</span>
                  <span className="block truncate text-[11.5px] leading-tight text-ink-muted">{c.name}</span>
                </span>
              </>
            );
            return (
              <li key={c.id} role="option" aria-selected="false" className="list-none">
                {external ? <a href={href} className={cls}>{inner}</a> : <Link href={href} onClick={() => setOpen(false)} className={cls}>{inner}</Link>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const PANEL = { borderRight: "1px solid #E7E2F5", background: "linear-gradient(180deg, #F5F3FF 0%, #F8F7FC 100%)" } as const;
const TILE_OFF = { background: "#FFFFFF", color: "var(--primary)", boxShadow: "0 1px 2px rgba(15,23,42,0.06)" } as const;
const TILE_ON = { background: "rgba(255,255,255,0.18)", color: "#FFFFFF" } as const;
const ACTIVE = { background: "var(--primary)", color: "#FFFFFF", boxShadow: "0 6px 16px -6px rgba(124, 58, 237,0.55)" } as const;

/** The menu item (and, inside a group, the child) that is lit: "overview", or "submissions/list". */
export type ActiveKey = string | null;

export interface ShellProps {
  role: WorkspaceRole;
  conference: Conference;
  roles: ConferenceRole[];
  /** The user's other conferences in the same role. */
  others: Conference[];
  active: ActiveKey;
  /** The conference runs these screening steps (Conference Settings › Submissions); both are on by default. */
  screening?: { initialCheck: boolean; plagiarism: boolean };
  /** Fold the menu away while this page is open (not remembered). */
  foldMenu?: boolean;
  children: ReactNode;
}

const isOn = (active: ActiveKey, key: string, childKey?: string) => active === (childKey ? `${key}/${childKey}` : key);
const groupOn = (active: ActiveKey, item: MenuItem) => (item.children ?? []).some((c) => isOn(active, item.key, c.key));

function ItemLink({ item, slug, on, className, style, onNavigate, children, label, current, tour }: { item: Pick<MenuItem, "app" | "key" | "label">; tour?: string; slug: string; on: boolean; className: string; style?: React.CSSProperties; onNavigate?: () => void; children: ReactNode; label?: string; current?: boolean }) {
  const { href, external } = hrefOf(item, slug);
  return external
    ? <a href={href} aria-label={label} title={label} style={style} className={className} data-tour={tour}>{children}</a>
    // The charts page carries a ~110 KB (compressed) charts library: it is fetched when opened, not in the background of every other page.
    : <Link href={href} prefetch={item.key === "analytics" ? false : undefined} aria-label={label} title={label} aria-current={on || current ? "page" : undefined} style={style} className={className} onClick={onNavigate} data-tour={tour}>{children}</Link>;
}

export function ConferenceShell({ role, conference, roles, others, active, screening = { initialCheck: true, plagiarism: true }, foldMenu = false, children }: ShellProps) {
  const [sideOpen, setSideOpen] = useState(false);
  // The tour module is fetched once the page has had time to show (2.5 s), or at once when the chair asks for it; a press before it has
  // loaded is played when it is ready (tour-events). On a slow phone this keeps it from competing with the page's own data.
  const [tourOn, setTourOn] = useState(false);
  useEffect(() => {
    if (role !== "chair" || tourOn) return undefined;
    const on = () => setTourOn(true);
    const t = setTimeout(on, 2500);
    window.addEventListener(START_EVENT, on);
    window.addEventListener(SETUP_OPEN_EVENT, on);
    return () => { clearTimeout(t); window.removeEventListener(START_EVENT, on); window.removeEventListener(SETUP_OPEN_EVENT, on); };
  }, [role, tourOn]);
  const collapsed =useSyncExternalStore(subscribeCollapsed, readCollapsed, () => true);
  useEffect(() => {
    if (!foldMenu) return undefined;
    foldedByPage = true;
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
    return () => { foldedByPage = false; window.dispatchEvent(new Event(COLLAPSE_EVENT)); };
  }, [foldMenu]);
  const slug = conference.id;
  // A chair whose required setup is not finished (and whose Call for Papers is not out) has the menu locked except Conference Settings, with a card that opens the checklist.
  const setup = useConferenceSetup(slug, role === "chair");
  const locked = role === "chair" && setupLocked(setup);
  const off = (key: string) => locked && key !== "settings";
  // The lock also holds for a typed or bookmarked address: while the menu is locked only Conference Settings opens; any other page sends the chair there.
  const router = useRouter();
  const blocked = locked && !(active ?? "").startsWith("settings");
  // Until we know whether the menu is locked, a chair page shows a placeholder instead of the page (otherwise a locked page would flash open before the check answers). If the check never answers, the page opens after a few seconds.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (role !== "chair" || setup.ready) return undefined;
    const t = setTimeout(() => setGaveUp(true), 6000);
    return () => clearTimeout(t);
  }, [role, setup.ready]);
  const checking = role === "chair" && !setup.ready && !gaveUp;
  useEffect(() => { if (blocked) router.replace(`/chair/${encodeURIComponent(slug)}/settings`); }, [blocked, router, slug]);
  const LOCK_TITLE = "Finish setting up your conference to unlock this";
  const items: MenuItem[] = MENUS[role]
    .map((i) => (i.children ? { ...i, children: i.children.filter((c) => !c.screening || screening[c.screening]) } : i))
    .filter((i) => !i.children || i.children.length > 0);
  // Everything not available yet (switched off in lib/config.ts, or announced only) is listed together at the bottom, under "Coming soon".
  const menuItems = items.filter((i) => !i.soon);
  const soonEntries: Array<{ key?: string; label: string; icon: LucideIcon }> = [...items.filter((i) => i.soon).map((i) => ({ key: i.key, label: i.label, icon: i.icon as LucideIcon })), ...SOON[role]].sort((a, b) => { const rank = (k?: string) => { const i = SOON_ORDER.indexOf(k ?? ""); return i < 0 ? SOON_ORDER.length : i; }; return rank(a.key) - rank(b.key); });
  // Groups start open when one of their pages is the current one; the person can fold or open any group afterwards.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const groupOpen = (item: MenuItem) => toggled[item.key] ?? groupOn(active, item);
  const toggle = (item: MenuItem) => setToggled((t) => ({ ...t, [item.key]: !groupOpen(item) }));

  // The guided tour points at menu items: it asks the shell to open a group, bring a hidden menu back, or open the drawer on a small screen.
  useEffect(() => {
    const openGroup = (e: Event) => { const key = (e as CustomEvent<string>).detail; setToggled((t) => ({ ...t, [key]: true })); };
    const expand = () => setCollapsed(false);
    const openDrawer = () => setSideOpen(true);
    window.addEventListener("conference-sidebar-open-group", openGroup);
    window.addEventListener("conference-sidebar-expand", expand);
    window.addEventListener("conference-sidebar-open", openDrawer);
    return () => { window.removeEventListener("conference-sidebar-open-group", openGroup); window.removeEventListener("conference-sidebar-expand", expand); window.removeEventListener("conference-sidebar-open", openDrawer); };
  }, []);
  useEffect(() => {
    if (!sideOpen) return undefined;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") setSideOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sideOpen]);

  const here = (() => {
    for (const i of items) {
      if (isOn(active, i.key)) return i.label;
      const c = i.children?.find((x) => isOn(active, i.key, x.key));
      if (c) return `${i.label} › ${c.label}`;
    }
    return "";
  })();
  const roleName = ROLE_LABEL[role];
  const rail = collapsed && !sideOpen;
  // Hovering the rail (or tabbing into it) opens the full menu over the page; leaving it closes the menu again.
  const [hover, setHover] = useState(false);
  useEffect(() => { setHover(false); }, [active]); // eslint-disable-line react-hooks/set-state-in-effect -- the menu closes when a page is chosen
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enter = () => { clearTimeout(leaveTimer.current); setHover(true); };
  const leave = () => { clearTimeout(leaveTimer.current); leaveTimer.current = setTimeout(() => setHover(false), 180); };
  const fullMenu = (flyout: boolean) => (
    <div id={flyout ? undefined : "conference-sidebar"} style={PANEL} className={flyout ? "h-[calc(100vh-64px)] w-72 flex-col shadow-2xl flex" : `h-[calc(100vh-64px)] w-72 max-w-[86vw] shrink-0 flex-col lg:sticky lg:top-16 lg:z-auto lg:flex lg:shadow-none ${sideOpen ? "fixed left-0 top-16 z-40 flex shadow-2xl" : "hidden"}`}>
      {!flyout && <button type="button" onClick={() => setCollapsed(true)} aria-label="Hide menu" aria-expanded="true" aria-controls="conference-sidebar" title="Hide menu" className="absolute -right-3 top-5 z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-[#E7E2F5] bg-white text-primary shadow-sm transition-colors hover:bg-primary-soft lg:flex">
        <ChevronLeft size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>}
      <div className="relative z-20 px-4 pb-2 pt-4">
        <div className="rounded-2xl border border-[#E7E2F5] bg-white px-4 pb-3.5 pt-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center gap-3">
            <ConferenceMonogram acronym={conference.acronym} size={40} logoUrl={conference.logoUrl} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-navy">{conference.acronym}</div>
              <div className="line-clamp-2 text-xs leading-snug text-ink-muted" title={conference.name}>{conference.name}</div>
            </div>
          </div>
          <RoleSwitcher roles={roles} active={role} slug={slug} />
          <ConferenceSwitcher others={others} role={role} />
        </div>
      </div>
      {locked && (
        <div className="px-4 pt-1">
          <button type="button" onClick={() => { setSideOpen(false); openSetupGuide(); }} style={{ border: "1px solid var(--primary-soft-border)", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" }} className="w-full cursor-pointer rounded-2xl bg-white px-4 py-3 text-left transition-colors hover:bg-primary-soft">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-primary"><Sparkles size={14} aria-hidden="true" /> {readTourState(slug).welcomed ? "Resume setup" : "Finish setup"} <ChevronRight size={14} aria-hidden="true" className="ml-auto" /></span>
            <span className="mt-0.5 block text-xs text-ink-muted">Required {setup.done} of {setup.total}</span>
            <span className="mt-0.5 block text-[11px] text-ink-faint">The menu unlocks when the required items are done</span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"><span style={{ width: `${Math.round((setup.done / setup.total) * 100)}%` }} className="block h-full rounded-full bg-primary transition-all" /></span>
          </button>
        </div>
      )}
      <div className="px-6 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-[#9389B2]">Menu</div>
      <nav aria-label="Conference menu" className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
        {menuItems.map((item) => {
          const Icon = item.icon as LucideIcon;
          if (item.soon) {
            return (
              <div key={item.key} data-tour={`nav-${item.key}`} title={`${item.label} — coming soon`} aria-disabled="true" className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-semibold text-[#A39AC0]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60"><Icon size={16} aria-hidden="true" /></span>
                <span className="flex-1">{item.label}</span>
                <SoonBadge />
              </div>
            );
          }
          if (item.children) {
            const lockedGroup = off(item.key);
            const open = groupOpen(item) && !lockedGroup;
            const gOn = groupOn(active, item) && !lockedGroup;
            return (
              <div key={item.key}>
                <button type="button" onClick={() => toggle(item)} disabled={lockedGroup} title={lockedGroup ? LOCK_TITLE : undefined} aria-expanded={open} data-tour={`nav-${item.key}`} style={gOn ? { color: "var(--primary)", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(15,23,42,0.06)" } : lockedGroup ? { opacity: 0.5 } : undefined} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${lockedGroup ? "cursor-not-allowed" : "hover:bg-white"} ${gOn ? "" : "text-[#334155]"}`}>
                  <span style={TILE_OFF} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><Icon size={16} aria-hidden="true" /></span>
                  <span className="flex-1">{item.label}</span>
                  {lockedGroup ? <Lock size={13} aria-hidden="true" className="shrink-0" /> : open ? <ChevronDown size={15} aria-hidden="true" className="shrink-0 opacity-70" /> : <ChevronRight size={15} aria-hidden="true" className="shrink-0 opacity-70" />}
                </button>
                {open && (
                  <div className="mb-1.5 ml-[26px] mt-1 space-y-0.5 border-l-2 border-[#E2DBF5] pl-3">
                    {item.children.map((child) => {
                      const cOn = isOn(active, item.key, child.key);
                      return (
                        <ItemLink key={child.key} item={child} slug={slug} on={cOn} tour={`nav-${item.key}-${child.key}`} onNavigate={() => setSideOpen(false)} style={cOn ? { color: "var(--primary)", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" } : undefined} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors hover:bg-white ${cOn ? "" : "text-[#475569]"}`}>
                          <span aria-hidden="true" style={{ background: cOn ? "var(--primary)" : "#CFC5E8" }} className="h-1.5 w-1.5 shrink-0 rounded-full" />
                          {child.label}
                        </ItemLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const on = isOn(active, item.key) && !off(item.key);
          if (off(item.key)) {
            return (
              <button key={item.key} type="button" disabled data-tour={`nav-${item.key}`} title={LOCK_TITLE} style={{ color: "#334155", opacity: 0.5 }} className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold">
                <span style={TILE_OFF} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><Icon size={16} aria-hidden="true" /></span>
                <span className="flex-1">{item.label}</span>
                <Lock size={13} aria-hidden="true" className="shrink-0" />
              </button>
            );
          }
          return (
            <ItemLink key={item.key} item={item} slug={slug} on={on} tour={`nav-${item.key}`} onNavigate={() => setSideOpen(false)} style={on ? ACTIVE : undefined} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${on ? "" : "text-[#334155] hover:bg-white"}`}>
              <span style={on ? TILE_ON : TILE_OFF} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><Icon size={16} aria-hidden="true" /></span>
              <span className="flex-1">{item.label}</span>
            </ItemLink>
          );
        })}
        {soonEntries.length > 0 && (
          <>
            <div className="mx-2 my-3 border-t border-[#E7E2F5]" />
            <div className="mb-1 px-2.5 text-[10.5px] font-bold uppercase tracking-wider text-[#9389B2]">Coming soon</div>
            {soonEntries.map((s) => (
              <div key={s.label} data-tour={s.key ? `nav-${s.key}` : undefined} title={`${s.label} — coming soon`} className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-semibold text-[#A39AC0]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60"><s.icon size={16} aria-hidden="true" /></span>
                <span className="flex-1">{s.label}</span>
                <SoonBadge />
              </div>
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-[#E7E2F5] px-4 py-3">
        {role === "chair" && <button type="button" onClick={() => { setSideOpen(false); startConferenceTour(); }} data-tour="take-tour" className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold text-primary transition-colors hover:bg-white"><HelpCircle size={15} className="shrink-0" aria-hidden="true" /> Take a tour</button>}
        <Link href="/dashboard" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-white hover:text-navy">
          <ChevronLeft size={15} className="shrink-0" aria-hidden="true" /> My Conferences
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex items-start">
      {rail ? (
        <div id="conference-sidebar" style={PANEL} onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave(); }} className={`sticky top-16 hidden h-[calc(100vh-64px)] w-[76px] shrink-0 flex-col items-center lg:flex ${hover ? "z-[95]" : ""}`}>
          <button type="button" onClick={() => setCollapsed(false)} aria-label="Keep menu open" aria-expanded="false" aria-controls="conference-sidebar" title="Keep menu open" className="absolute -right-3 top-5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-[#E7E2F5] bg-white text-primary shadow-sm transition-colors hover:bg-primary-soft">
            <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <div className="pb-2 pt-4" title={`${conference.acronym} — ${conference.name}`}><ConferenceMonogram acronym={conference.acronym} size={40} logoUrl={conference.logoUrl} /></div>
          <nav aria-label="Conference menu" className="flex w-full flex-1 flex-col items-center space-y-1.5 overflow-y-auto px-3 pb-3 pt-2">
            {menuItems.map((item) => {
              const Icon = item.icon as LucideIcon;
              const on = item.children ? groupOn(active, item) : isOn(active, item.key);
              const cls = `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${on ? "" : "hover:bg-primary-soft"}`;
              const style = on ? ACTIVE : TILE_OFF;
              if (item.soon) return <span key={item.key} role="img" aria-label={`${item.label} — coming soon`} title={`${item.label} — coming soon`} data-tour={`nav-${item.key}`} className="relative flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl bg-white/60 text-[#A39AC0]"><Icon size={18} aria-hidden="true" /><SoonDot /></span>;
              if (off(item.key)) return <button key={item.key} type="button" disabled aria-label={item.label} title={LOCK_TITLE} style={{ ...TILE_OFF, opacity: 0.5 }} className="flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl"><Icon size={18} aria-hidden="true" /></button>;
              // A group's icon opens the full menu with that group expanded.
              if (item.children) {
                return <button key={item.key} type="button" aria-label={item.label} title={item.label} data-tour={`nav-${item.key}`} style={style} className={cls} onClick={() => { setToggled((t) => ({ ...t, [item.key]: true })); enter(); }}><Icon size={18} aria-hidden="true" /></button>;
              }
              return <ItemLink key={item.key} item={item} slug={slug} on={on} label={item.label} className={cls} style={style}><Icon size={18} aria-hidden="true" /></ItemLink>;
            })}
            {soonEntries.length > 0 && (
              <>
                <div className="my-1.5 w-8 border-t border-[#E7E2F5]" />
                {soonEntries.map((s) => <span key={s.label} data-tour={s.key ? `nav-${s.key}` : undefined} role="img" aria-label={`${s.label} — coming soon`} title={`${s.label} — coming soon`} className="relative flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl bg-white/60 text-[#A39AC0]"><s.icon size={18} aria-hidden="true" /><SoonDot /></span>)}
              </>
            )}
          </nav>
          <div className="flex w-full flex-col items-center gap-1.5 border-t border-[#E7E2F5] py-3">
            {role === "chair" && <button type="button" onClick={() => startConferenceTour()} aria-label="Take a tour" title="Take a tour" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-primary transition-colors hover:bg-white"><HelpCircle size={18} aria-hidden="true" /></button>}
            <Link href="/dashboard" aria-label="My Conferences" title="My Conferences" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-white hover:text-navy"><ChevronLeft size={18} aria-hidden="true" /></Link>
          </div>
          {hover && <div onMouseEnter={enter} onMouseLeave={leave} className="menu-flyout absolute left-0 top-0 z-40">{fullMenu(true)}</div>}
        </div>
      ) : (
        fullMenu(false)
      )}
      {role === "chair" && tourOn && <ConferenceTour slug={slug} acronym={conference.acronym} setup={setup} />}
      {sideOpen && <div aria-hidden="true" onClick={() => setSideOpen(false)} style={{ background: "rgba(15,23,42,0.35)" }} className="fixed inset-x-0 bottom-0 top-16 z-30 lg:hidden" />}
      <div className="min-w-0 flex-1">
        {/* Below lg: which conference and page you're on, and the button that opens its menu. */}
        <button type="button" onClick={() => setSideOpen(true)} aria-controls="conference-sidebar" aria-expanded={sideOpen} style={{ background: "rgba(245,243,255,0.96)", borderBottom: "1px solid #E7E2F5", backdropFilter: "blur(8px)" }} className="sticky top-16 z-10 flex w-full items-center gap-2.5 px-4 py-2.5 text-left lg:hidden">
          <ConferenceMonogram acronym={conference.acronym} size={28} logoUrl={conference.logoUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-extrabold leading-tight text-navy">{conference.acronym}</span>
            <span className="block truncate text-[11.5px] font-semibold leading-tight text-ink-muted">{here ? `${here} · ` : ""}{roleName}</span>
          </span>
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-primary-soft-border bg-white px-2.5 text-[12.5px] font-bold text-primary"><MenuIcon size={15} aria-hidden="true" /> Menu</span>
        </button>
        {checking ? (
          <div role="status" aria-label="Loading the page" className="p-4 sm:p-8"><div className="h-64 animate-pulse rounded-2xl border border-line bg-white" /></div>
        ) : blocked ? (
          <div role="status" className="p-4 sm:p-8">
            <div style={{ border: "1px solid var(--primary-soft-border)" }} className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center">
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary"><Lock size={20} aria-hidden="true" /></span>
              <h1 className="text-lg font-extrabold text-navy">This page is locked for now</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">Finish the required setup ({setup.done} of {setup.total} done) to unlock the menu. Taking you to Conference Settings…</p>
              <Link href={`/chair/${encodeURIComponent(slug)}/settings`} className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover">Open Conference Settings</Link>
            </div>
          </div>
        ) : children}
      </div>
    </div>
  );
}
