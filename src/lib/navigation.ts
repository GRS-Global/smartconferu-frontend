export interface NavItem {
  label: string;
  /** Internal route of this app. */
  href?: string;
  /** A static page outside the React app (e.g. /terms): opened with a full page load, not client navigation. */
  external?: boolean;
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
      { label: "My Achievements", href: "/my-achievements" }, // not built yet: a "Coming soon" page
      { label: "My Receipts", href: "/receipts" },
      { label: "Terms of Service", href: "/terms", external: true }, // public static page (public/terms)
    ],
  },
];

export function resolveHref(item: NavItem): { href: string; external: boolean } {
  return { href: item.href ?? "/dashboard", external: Boolean(item.external) };
}

/** Screens that are announced but not built yet: they open the internal "Coming soon" page (/coming-soon?feature=<key>). */
export const COMING_SOON = {
  registration: "Registration",
  programme: "Programme",
  "paper-edit": "Edit paper",
  committee: "Committee workspace",
} as const;
export type ComingSoonKey = keyof typeof COMING_SOON;
export const comingSoonHref = (key: ComingSoonKey): string => `/coming-soon?feature=${key}`;

export function isActive(item: NavItem, pathname: string): boolean {
  return Boolean(item.href) && (pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Full-page navigation to an address (callers use it when a destination is flagged `external`). */
export function openPrototypePage(url: string): void {
  window.location.href = url;
}
