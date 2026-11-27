import { Suspense } from "react";
import { AdminResetPasswordPage } from "@/features/super-admin/components/password-pages";

export const metadata = { title: "Choose a new password" };

export default function Page() {
  return (
    <Suspense>
      <AdminResetPasswordPage />
    </Suspense>
  );
}
