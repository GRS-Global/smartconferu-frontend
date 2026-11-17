"use client";
/* The console frame, ported from the prototype's SuperAdminApp: the sidebar (same groups and order),
   the sticky header and the main column. Modules not in the launch are listed but disabled with a
   "Coming soon" tag; they have no page. */
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarPlus,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  Flag,
  Hourglass,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Network,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Wallet,
  Landmark,
} from "lucide-react";
import { useAdmin } from "../session";
import { loadConferences, loadDeletionRequests } from "../services";
import { Avatar, type Icon } from "./ui";

interface NavLink {
  href: string;
  label: string;
  icon: Icon;
  /** Not in the launch: shown, disabled, tagged "Coming soon". */
  soon?: boolean;
  /** A queue: shows how many are waiting. */
  count?: "requests" | "deletions";
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

const PROTOTYPE_URL = (process.env.NEXT_PUBLIC_PROTOTYPE_URL ?? "").replace(/\/$/, "");
const USER_APP_URL = process.env.NEXT_PUBLIC_USER_APP_URL ?? "/dashboard";

/* Same order as the prototype's sidebar: everyday objects, approval queues (folding groups),
   reference lists, settings, the console's own admin. */
const NAV: NavSection[] = [
  {
    caption: "Overview",
    links: [
      { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard },
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
          { href: "/super-admin/conference-requests", label: "Conference Requests", icon: CalendarPlus, count: "requests" },
          { href: "/super-admin/deletion-requests", label: "Deletion Requests", icon: Trash2, count: "deletions" },
          { href: "/super-admin/license-requests", label: "License Extensions", icon: Hourglass, soon: true },
          { href: "/super-admin/cfp-review", label: "CFP Page Review", icon: FileCheck2, soon: true },
        ],
      },
      {
        key: "people",
        label: "People",
        icon: UserRound,
        links: [
          { href: "/super-admin/profile-verification", label: "Profile Verification", icon: BadgeCheck, soon: true },
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
      { href: "/super-admin/audit-log", label: "Audit Log", icon: ScrollText, soon: true },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  href === "/super-admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/** Pending counts for the queue links (refreshed on every page change). */
function useQueueCounts(pathname: string) {
  const [counts, setCounts] = useState<{ requests: number; deletions: number }>({ requests: 0, deletions: 0 });
  useEffect(() => {
    let live = true;
    Promise.all([loadConferences("pending_approval"), loadDeletionRequests("pending")])
      .then(([r, d]) => live && setCounts({ requests: r.length, deletions: d.length }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [pathname]);
  return counts;
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, name, signOut } = useAdmin();
  const counts = useQueueCounts(pathname);
  // The mobile menu closes by itself on navigation: it is open only for the page it was opened on.
  const [navOpenAt, setNavOpenAt] = useState<string | null>(null);
  const navOpen = navOpenAt === pathname;
  const setNavOpen = (open: boolean) => setNavOpenAt(open ? pathname : null);
  const [collapsed, setCollapsed] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);


  const navLink = (l: NavLink, nested = false) => {
    const active = isActive(pathname, l.href);
    const n = l.count ? counts[l.count] : 0;
    const inner = (
      <>
        {nested ? <span className="sa-nav-dot" aria-hidden="true" /> : <l.icon size={18} strokeWidth={1.8} />}
        <span className="truncate">{l.label}</span>
        {l.soon && (
          <span className="sa-sample-tag" style={{ background: "var(--muted)", color: "var(--text-muted)" }}>
            Coming soon
          </span>
        )}
        {n > 0 && <span className="sa-count">{n}</span>}
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

  const pendingTotal = counts.requests + counts.deletions;

  return (
    <div className="sa-root">
      {navOpen && <div className="fixed inset-0 z-30 xl:hidden" style={{ background: "rgba(11,16,32,.35)" }} onClick={() => setNavOpen(false)} />}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-[280px] bg-white border-r flex flex-col transition-transform duration-200 ${navOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "" : "xl:translate-x-0"}`}
        style={{ borderColor: "var(--border)" }}
        aria-label="Admin navigation"
      >
        <div className="h-[72px] flex items-center gap-2 px-6 shrink-0">
          <Image src="/smartconferu-lockup.png" alt="Smartconferu" width={160} height={32} priority className="h-8 w-auto" />
          <span className="text-[10.5px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            Admin
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 pb-4" aria-label="Sections">
          {NAV.map((section) => (
            <div key={section.caption}>
              <p className="sa-caption flex items-center justify-between">
                <span>{section.caption}</span>
                {section.groups && pendingTotal > 0 && <span className="sa-caption-count">{pendingTotal}</span>}
              </p>
              <ul className="flex flex-col gap-0.5">
                {(section.groups ?? []).map((g) => {
                  const here = g.links.some((l) => isActive(pathname, l.href));
                  const n = g.links.reduce((s, l) => s + (l.count ? counts[l.count] : 0), 0);
                  const open = groupsOpen[g.key] ?? true;
                  return (
                    <li key={g.key}>
                      <button type="button" onClick={() => setGroupsOpen((o) => ({ ...o, [g.key]: !open }))} aria-expanded={open} className={`sa-nav-link sa-nav-group ${here && !open ? "has-active" : ""}`}>
                        <g.icon size={18} strokeWidth={1.8} />
                        <span className="truncate">{g.label}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          {n > 0 && <span className="sa-count !ml-0">{n}</span>}
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
          ))}
        </nav>
      </aside>

      <div className={`transition-[margin] duration-200 ${collapsed ? "" : "xl:ml-[280px]"}`}>
        <header className="sticky top-0 z-20 h-[72px] flex items-center justify-between gap-3 px-4 sm:px-6 bg-white/90 backdrop-blur" style={{ borderBottom: "1px solid var(--border)" }}>
          <button className="sa-icon-btn" aria-label="Toggle navigation" onClick={() => (window.matchMedia("(min-width: 1280px)").matches ? setCollapsed((c) => !c) : setNavOpen(!navOpen))}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3">
            <a href={USER_APP_URL || PROTOTYPE_URL} className="sa-btn hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold bg-white" style={{ border: "1px solid var(--border)", color: "var(--text-soft)" }}>
              Open user app <ExternalLink size={14} />
            </a>
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full" aria-label="Account menu" aria-expanded={menuOpen}>
                <Avatar name={name} size={38} />
                <ChevronDown size={14} className="hidden sm:block" style={{ color: "var(--text-muted)" }} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-20 w-[260px] bg-white rounded-xl p-2" style={{ boxShadow: "var(--shadow-pop)" }}>
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
                    <button onClick={() => void signOut()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]" style={{ color: "var(--text-soft)" }}>
                      <LogOut size={17} />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">{children}</main>
        <footer className="text-center text-[12.5px] py-6" style={{ color: "var(--text-faint)" }}>
          Smartconferu Super Admin
        </footer>
      </div>
    </div>
  );
}
