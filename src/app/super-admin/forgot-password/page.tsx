import { Suspense } from "react";
import { AdminForgotPasswordPage } from "@/features/super-admin/components/password-pages";

export const metadata = { title: "Forgot password" };

export default function Page() {
  return (
    <Suspense>
      <AdminForgotPasswordPage />
    </Suspense>
  );
}
