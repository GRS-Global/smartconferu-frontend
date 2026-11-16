import {
  Award, BarChart3, Bell, Building2, Calendar, CreditCard, FileCheck, FileText, History, House, Image as ImageIcon, Mail, MessageSquare, Send, Settings, ShieldCheck, Users, type LucideIcon,
} from "lucide-react";
import { PROTOTYPE_URL } from "@/lib/config";
import type { ConferenceRole } from "@/types/conference";

/* The conference menus of the three workspaces — the prototype's AUTHOR_SIDEBAR_ITEMS, REVIEWER_SIDEBAR_ITEMS and
   CHAIR_SIDEBAR_ITEMS (src/author-journey.jsx). One entry is a page of this app (`app`) or, while its screen is not ported yet,
   the prototype's page of the same name (`prototype`). When a screen is ported, move its entry from `prototype` to `app`: nothing
   else has to change. Slugs are URL-encoded here; callers pass the conference's slug. */

export interface MenuLeaf {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** A page of this app. */
  app?: (slug: string) => string;
  /** The prototype's page, until ported. */
  prototype?: (slug: string) => string;
  /** Shown only while the conference runs this screening step (Conference Settings › Submissions). */
  screening?: "initialCheck" | "plagiarism";
}
export interface MenuItem extends MenuLeaf { children?: MenuLeaf[] }

const e = encodeURIComponent;
const p = (path: (s: string) => string) => ({ prototype: (s: string) => `/prototype${path(s)}` });

export const AUTHOR_MENU: MenuItem[] = [
  { key: "overview", label: "Dashboard", icon: House, app: (s) => `/conference/${e(s)}/author` },
  { key: "submissions", label: "My Submissions", icon: FileText, app: (s) => `/author/${e(s)}/submissions` },
  { key: "flyer", label: "My flyer", icon: ImageIcon, app: (s) => `/author/${e(s)}/flyer` },
  { key: "certificates", label: "Certificates", icon: Award, app: (s) => `/author/${e(s)}/certificates` },
  { key: "feedback", label: "Feedback", icon: MessageSquare, app: (s) => `/author/${e(s)}/feedback` },
  { key: "updates", label: "Updates", icon: Bell, app: (s) => `/author/${e(s)}/updates` },
  { key: "activity-log", label: "Activity Log", icon: History, app: (s) => `/author/${e(s)}/activity-logs` },
];

export const REVIEWER_MENU: MenuItem[] = [
  { key: "overview", label: "Dashboard", icon: Building2, app: (s) => `/reviewer/${e(s)}/overview` },
  { key: "reviews", label: "My Reviews", icon: FileCheck, app: (s) => `/reviewer/${e(s)}/reviews` },
  { key: "certificates", label: "Certificates", icon: Award, app: (s) => `/reviewer/${e(s)}/certificates` },
  { key: "updates", label: "Updates", icon: Bell, app: (s) => `/reviewer/${e(s)}/updates` },
  { key: "activity-log", label: "Activity Log", icon: History, app: (s) => `/reviewer/${e(s)}/activity-logs` },
];

export const CHAIR_MENU: MenuItem[] = [
  { key: "overview", label: "Dashboard", icon: Building2, app: (s) => `/conference/${e(s)}/chair` },
  { key: "cfp", label: "Call for Papers", icon: Send, app: (s) => `/cfp-manager/${e(s)}` },
  {
    key: "submissions", label: "Submissions", icon: FileText,
    children: [
      { key: "list", label: "List", app: (s) => `/chair/${e(s)}` },
      { key: "manage", label: "Manage", app: (s) => `/chair/${e(s)}/manage` },
      { key: "email", label: "Email Communication", app: (s) => `/chair/${e(s)}/email` },
    ],
  },
  {
    key: "screening", label: "Screening", icon: ShieldCheck,
    children: [
      { key: "initial-check", label: "Initial Check", screening: "initialCheck", app: (s) => `/chair/${e(s)}/initial-check` },
      { key: "plagiarism", label: "Plagiarism Check", screening: "plagiarism", app: (s) => `/chair/${e(s)}/plagiarism` },
    ],
  },
  {
    key: "peer-review", label: "Peer Review", icon: FileCheck,
    children: [
      { key: "list", label: "List", app: (s) => `/chair/${e(s)}/peer-review` },
      { key: "reviewers", label: "Reviewers", app: (s) => `/chair/${e(s)}/peer-review/reviewers` },
      { key: "manage", label: "Manage", app: (s) => `/chair/${e(s)}/peer-review/manage` },
    ],
  },
  { key: "registration", label: "Registration", icon: Users, ...p((s) => `/chair/${e(s)}/registration`) },
  {
    key: "programme", label: "Program", icon: Calendar,
    children: [
      { key: "overview", label: "Overview", ...p((s) => `/chair/${e(s)}/programme`) },
      { key: "full", label: "Full Program", ...p((s) => `/chair/${e(s)}/programme/full`) },
      { key: "manage", label: "Manage", ...p((s) => `/chair/${e(s)}/programme/manage`) },
    ],
  },
  {
    key: "certificates", label: "Certificates", icon: Award,
    children: [
      { key: "design", label: "Design", app: (s) => `/chair/${e(s)}/certificates` },
      { key: "distribute", label: "Distribute", app: (s) => `/chair/${e(s)}/certificates/distribute` },
    ],
  },
  { key: "flyer", label: "Speaker Flyer", icon: ImageIcon, app: (s) => `/chair/${e(s)}/flyer` },
  { key: "analytics", label: "Analytics", icon: BarChart3, app: (s) => `/chair/${e(s)}/analytics` },
  {
    key: "settings", label: "Conference Settings", icon: Settings,
    children: [
      { key: "details", label: "Conference Details", app: (s) => `/chair/${e(s)}/settings` },
      { key: "submissions", label: "Submissions", app: (s) => `/chair/${e(s)}/settings/submissions` },
      { key: "review", label: "Review", app: (s) => `/chair/${e(s)}/settings/review` },
      { key: "decision", label: "Decision", app: (s) => `/chair/${e(s)}/settings/decision` },
      { key: "email-templates", label: "Email Templates", app: (s) => `/chair/${e(s)}/settings/email-templates` },
      { key: "activity-logs", label: "Activity Logs", app: (s) => `/chair/${e(s)}/settings/activity-logs` },
      { key: "email-logs", label: "Email Logs", app: (s) => `/chair/${e(s)}/settings/email-logs` },
    ],
  },
];

/** The chair's menu items that are announced but not built in the prototype either. */
export const CHAIR_SOON: Array<{ label: string; icon: LucideIcon }> = [{ label: "Payment", icon: CreditCard }, { label: "Communications", icon: Mail }];

export const MENUS: Record<"author" | "reviewer" | "chair", MenuItem[]> = { author: AUTHOR_MENU, reviewer: REVIEWER_MENU, chair: CHAIR_MENU };

/** Where a menu entry goes: a page of this app or the prototype's. */
export function hrefOf(item: MenuLeaf, slug: string): { href: string; external: boolean } {
  if (item.app) return { href: item.app(slug), external: false };
  return { href: `${PROTOTYPE_URL}${item.prototype!(slug)}`, external: true };
}

/* Which roles have their landing page in this app. Flip a role to true when its Dashboard page exists (the dashboard's "Enter",
   the role switcher and "Switch conference" use it). */
export const ROLE_PORTED: Record<ConferenceRole, boolean> = { author: true, reviewer: true, chair: true, committee: false };

/** The page a role lands on in a conference. */
export function roleLanding(slug: string, role: ConferenceRole): { href: string; external: boolean } {
  if (role === "author") return { href: `/conference/${e(slug)}/author`, external: false };
  if (role === "reviewer" && ROLE_PORTED.reviewer) return { href: `/reviewer/${e(slug)}/overview`, external: false };
  if (role === "chair" && ROLE_PORTED.chair) return { href: `/conference/${e(slug)}/chair`, external: false };
  return { href: `${PROTOTYPE_URL}/prototype/conference/${e(slug)}/${role}`, external: true };
}
