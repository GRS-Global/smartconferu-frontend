"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DATA_SOURCE } from "@/lib/config";
import { getConferenceService } from "@/services/conferences";
import { getNotificationService, type UnreadRow } from "@/services/notifications";
import { audienceOf, type Audience } from "./destinations";
import { announceLiveNotification, openLiveNotifications } from "./live-events";

/* The header bell's unread number, shared with the Notifications page so both always agree.

   One lightweight query pair per signed-in page load (the provider mounts once in the app shell), and with the own backend a live stream
   (Server-Sent Events, live-events.ts): a new notification updates the number at once and tells the Notifications page to reload its list. The count is the whole account's; the list of unread rows (id, kind, conference) lets the bell count inside one
   conference for one role, as the prototype's bell does there. The page keeps both in step as it marks notifications read,
   instead of asking again. A failed query is not an error screen: the bell simply shows no number. */

interface UnreadValue {
  /** Unread notifications of the signed-in user; null until the count arrives (or if it could not be read). */
  unread: number | null;
  /** Unread notifications of one conference meant for one role (the bell inside a conference); null until they are known. */
  unreadIn: (slug: string, role: Audience) => number | null;
  /** Sets the number (after "Mark all as read": 0). */
  setUnread: (n: number) => void;
  /** One or more notifications were marked read (`id`: which one, so the conference count follows). */
  decrease: (by?: number, id?: string) => void;
  /** One or more notifications were marked unread again (`row`: which one). */
  increase: (by?: number, row?: UnreadRow) => void;
  /** The page's own count (of the rows it loaded), used only when the header's count query failed. */
  fillIfCountFailed: (n: number) => void;
}

const UnreadContext = createContext<UnreadValue | null>(null);

// React runs an effect twice in development; both runs share one request.
let counting: Promise<{ count: number; rows: UnreadRow[] | null }> | null = null;
function countUnread() {
  counting ??= getNotificationService()
    .then(async (s) => ({ count: await s.unreadCount(), rows: await s.unreadList().catch(() => null) }))
    .finally(() => { counting = null; });
  return counting;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unread, setUnreadState] = useState<number | null>(null);
  const [rows, setRows] = useState<UnreadRow[] | null>(null);
  const [countFailed, setCountFailed] = useState(false);
  const rowsLoaded = useRef(false);
  // Conferences this account chairs: a withdrawal is the chair's copy there (the prototype's liveAlertOf). Asked for only when one is unread.
  const [chairOf, setChairOf] = useState<ReadonlySet<string>>(new Set());
  const hasWithdrawn = rows?.some((x) => x.kind === "withdrawn") ?? false;
  useEffect(() => {
    if (!hasWithdrawn) return undefined;
    let cancelled = false;
    getConferenceService()
      .then((s) => s.loadDashboard())
      .then((d) => { if (!cancelled) setChairOf(new Set(d.source.conferences.filter((c) => c.roles.includes("chair")).map((c) => c.conference.id))); })
      .catch(() => { /* without it a withdrawal reads as an author's, which is the prototype's default */ });
    return () => { cancelled = true; };
  }, [hasWithdrawn]);

  useEffect(() => {
    let cancelled = false;
    countUnread()
      .then((r) => { if (!cancelled) { setUnreadState((current) => current ?? r.count); setRows((current) => current ?? r.rows); if (r.rows) rowsLoaded.current = true; } })
      .catch(() => { if (!cancelled) setCountFailed(true); }); // no number on the bell; the Notifications page reports its own errors
    return () => { cancelled = true; };
  }, []);

  // Own backend: new notifications arrive live. The stream says "something new, this many unread now"; the bell's per-conference list is read again
  // (the event does not carry the conference) and the Notifications page, if it is open, reloads its list.
  useEffect(() => {
    if (DATA_SOURCE !== "api") return undefined;
    let cancelled = false;
    const refreshRows = () => { getNotificationService().then((s) => s.unreadList()).then((r) => { if (!cancelled) setRows(r); }).catch(() => undefined); };
    // The first "ready" comes right after the first read above, which already loaded the list: only a later one (the stream reconnected) reads it again.
    let first = true;
    const close = openLiveNotifications({
      onReady: (n) => { setUnreadState(n); if (first) { first = false; void (counting ?? Promise.resolve()).catch(() => undefined).then(() => { if (!rowsLoaded.current) refreshRows(); }); } else refreshRows(); },
      onNotification: (n) => { setUnreadState(n); refreshRows(); announceLiveNotification(); },
    });
    return () => { cancelled = true; close(); };
  }, []);

  const setUnread = useCallback((n: number) => { setUnreadState(Math.max(0, n)); if (n === 0) setRows([]); }, []);
  const decrease = useCallback((by = 1, id?: string) => {
    setUnreadState((u) => (u === null ? u : Math.max(0, u - by)));
    if (id) setRows((r) => (r ? r.filter((x) => x.id !== id) : r));
  }, []);
  const increase = useCallback((by = 1, row?: UnreadRow) => {
    setUnreadState((u) => (u === null ? u : u + by));
    if (row) setRows((r) => (r && !r.some((x) => x.id === row.id) ? [row, ...r] : r));
  }, []);
  const fillIfCountFailed = useCallback((n: number) => { if (countFailed) setUnreadState((u) => u ?? n); }, [countFailed]);
  // Whose a notification is comes from its kind (the same rule as the role chip); a withdrawal is the chair's copy in a conference this account chairs.
  const unreadIn = useCallback(
    (slug: string, role: Audience) => (rows ? rows.filter((x) => x.slug === slug && audienceOf({ kind: x.kind, conference: x.slug ? { slug: x.slug, acronym: "" } : null, email: undefined }, chairOf) === role).length : null),
    [rows, chairOf],
  );
  const value = useMemo(() => ({ unread, unreadIn, setUnread, decrease, increase, fillIfCountFailed }), [unread, unreadIn, setUnread, decrease, increase, fillIfCountFailed]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnreadCount(): UnreadValue {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error("useUnreadCount must be used inside <NotificationsProvider>.");
  return ctx;
}
