import { PROTOTYPE_URL } from "@/lib/config";

export interface NavItem {
  label: string;
  /** Internal route of this app. */
  href?: string;
  /** Screen not yet ported: opens the same page in the Vite prototype. */
  prototypePath?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Mirrors the prototype's TopNav menus (author-journey.jsx: *_MENU_ITEMS). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Conferences",
    items: [
      { label: "My Conferences", href: "/dashboard" },
      { label: "Create New Conference", href: "/create-conference" },
      { label: "My Requests", href: "/my-requests" },
    ],
  },
  {
    label: "Calls for Papers",
    items: [
      { label: "My CFP", href: "/cfp" },
      { label: "Smart CFP", href: "/smart-cfp" }, // not built yet: a "Coming soon" page
    ],
  },
  {
    label: "Publishing",
    items: [
      { label: "Publish with Us", href: "/publish" },
      { label: "My Preprints", href: "/preprints" },
      { label: "My Slides", href: "/slides" },
    ],
  },
  {
    label: "My Account",
    items: [
      { label: "My Certificates", href: "/my-certificates" },
      { label: "My Achievements", prototypePath: "/prototype/my-achievements" },
      { label: "My Receipts", href: "/receipts" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export function resolveHref(item: NavItem): { href: string; external: boolean } {
  if (item.href) return { href: item.href, external: false };
  return { href: `${PROTOTYPE_URL}${item.prototypePath ?? "/"}`, external: true };
}

export function isActive(item: NavItem, pathname: string): boolean {
  return Boolean(item.href) && (pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Full-page navigation to a screen that lives in the prototype (an absolute URL, not an internal route). */
export function openPrototypePage(url: string): void {
  window.location.href = url;
}
