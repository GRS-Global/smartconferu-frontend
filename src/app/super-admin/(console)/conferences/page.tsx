import { ConferencesPage } from "@/features/super-admin/components/conferences-page";

export const metadata = { title: "Conferences" };

export default function Page() {
  return <ConferencesPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
