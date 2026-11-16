import { DATA_SOURCE } from "@/lib/config";
import type { AppNotification } from "@/types/notification";

/** An unread notification as the bell counts it. */
export interface UnreadRow { id: string; kind: string; slug: string | null }

/** The newest rows the page loads (the prototype's own limit). */
export const NOTIFICATIONS_LIMIT = 100;

/** The contract the Notifications page and the header bell depend on. Failures throw: AuthRequiredError (no session),
 *  ServiceConfigError (Supabase not configured) or ServiceError (a request failed, with a message ready to show). */
export interface NotificationService {
  /** The signed-in user's latest notifications, newest first. */
  list(): Promise<AppNotification[]>;
  /** The emails the platform sent to the signed-in user (the Emails tab), newest first, as items of kind "email". They are
   *  read-only copies: read / unread for them is kept by the page, for the visit. */
  listEmails(): Promise<AppNotification[]>;
  /** How many of the signed-in user's notifications are unread (all of them, not only the latest 100). */
  unreadCount(): Promise<number>;
  /** The user's unread notifications, each reduced to what the header bell needs to count them inside one conference: its id, its kind and its
   *  conference's slug (null when it has none). The newest 500. */
  unreadList(): Promise<UnreadRow[]>;
  /** Marks one of the user's own notifications read. Resolves only when the update went through. */
  markRead(id: string): Promise<void>;
  /** Marks one of the user's own notifications unread again (the prototype's read / unread toggle). */
  markUnread(id: string): Promise<void>;
  /** Marks every unread notification of the signed-in user read, whatever is on screen. */
  markAllRead(): Promise<void>;
}

/** The service for the configured data source. `mock` is only used when NEXT_PUBLIC_DATA_SOURCE=mock (no network);
 *  there is no fallback from one source to the other. */
export async function getNotificationService(): Promise<NotificationService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/notifications")).mockNotificationService;
  return (await import("./supabase/notifications")).supabaseNotificationService;
}
