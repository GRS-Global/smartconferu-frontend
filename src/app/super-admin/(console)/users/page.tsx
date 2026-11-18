import { UsersPage } from "@/features/super-admin/components/users-pages";

export const metadata = { title: "Users" };

export default function Page() {
  return <UsersPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
