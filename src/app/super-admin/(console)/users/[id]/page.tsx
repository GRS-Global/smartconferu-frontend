import { UserDetailPage } from "@/features/super-admin/components/users-pages";

export default async function Page({ params }: PageProps<"/super-admin/users/[id]">) {
  const { id } = await params;
  return <UserDetailPage id={id} />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
