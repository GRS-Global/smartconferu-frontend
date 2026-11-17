import { EmailTemplatesPage } from "@/features/super-admin/components/email-templates-page";

export const metadata = { title: "Email Templates" };

export default function Page() {
  return <EmailTemplatesPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
