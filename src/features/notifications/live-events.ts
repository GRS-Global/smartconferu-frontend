import { api } from "@/lib/api-client";
import { API_URL } from "@/lib/config";
import { AuthRequiredError } from "@/services/errors";

/* The live notification stream of the own backend (Server-Sent Events, Backend/src/modules/notifications/live-events.controller.ts).
   A browser EventSource cannot send an Authorization header, so a one-minute ticket is fetched first (POST /me/events/ticket) and put in the URL.
   Events: `ready` ({ unread }) when the stream opens, `notification` ({ notification, unread }) for every new bell notification, `expired` after an hour.
   Whenever the stream ends (expired, dropped, server restarted) a new ticket is fetched and it reopens with the id of the last event it saw, so what was
   missed in between is sent first. One stream per tab: the NotificationsProvider owns it. */

export const LIVE_NOTIFICATION_EVENT = "notifications-live";

/** The page's own list listens to this and reloads (silently) when something new arrived. */
export const announceLiveNotification = () => window.dispatchEvent(new Event(LIVE_NOTIFICATION_EVENT));

export interface LiveHandlers {
  /** The stream is open: `unread` is the account's whole unread count. */
  onReady: (unread: number) => void;
  /** A new notification was saved: `unread` is the account's whole unread count after it. */
  onNotification: (unread: number) => void;
}

const RETRY_MIN_MS = 3000;
const RETRY_MAX_MS = 60000;
const number = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Opens the stream and keeps it open until the returned function is called (sign-out / the page closes). */
export function openLiveNotifications(handlers: LiveHandlers): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return () => undefined;
  let stopped = false;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastId = "";
  let wait = RETRY_MIN_MS;

  const later = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void connect(); }, wait);
    wait = Math.min(wait * 2, RETRY_MAX_MS);
  };

  const connect = async () => {
    if (stopped) return;
    source?.close();
    let ticket: string;
    try {
      ticket = (await api<{ ticket: string }>("/me/events/ticket", { method: "POST" })).ticket;
    } catch (e) {
      if (e instanceof AuthRequiredError) return; // signed out: nothing to listen for
      later();
      return;
    }
    if (stopped) return;
    const url = `${API_URL}/api/v1/me/events?ticket=${encodeURIComponent(ticket)}${lastId ? `&lastEventId=${encodeURIComponent(lastId)}` : ""}`;
    const es = new EventSource(url);
    source = es;
    const read = (e: MessageEvent): Record<string, unknown> | null => {
      if (e.lastEventId) lastId = e.lastEventId;
      try { return JSON.parse(String(e.data)) as Record<string, unknown>; } catch { return null; }
    };
    es.addEventListener("ready", (e) => {
      wait = RETRY_MIN_MS; // a working stream: the next drop starts again at the short delay
      const n = number(read(e as MessageEvent)?.unread);
      if (n !== null) handlers.onReady(n);
    });
    es.addEventListener("notification", (e) => {
      const n = number(read(e as MessageEvent)?.unread);
      if (n !== null) handlers.onNotification(n);
    });
    // The server ends a stream after an hour, or the connection dropped: the old ticket is spent, so close and start again with a new one (EventSource would retry with the same URL).
    es.addEventListener("expired", () => { es.close(); wait = RETRY_MIN_MS; later(); });
    es.onerror = () => { es.close(); later(); };
  };

  void connect();
  return () => { stopped = true; clearTimeout(timer); source?.close(); };
}
