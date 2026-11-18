import { SocietiesPage } from "@/features/super-admin/components/master-data-pages";

export const metadata = { title: "Societies" };

export default function Page() {
  return <SocietiesPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
