"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getConferenceService } from "@/services/conferences";
import { DATA_SOURCE } from "@/lib/config";
import { getNotificationService } from "@/services/notifications";
import { AuthRequiredError, ServiceConfigError, ServiceError } from "@/services/errors";
import type { AppNotification } from "@/types/notification";
import { LIVE_NOTIFICATION_EVENT } from "./live-events";
import { useUnreadCount } from "./notifications-context";

export type NotificationsState =
  | { status: "loading" }
  | { status: "ready"; items: AppNotification[] }
  | { status: "auth" }
  | { status: "error"; message: string; config: boolean };

/** An email row whose read / unread lives only on this page for the visit: everywhere but the own backend, which saves it and counts it on the bell. */
const localOnly = (n: AppNotification) => Boolean(n.email) && DATA_SOURCE !== "api";
const failure = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong — please try again.");
// A ServiceError already says what failed ("Couldn't mark this notification as read. …"); anything else gets the sentence in front.
const updateFailure = (e: unknown, what: string) => (e instanceof ServiceError ? e.message : `Couldn't ${what}. ${failure(e)}`);

/** Loads the latest notifications and owns the ways of changing them: read, unread (the prototype's toggle), "mark all as
 *  read" and dismiss. Every database update is confirmed by the service before anything is shown as changed: a failure leaves
 *  the row as it was, keeps the header number, and sets `actionError`. Requests do not overlap: one at a time per row, and
 *  nothing else while "mark all" is running (and the other way round).
 *
 *  Dismiss is the prototype's: the card leaves the list for this visit (its state is in memory there too, and a reload
 *  brings it back). Nothing is deleted: the database gives users no way to delete a notification. */
export function useNotifications() {
  const unread = useUnreadCount();
  const [state, setState] = useState<NotificationsState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  // Conferences this account chairs: a withdrawal is the chair's copy there (the prototype's own rule for its role chip).
  const [chairOf, setChairOf] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [emailsError, setEmailsError] = useState("");
  const busy = useRef({ ids: new Set<string>(), all: false }); // synchronous guard: state updates arrive a render later

  useEffect(() => {
    let cancelled = false;
    getNotificationService()
      .then((service) => Promise.all([
        service.list(),
        // The Emails tab must never take the notifications down with it: a failed email read is reported beside the list.
        service.listEmails().then((mails) => ({ mails, error: "" }), (e: unknown) => {
          if (e instanceof AuthRequiredError) throw e;
          return { mails: [] as AppNotification[], error: failure(e) };
        }),
      ]))
      .then(([items, emails]) => {
        if (cancelled) return;
        setEmailsError(emails.error);
        setState({ status: "ready", items: [...items, ...emails.mails] });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof AuthRequiredError) setState({ status: "auth" });
        else setState({ status: "error", message: failure(e), config: e instanceof ServiceConfigError });
      });
    return () => { cancelled = true; };
  }, [tick]);

  // A new notification arrived live (the bell's stream): read the list again without the loading state, so it simply appears.
  useEffect(() => {
    const again = () => setTick((t) => t + 1);
    window.addEventListener(LIVE_NOTIFICATION_EVENT, again);
    return () => window.removeEventListener(LIVE_NOTIFICATION_EVENT, again);
  }, []);

  // The conferences this account chairs decide where a withdrawal and a conference decision lead, so they are asked for when one is listed.
  const loadedWithdrawals = state.status === "ready" && state.items.some((n) => n.kind === "withdrawn" || n.kind === "conference_decision" || n.kind === "conference_suspension");
  useEffect(() => {
    if (!loadedWithdrawals) return;
    let cancelled = false;
    getConferenceService()
      .then((s) => s.loadDashboard())
      .then((d) => { if (!cancelled) setChairOf(new Set(d.source.conferences.filter((c) => c.roles.includes("chair")).map((c) => c.conference.id))); })
      .catch(() => { /* without it a withdrawal reads as an author's, which is the prototype's default */ });
    return () => { cancelled = true; };
  }, [loadedWithdrawals]);

  // When the header's count query failed, the rows loaded here give the bell a number.
  const { fillIfCountFailed } = unread;
  useEffect(() => {
    if (state.status === "ready") fillIfCountFailed(state.items.filter((n) => !n.read && !localOnly(n)).length);
  }, [state, fillIfCountFailed]);

  const retry = useCallback(() => { setState({ status: "loading" }); setDismissed(new Set()); setTick((t) => t + 1); }, []);

  const sessionEnded = (e: unknown): boolean => {
    if (e instanceof AuthRequiredError) { setState({ status: "auth" }); return true; }
    return false;
  };

  const setEmailRead = (id: string, read: boolean) => {
    setState((s) => (s.status === "ready" ? { status: "ready", items: s.items.map((n) => (n.id === id ? { ...n, read } : n)) } : s));
    setAnnouncement(read ? "Marked as read." : "Marked as unread.");
  };

  /** Marks one notification read. Resolves true when it is read (it already was, or the update went through). */
  const markRead = useCallback(async (id: string): Promise<boolean> => {
    const row = state.status === "ready" ? state.items.find((n) => n.id === id) : undefined;
    if (!row) return false;
    if (row.read) return true;
    if (localOnly(row)) { setEmailRead(id, true); return true; } // an email copy without the own backend: kept by this page for the visit
    if (busy.current.all || busy.current.ids.has(id)) return false;
    busy.current.ids.add(id);
    setPending(new Set(busy.current.ids));
    setActionError("");
    try {
      await (await getNotificationService()).markRead(id);
      setState((s) => (s.status === "ready" ? { status: "ready", items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) } : s));
      unread.decrease(1, id);
      setAnnouncement("Marked as read.");
      return true;
    } catch (e) {
      if (!sessionEnded(e)) setActionError(updateFailure(e, "mark that notification as read"));
      return false;
    } finally {
      busy.current.ids.delete(id);
      setPending(new Set(busy.current.ids));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `unread.decrease` is stable; `state` is read for the row only
  }, [state, unread.decrease]);

  /** Marks one notification unread again. Resolves true when it is unread (it already was, or the update went through). */
  const markUnread = useCallback(async (id: string): Promise<boolean> => {
    const row = state.status === "ready" ? state.items.find((n) => n.id === id) : undefined;
    if (!row) return false;
    if (!row.read) return true;
    if (localOnly(row)) { setEmailRead(id, false); return true; }
    if (busy.current.all || busy.current.ids.has(id)) return false;
    busy.current.ids.add(id);
    setPending(new Set(busy.current.ids));
    setActionError("");
    try {
      await (await getNotificationService()).markUnread(id);
      setState((s) => (s.status === "ready" ? { status: "ready", items: s.items.map((n) => (n.id === id ? { ...n, read: false } : n)) } : s));
      // An email counts on the main bell only (the per-conference bell counts notifications), so it adds no row there.
      unread.increase(1, row.email ? undefined : { id, kind: row.kind, slug: row.conference?.slug ?? null });
      setAnnouncement("Marked as unread.");
      return true;
    } catch (e) {
      if (!sessionEnded(e)) setActionError(updateFailure(e, "mark that notification as unread"));
      return false;
    } finally {
      busy.current.ids.delete(id);
      setPending(new Set(busy.current.ids));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `unread.increase` is stable; `state` is read for the row only
  }, [state, unread.increase]);

  /** Takes a notification out of the list for this visit. An unread one is marked read on the server first: hidden but still unread, it would be
   *  counted on the bell again after the next reload with nothing on the page to read. */
  const dismiss = useCallback((id: string) => {
    const row = state.status === "ready" ? state.items.find((n) => n.id === id) : undefined;
    if (!row || dismissed.has(id)) return;
    setDismissed((d) => new Set(d).add(id));
    if (!row.read && !localOnly(row)) void markRead(id); // also takes it off the bell
    setAnnouncement("Notification dismissed.");
  }, [state, dismissed, markRead]);

  /** Marks every unread notification of the signed-in user read — the whole account, not only what is listed or filtered. */
  const markAll = useCallback(async (): Promise<boolean> => {
    if (busy.current.all || busy.current.ids.size > 0) return false;
    busy.current.all = true;
    setMarkingAll(true);
    setActionError("");
    try {
      await (await getNotificationService()).markAllRead();
      setState((s) => (s.status === "ready" ? { status: "ready", items: s.items.map((n) => (n.read ? n : { ...n, read: true })) } : s));
      unread.setUnread(0);
      setAnnouncement("All notifications marked as read.");
      return true;
    } catch (e) {
      if (!sessionEnded(e)) setActionError(updateFailure(e, "mark your notifications as read"));
      return false;
    } finally {
      busy.current.all = false;
      setMarkingAll(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `unread.setUnread` is stable
  }, [unread.setUnread]);

  return { state, emailsError, retry, pending, markingAll, actionError, clearError: () => setActionError(""), announcement, markRead, markUnread, markAll, dismiss, dismissed, chairOf, unreadCount: unread.unread };
}
