/** Fired when the console changes what is read (the Notifications page), so the header bell counts again at once. */
export const NOTIFICATIONS_CHANGED = "sa-notifications-changed";
export const notificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
