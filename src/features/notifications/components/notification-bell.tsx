"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "../notifications-context";

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** The header bell, as the prototype's TopNav draws it: an in-app link to /notifications with the unread number (99+ above ninety-nine),
 *  lit while on that page. The number is in the accessible name too; the tooltip is just "Notifications". */
export function NotificationBell() {
  const { unread: total, unreadIn } = useUnreadCount();
  const pathname = usePathname();
  // Inside a conference as author / reviewer (/author/<slug>/…, /reviewer/<slug>/…) the bell opens that conference's Updates,
  // with the sidebar, as the prototype does; everywhere else it is the global Notifications page.
  const inConference = /^\/(author|reviewer)\/([^/]+)/.exec(pathname);
  const href = inConference ? `/${inConference[1]}/${inConference[2]}/updates` : "/notifications";
  // ...and counts only that conference's notifications for that role.
  const unread = inConference ? unreadIn(safeDecode(inConference[2]), inConference[1] as "author" | "reviewer") : total;
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      href={href}
      aria-label={label}
      title="Notifications"
      aria-current={pathname === href ? "page" : undefined}
      className="relative flex h-10 w-10 items-center justify-center rounded-[0.7rem] text-ink-soft transition-colors hover:bg-muted hover:text-navy aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary"
    >
      <Bell size={19} strokeWidth={2} aria-hidden="true" />
      {unread ? (
        <span aria-hidden="true" className="absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-danger px-1 text-[10px] font-bold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
