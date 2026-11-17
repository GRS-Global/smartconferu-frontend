import { InstitutionsPage } from "@/features/super-admin/components/master-data-pages";

export const metadata = { title: "Institutions" };

export default function Page() {
  return <InstitutionsPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
