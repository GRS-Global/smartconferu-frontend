import { ResearchAreasPage } from "@/features/super-admin/components/master-data-pages";

export const metadata = { title: "Research Areas" };

export default function Page() {
  return <ResearchAreasPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
