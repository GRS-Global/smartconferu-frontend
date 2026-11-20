import { Suspense } from "react";
import { LicenseRequestsPage } from "@/features/super-admin/components/more-queues";

export const metadata = { title: "License Extensions" };

export default function Page() {
  return (
    <Suspense>
      <LicenseRequestsPage />
    </Suspense>
  );
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
