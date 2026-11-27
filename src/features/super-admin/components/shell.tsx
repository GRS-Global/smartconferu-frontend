"use client";
/* The console frame, ported from the prototype's SuperAdminApp: the sidebar (same groups and order,
   pending counts that turn red past the review promise, folding groups remembered per browser, the
   review-promise strip), the header (menu, Ctrl K search, website home link, the "Waiting for you" bell,
   profile menu) and the main column. Modules not in the launch are listed, disabled, "Coming soon". */
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WEBSITE_URL } from "@/lib/config";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Bell,
  Building,
  Building2,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  Flag,
  Hourglass,
  Landmark,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MonitorX,
  Network,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useAdmin } from "../session";
import { get, post } from "../api";
import { NOTIFICATIONS_CHANGED } from "../notification-events";
import { actionOf } from "@/features/notifications/destinations";
import { whenLabel } from "@/features/notifications/grouping";
import { isLate, loadPending, type PendingItem, type QueueKey } from "../pending";
import { clearWelcome, fmtTrustDate, peekWelcome, trustedUntil } from "../trusted-device";
import { SearchPalette, type SearchPage } from "./search-palette";
import { StepUpHost } from "./step-up-dialog";
import { Avatar, SLA_DAYS, Toast, type Icon } from "./ui";

interface NavLink {
  href: string;
  label: string;
  icon: Icon;
  /** Not in the launch: shown, disabled, tagged "Coming soon". */
  soon?: boolean;
  /** A queue: shows how many are waiting (red once one is past the promise). */
  queue?: QueueKey;
}
interface NavGroup {
  key: string;
  label: string;
  icon: Icon;
  links: NavLink[];
}
interface NavSection {
  caption: string;
  links?: NavLink[];
  groups?: NavGroup[];
}

/** The public website's home page. The user app's own pages do not open for a Super Admin account (they send it back to this console), so the header
 *  link goes to the website itself. */
const WEBSITE_HOME = WEBSITE_URL ? `${WEBSITE_URL}/` : "/";

/* Same order as the prototype's sidebar: everyday objects, approval queues (folding groups),
   reference lists, settings, the console's own admin. */
const NAV: NavSection[] = [
  {
    caption: "Overview",
    links: [
      { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/super-admin/notifications", label: "Notifications", icon: Bell },
      { href: "/super-admin/conferences", label: "Conferences", icon: Library },
      { href: "/super-admin/billing", label: "Billing", icon: Wallet, soon: true },
      { href: "/super-admin/users", label: "Users", icon: Users },
    ],
  },
  { caption: "Communication", links: [{ href: "/super-admin/announcements", label: "Announcements", icon: Megaphone, soon: true }] },
  {
    caption: "Approvals",
    groups: [
      {
        key: "conferences",
        label: "Conferences",
        icon: Library,
        links: [
          { href: "/super-admin/conference-requests", label: "Conference Requests", icon: CalendarPlus, queue: "requests" },
          { href: "/super-admin/deletion-requests", label: "Deletion Requests", icon: Trash2, queue: "deletions" },
          { href: "/super-admin/license-requests", label: "License Extensions", icon: Hourglass, queue: "licenses" },
          { href: "/super-admin/cfp-review", label: "CFP Page Review", icon: FileCheck2, queue: "cfps" },
        ],
      },
      {
        key: "people",
        label: "People",
        icon: UserRound,
        links: [
          { href: "/super-admin/profile-verification", label: "Profile Verification", icon: BadgeCheck },
          { href: "/super-admin/claim-reports", label: "Claim Reports", icon: Flag, soon: true },
        ],
      },
    ],
    links: [{ href: "/super-admin/names", label: "Names & lists", icon: ListChecks, soon: true }],
  },
  {
    caption: "Master data",
    links: [
      { href: "/super-admin/societies", label: "Societies", icon: Landmark },
      { href: "/super-admin/institutions", label: "Institutions", icon: Building2 },
      { href: "/super-admin/research-areas", label: "Research Areas", icon: Network },
    ],
  },
  { caption: "Settings", links: [{ href: "/super-admin/email-templates", label: "Email Templates", icon: Mail }] },
  {
    caption: "Admin",
    links: [
      { href: "/super-admin/team", label: "Team & Roles", icon: ShieldCheck, soon: true },
      { href: "/super-admin/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
];

// Every page that exists, flat, for Ctrl K.
const SEARCH_PAGES: SearchPage[] = NAV.flatMap((s) => [
  ...(s.groups ?? []).flatMap((g) => g.links.map((l) => ({ ...l, caption: `${s.caption} · ${g.label}` }))),
  ...(s.links ?? []).map((l) => ({ ...l, caption: s.caption })),
])
  .filter((l) => !l.soon)
  .map(({ href, label, caption, icon }) => ({ href, label, caption, icon }));

const NAV_OPEN_KEY = "sa.navGroups"; // which approval groups the admin folded open / shut
const readNavOpen = (): Record<string, boolean> => {
  try {
    return JSON.parse(window.localStorage.getItem(NAV_OPEN_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
};
const POLL_MS = 30_000;

const isActive = (pathname: string, href: string) => (href === "/super-admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

/** What waits for a decision: reloaded on every page change, every 30 s and when the window gets focus. */
function usePending(pathname: string) {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const reload = useCallback(() => {
    loadPending()
      .then(setPending)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    reload();
  }, [pathname, reload]);
  useEffect(() => {
    const t = setInterval(reload, POLL_MS);
    window.addEventListener("focus", reload);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);
  return pending;
}

/** Closes on Escape or a click anywhere else. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };
  return [open, toggle, setOpen] as const;
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { name } = useAdmin();
  const pending = usePending(pathname);
  // The mobile menu closes by itself on navigation: it is open only for the page it was opened on.
  const [navOpenAt, setNavOpenAt] = useState<string | null>(null);
  const navOpen = navOpenAt === pathname;
  const setNavOpen = (open: boolean) => setNavOpenAt(open ? pathname : null);
  const [collapsed, setCollapsed] = useState(false);
  // The console renders only in the browser (after the session check), so storage can be read up front.
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>(readNavOpen);
  const [searchOpen, setSearchOpen] = useState(false);
  // "Welcome back" right after signing in (the login page leaves a note), shown once.
  const [toast, setToast] = useState<string | null>(() => (peekWelcome() ? `Welcome back, ${name}` : null));
  useEffect(() => clearWelcome(), []);
  const toggleGroup = (key: string, open: boolean) =>
    setGroupsOpen((s) => {
      const next = { ...s, [key]: open };
      try {
        window.localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next));
      } catch {
        /* storage off */
      }
      return next;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const count = (q?: QueueKey) => (q ? pending.filter((p) => p.queue === q).length : 0);
  const late = (q?: QueueKey) => (q ? pending.filter((p) => p.queue === q && isLate(p)).length : 0);
  const overdue = pending.filter(isLate);
  const countTitle = (n: number, l: number) => (l ? `${n} waiting · ${l} past the ${SLA_DAYS}-day promise` : `${n} waiting`);

  const navLink = (l: NavLink, nested = false) => {
    const active = isActive(pathname, l.href);
    const n = count(l.queue);
    const lateN = late(l.queue);
    const inner = (
      <>
        {nested ? <span className="sa-nav-dot" aria-hidden="true" /> : <l.icon size={18} strokeWidth={1.8} />}
        <span className="truncate">{l.label}</span>
        {l.soon && (
          <span className="sa-sample-tag" style={{ background: "var(--muted)", color: "var(--text-muted)" }}>
            Coming soon
          </span>
        )}
        {n > 0 && (
          <span className={`sa-count ${lateN ? "is-late" : ""}`} title={countTitle(n, lateN)}>
            {n}
          </span>
        )}
      </>
    );
    return (
      <li key={l.href}>
        {l.soon ? (
          <span className={`sa-nav-link ${nested ? "is-nested" : ""}`} aria-disabled="true" title="Coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>
            {inner}
          </span>
        ) : (
          <Link href={l.href} className={`sa-nav-link ${nested ? "is-nested" : ""} ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className="sa-root">
      {navOpen && <div className="fixed inset-0 z-30 xl:hidden" style={{ background: "rgba(11,16,32,.35)" }} onClick={() => setNavOpen(false)} />}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-[280px] bg-white border-r flex flex-col transition-transform duration-200 ${navOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "" : "xl:translate-x-0"}`}
        style={{ borderColor: "var(--border)" }}
        aria-label="Admin navigation"
      >
        <div className="h-[72px] flex items-center gap-2 px-6 shrink-0">
          <Image src="/smartconferu-lockup.png" alt="Smartconferu" width={127} height={32} className="h-8 w-auto" />
          <span className="text-[10.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            Admin
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 pb-4" aria-label="Sections">
          {NAV.map((section) => {
            const queues = section.groups ? [...section.groups.flatMap((g) => g.links), ...(section.links ?? [])].map((l) => l.queue) : [];
            const sectionN = queues.reduce((s, q) => s + count(q), 0);
            const sectionLate = queues.reduce((s, q) => s + late(q), 0);
            return (
              <div key={section.caption}>
                <p className="sa-caption flex items-center justify-between">
                  <span>{section.caption}</span>
                  {sectionN > 0 && (
                    <span className={`sa-caption-count ${sectionLate ? "is-late" : ""}`} title={`${sectionN} waiting${sectionLate ? ` · ${sectionLate} late` : ""}`}>
                      {sectionN}
                    </span>
                  )}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {(section.groups ?? []).map((g) => {
                    const here = g.links.some((l) => isActive(pathname, l.href));
                    const n = g.links.reduce((s, l) => s + count(l.queue), 0);
                    const lateN = g.links.reduce((s, l) => s + late(l.queue), 0);
                    // Open: the admin's own choice, else open when it holds this page or something late.
                    const open = groupsOpen[g.key] ?? (here || lateN > 0 || g.key === "conferences");
                    return (
                      <li key={g.key}>
                        <button type="button" onClick={() => toggleGroup(g.key, !open)} aria-expanded={open} className={`sa-nav-link sa-nav-group ${here && !open ? "has-active" : ""} cursor-pointer`}>
                          <g.icon size={18} strokeWidth={1.8} />
                          <span className="truncate">{g.label}</span>
                          <span className="ml-auto flex items-center gap-1.5">
                            {n > 0 && (
                              <span className={`sa-count !ml-0 ${lateN ? "is-late" : ""}`} title={countTitle(n, lateN)}>
                                {n}
                              </span>
                            )}
                            <ChevronDown size={15} className="transition-transform shrink-0" style={{ transform: open ? "rotate(180deg)" : "none", color: "var(--text-faint)" }} />
                          </span>
                        </button>
                        {open && <ul className="sa-nav-sub flex flex-col gap-0.5 mt-0.5 mb-1">{g.links.map((l) => navLink(l, true))}</ul>}
                      </li>
                    );
                  })}
                  {(section.links ?? []).map((l) => navLink(l))}
                </ul>
              </div>
            );
          })}
        </nav>
        {/* The review promise, as one slim strip: green when everything's inside it. */}
        <button
          type="button"
          onClick={() => overdue[0] && router.push(overdue[0].href)}
          disabled={!overdue.length}
          className="m-3 mt-0 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-left shrink-0 enabled:hover:brightness-95 cursor-pointer disabled:cursor-default"
          style={{ background: overdue.length ? "var(--danger-soft)" : "var(--success-soft)" }}
        >
          <ShieldCheck size={18} className="shrink-0" style={{ color: overdue.length ? "var(--danger-ink)" : "var(--success-ink)" }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>
              {SLA_DAYS}-day review promise
            </span>
            <span className="block text-[11.5px]" style={{ color: overdue.length ? "var(--danger-ink)" : "var(--success-ink)" }}>
              {overdue.length ? `${overdue.length} past the limit · review oldest` : "Everything is inside the limit"}
            </span>
          </span>
          {overdue.length > 0 && <ChevronRight size={15} className="shrink-0" style={{ color: "var(--danger-ink)" }} />}
        </button>
      </aside>

      <div className={`transition-[margin] duration-200 ${collapsed ? "" : "xl:ml-[280px]"}`}>
        <header className="sticky top-0 z-20 h-[72px] flex items-center justify-between gap-3 px-4 sm:px-6 bg-white/90 backdrop-blur" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1">
            <button className="sa-icon-btn cursor-pointer" aria-label="Toggle navigation" onClick={() => (window.matchMedia("(min-width: 1280px)").matches ? setCollapsed((c) => !c) : setNavOpen(!navOpen))}>
              <Menu size={20} />
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:inline-flex items-center gap-2 h-10 ml-2 pl-3 pr-2 rounded-lg text-[13.5px] w-[280px] transition-colors hover:border-[var(--primary-soft-border)] cursor-pointer"
              style={{ border: "1px solid var(--border)", color: "var(--text-faint)" }}
              aria-label="Search (Ctrl K)"
            >
              <Search size={16} className="shrink-0" /> <span className="flex-1 text-left truncate whitespace-nowrap">Search conferences, people…</span>
              <kbd className="text-[11px] font-semibold rounded-md px-1.5 py-0.5" style={{ background: "var(--muted)", color: "var(--text-muted)" }}>
                Ctrl K
              </kbd>
            </button>
            {/* Wrapped: .sa-icon-btn sets its own display, which would beat md:hidden on the button. */}
            <span className="md:hidden">
              <button onClick={() => setSearchOpen(true)} className="sa-icon-btn cursor-pointer" aria-label="Search">
                <Search size={20} />
              </button>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href={WEBSITE_HOME} target="_blank" rel="noopener noreferrer" className="sa-btn hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold bg-white" style={{ border: "1px solid var(--border)", color: "var(--text-soft)" }}>
              Website home <ExternalLink size={14} />
            </a>
            <NotificationsMenu />
            <ProfileMenu onToast={setToast} />
          </div>
        </header>
        <main className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">{children}</main>
        <footer className="text-center text-[12.5px] py-6" style={{ color: "var(--text-faint)" }}>
          Smartconferu Super Admin · connected to the database
        </footer>
      </div>

      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} pages={SEARCH_PAGES} pending={pending} />}
      <StepUpHost />
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  );
}

interface BellRow {
  id: string; kind: string; title: string; body: string | null; readAt: string | null; createdAt: string;
  conferenceSlug: string | null; conferenceAcronym: string | null; paperLabel: string | null;
}

/** The bell on the right of the header: the red count is this account's unread notifications, and the list shows the newest few. Clicking one marks it
 *  read and opens where it is answered (the same places as the Notifications page); "View all notifications" opens that page. It counts again every
 *  minute, and at once when the Notifications page marks something read. While something is unread the bell rings and the count pulses. */
function NotificationsMenu() {
  const router = useRouter();
  const [open, toggle, setOpen] = useDropdown();
  const [rows, setRows] = useState<BellRow[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(() => {
    get<{ data: BellRow[]; unread: number }>("/me/notifications?limit=6")
      .then((r) => { setRows(r.data); setUnread(r.unread); })
      .catch(() => undefined); // a failed count keeps the last one
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, load);
    return () => { clearInterval(t); window.removeEventListener(NOTIFICATIONS_CHANGED, load); };
  }, [load]);
  const openRow = async (r: BellRow) => {
    setOpen(false);
    const action = actionOf({ kind: r.kind, paperLabel: r.paperLabel, conference: r.conferenceSlug && r.conferenceAcronym ? { slug: r.conferenceSlug, acronym: r.conferenceAcronym } : null });
    if (!r.readAt) {
      await post("/me/notifications/read", { ids: [r.id] }).catch(() => undefined);
      load();
    }
    router.push(action && !action.external ? action.href : "/super-admin/notifications");
  };
  const count = unread > 99 ? "99+" : String(unread);
  return (
    <div className="relative">
      <button
        className={`sa-icon-btn relative cursor-pointer${unread > 0 ? " sa-bell-alert" : ""}`}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        onClick={(e) => {
          if (!open) load();
          toggle(e);
        }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-[10.5px] font-bold leading-none text-white sa-badge-alert"
            style={{ background: "var(--danger)", boxShadow: "0 0 0 2px #fff" }}
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-xl py-2 sa-pop z-30" style={{ boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-2">
            <p className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>
              Notifications
            </p>
            {unread > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold text-white" style={{ background: "var(--primary)" }}>
                {count} new
              </span>
            )}
          </div>
          <ul className="max-h-[340px] overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id}>
                <button onClick={() => void openRow(r)} className="w-full flex items-start gap-3 px-5 py-2.5 text-left hover:bg-[var(--primary-soft)] cursor-pointer">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: r.readAt ? "transparent" : "var(--primary)" }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13.5px] truncate ${r.readAt ? "font-medium" : "font-semibold"}`} style={{ color: "var(--text)" }}>
                      {r.title}
                    </span>
                    <span className="block text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>
                      {[r.conferenceAcronym, whenLabel(r.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {!r.readAt && <span className="sr-only">Unread</span>}
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-5 py-6 text-[13px] text-center" style={{ color: "var(--text-muted)" }}>
                No notifications yet.
              </li>
            )}
          </ul>
          <div className="px-5 pt-2 pb-1" style={{ borderTop: "1px solid var(--border)" }}>
            <Link href="/super-admin/notifications" onClick={() => setOpen(false)} className="block py-1.5 text-center text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ onToast }: { onToast: (text: string) => void }) {
  const { me, name, signOut, signOutEverywhere, forgetDevice } = useAdmin();
  const [open, toggle, setOpen] = useDropdown();
  const until = open ? trustedUntil(me.email ?? "") : null; // read fresh each time the menu opens
  const item = "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] cursor-pointer";
  const soon = (Icon: Icon, label: string) => (
    <span className={`${item} cursor-not-allowed`} style={{ color: "var(--text-soft)", opacity: 0.55 }} aria-disabled="true" title="Coming soon">
      <Icon size={17} />
      {label}
    </span>
  );
  return (
    <div className="relative">
      <button onClick={toggle} className="flex items-center gap-1.5 rounded-full cursor-pointer" aria-label="Account menu" aria-expanded={open}>
        <Avatar name={name} size={38} />
        <ChevronDown size={14} className="hidden sm:block" style={{ color: "var(--text-muted)" }} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-[260px] bg-white rounded-xl p-2 sa-pop z-30" style={{ boxShadow: "var(--shadow-pop)" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-3 py-3 border-b mb-1" style={{ borderColor: "var(--border)" }}>
            <Avatar name={name} size={42} />
            <div className="min-w-0">
              <p className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>
                {name}
              </p>
              <p className="text-[12.5px] truncate" style={{ color: "var(--text-muted)" }}>
                {me.email}
              </p>
            </div>
          </div>
          <a href="/profile" className={`${item} hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]`} style={{ color: "var(--text-soft)" }}>
            <UserRound size={17} />
            My profile
          </a>
          {soon(Settings, "Admin settings")}
          {soon(Building, "Team & roles")}
          <div className="mt-1 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-start gap-3 px-3 py-2">
              <ShieldCheck size={17} className="shrink-0 mt-px" style={{ color: until ? "var(--success-ink)" : "var(--text-faint)" }} />
              <div className="text-[12.5px] leading-snug">
                <p className="font-semibold" style={{ color: "var(--text)" }}>
                  This device
                </p>
                <p style={{ color: "var(--text-muted)" }}>{until ? `Trusted until ${fmtTrustDate(until)}. No code asked here.` : "Not trusted. A code is asked at every sign-in."}</p>
              </div>
            </div>
            {until && (
              <button
                onClick={() => {
                  setOpen(false);
                  forgetDevice()
                    .then(() => onToast("This device will ask for a code at the next sign-in"))
                    .catch(() => onToast("Couldn't forget this device. Try again."));
                }}
                className={`${item} hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]`}
                style={{ color: "var(--text-soft)" }}
              >
                <MonitorX size={17} />
                Forget this device
              </button>
            )}
            <button onClick={() => void signOutEverywhere()} className={`${item} hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]`} style={{ color: "var(--text-soft)" }}>
              <LogOut size={17} />
              Log out of all devices
            </button>
          </div>
          <button onClick={() => void signOut()} className="mt-1 w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13.5px] font-semibold border cursor-pointer" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
