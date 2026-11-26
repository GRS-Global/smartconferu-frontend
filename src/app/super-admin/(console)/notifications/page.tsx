import { AdminNotificationsPage } from "@/features/super-admin/components/notifications-page";

export const metadata = { title: "Notifications" };

export default function Page() {
  return <AdminNotificationsPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
