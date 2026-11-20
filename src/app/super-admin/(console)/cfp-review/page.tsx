import { Suspense } from "react";
import { CfpReviewPage } from "@/features/super-admin/components/more-queues";

export const metadata = { title: "CFP Page Review" };

export default function Page() {
  return (
    <Suspense>
      <CfpReviewPage />
    </Suspense>
  );
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
