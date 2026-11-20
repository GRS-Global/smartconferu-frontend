import { AuditLogPage } from "@/features/super-admin/components/audit-log-page";

export const metadata = { title: "Audit Log" };

export default function Page() {
  return <AuditLogPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
