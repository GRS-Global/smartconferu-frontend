import {
  Award, BarChart3, Bell, Building2, Calendar, CreditCard, FileCheck, FileText, History, House, Image as ImageIcon, Mail, MessageSquare, Send, Settings, ShieldCheck, Users, type LucideIcon,
} from "lucide-react";
import { CERTIFICATES_ENABLED, FEEDBACK_ENABLED, FLYER_ENABLED } from "@/lib/config";
import { comingSoonHref } from "@/lib/navigation";
import type { ConferenceRole } from "@/types/conference";

/* The conference menus of the three workspaces. Every entry is a page of this app (`app`); a screen that is not built yet points at the
   internal "Coming soon" page. Slugs are URL-encoded here; callers pass the conference's slug. */

export interface MenuLeaf {
  key: string;
  label: string;
  icon?: LucideIcon;
  /** A page of this app. */
  app: (slug: string) => string;
  /** Shown only while the conference runs this screening step (Conference Settings › Submissions). */
  screening?: "initialCheck" | "plagiarism";
}
/** A top-level entry: a page of its own, or a group of `children` (then it has no page itself). `soon`: shown in its place, greyed out with
 *  a "Soon" tag and no link (a screen switched off in lib/config.ts). */
export interface MenuItem extends Omit<MenuLeaf, "app"> { app?: MenuLeaf["app"]; children?: MenuLeaf[]; soon?: boolean }

const e = encodeURIComponent;

/** The entries switched off in lib/config.ts keep their place in the menu but become "Soon" (no link, no sub-items). */
const OFF = new Set([...(CERTIFICATES_ENABLED ? [] : ["certificates"]), ...(FLYER_ENABLED ? [] : ["flyer"])]);
const live = (items: MenuItem[]): MenuItem[] => items.map((i) => (OFF.has(i.key) ? { key: i.key, label: i.label, icon: i.icon, soon: true } : i));

export const AUTHOR_MENU: MenuItem[] = live([
  { key: "overview", label: "Dashboard", icon: House, app: (s) => `/author/${e(s)}/dashboard` },
  { key: "submissions", label: "My Submissions", icon: FileText, app: (s) => `/author/${e(s)}/submissions` },
  { key: "flyer", label: "My flyer", icon: ImageIcon, app: (s) => `/author/${e(s)}/flyer` },
  { key: "certificates", label: "Certificates", icon: Award, app: (s) => `/author/${e(s)}/certificates` },
  ...(FEEDBACK_ENABLED ? [{ key: "feedback", label: "Feedback", icon: MessageSquare, app: (s: string) => `/author/${e(s)}/feedback` }] : []),
  { key: "updates", label: "Updates", icon: Bell, app: (s) => `/author/${e(s)}/updates` },
  { key: "activity-log", label: "Activity Log", icon: History, app: (s) => `/author/${e(s)}/activity-logs` },
]);

export const REVIEWER_MENU: MenuItem[] = live([
  { key: "overview", label: "Dashboard", icon: Building2, app: (s) => `/reviewer/${e(s)}/overview` },
  { key: "reviews", label: "My Reviews", icon: FileCheck, app: (s) => `/reviewer/${e(s)}/reviews` },
  { key: "certificates", label: "Certificates", icon: Award, app: (s) => `/reviewer/${e(s)}/certificates` },
  { key: "updates", label: "Updates", icon: Bell, app: (s) => `/reviewer/${e(s)}/updates` },
  { key: "activity-log", label: "Activity Log", icon: History, app: (s) => `/reviewer/${e(s)}/activity-logs` },
]);

export const CHAIR_MENU: MenuItem[] = live([
  { key: "overview", label: "Dashboard", icon: Building2, app: (s) => `/chair/${e(s)}/dashboard` },
  { key: "cfp", label: "Call for Papers", icon: Send, app: (s) => `/chair/${e(s)}/cfp` },
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
  { key: "registration", label: "Registration", icon: Users, soon: true },
  { key: "programme", label: "Program", icon: Calendar, soon: true },
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
]);

/** The "Coming soon" block under the menu: the chair's items that are announced but not built in the prototype either. */
export const SOON: Record<"author" | "reviewer" | "chair", Array<{ key: string; label: string; icon: LucideIcon }>> = {
  author: [],
  reviewer: [],
  chair: [{ key: "payment", label: "Payment", icon: CreditCard }, { key: "communications", label: "Communications", icon: Mail }],
};

/** The order of the "Coming soon" list at the bottom of the menu (by item key); anything not named here follows, in menu order. */
export const SOON_ORDER = ["registration", "flyer", "programme", "certificates", "payment", "communications"];

export const MENUS: Record<"author" | "reviewer" | "chair", MenuItem[]> = { author: AUTHOR_MENU, reviewer: REVIEWER_MENU, chair: CHAIR_MENU };

/** Where a menu entry goes: always a page of this app. */
export function hrefOf(item: Pick<MenuItem, "app">, slug: string): { href: string; external: boolean } {
  return { href: item.app ? item.app(slug) : `/chair/${e(slug)}`, external: false };
}

/* Which roles have their landing page in this app. Flip a role to true when its Dashboard page exists (the dashboard's "Enter",
   the role switcher and "Switch conference" use it). */
export const ROLE_PORTED: Record<ConferenceRole, boolean> = { author: true, reviewer: true, chair: true, committee: false };

/** The page a role lands on in a conference. */
export function roleLanding(slug: string, role: ConferenceRole): { href: string; external: boolean } {
  if (role === "author") return { href: `/author/${e(slug)}/dashboard`, external: false };
  if (role === "reviewer" && ROLE_PORTED.reviewer) return { href: `/reviewer/${e(slug)}/overview`, external: false };
  if (role === "chair" && ROLE_PORTED.chair) return { href: `/chair/${e(slug)}/dashboard`, external: false };
  return { href: comingSoonHref("committee"), external: false };
}
