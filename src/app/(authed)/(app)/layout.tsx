import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { NotificationsProvider } from "@/features/notifications/notifications-context";
import { ProfileGate } from "@/features/profile/components/profile-gate";

/** Chrome shared by every signed-in screen: the top bar and the canvas under it. The profile-completeness
 *  gate keeps accounts that still owe required details on /complete-profile. The notifications provider holds the
 *  header bell's unread number (one count query per load of the app shell). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-canvas">
        <AppHeader />
        <main>
          <ProfileGate>{children}</ProfileGate>
        </main>
      </div>
    </NotificationsProvider>
  );
}
