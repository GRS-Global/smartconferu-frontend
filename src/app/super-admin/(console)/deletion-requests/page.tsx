import { Suspense } from "react";
import { DeletionRequestsPage } from "@/features/super-admin/components/request-queues";

export const metadata = { title: "Deletion Requests" };

export default function Page() {
  return (
    <Suspense>
      <DeletionRequestsPage />
    </Suspense>
  );
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
