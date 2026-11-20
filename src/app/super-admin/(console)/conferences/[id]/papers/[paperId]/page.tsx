import { PaperDetailPage } from "@/features/super-admin/components/paper-detail-page";

export default async function Page({ params }: PageProps<"/super-admin/conferences/[id]/papers/[paperId]">) {
  const { id, paperId } = await params;
  return <PaperDetailPage conferenceId={id} paperId={paperId} />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
