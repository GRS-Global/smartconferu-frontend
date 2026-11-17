import { Suspense } from "react";
import { ConferenceRequestsPage } from "@/features/super-admin/components/request-queues";

export const metadata = { title: "Conference Requests" };

export default function Page() {
  return (
    <Suspense>
      <ConferenceRequestsPage />
    </Suspense>
  );
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
