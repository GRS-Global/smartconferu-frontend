import { ConferenceDetailPage } from "@/features/super-admin/components/conference-detail-page";

export default async function Page({ params }: PageProps<"/super-admin/conferences/[id]">) {
  const { id } = await params;
  return <ConferenceDetailPage id={id} />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
