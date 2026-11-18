import { DashboardPage } from "@/features/super-admin/components/dashboard-page";

export default function Page() {
  return <DashboardPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
