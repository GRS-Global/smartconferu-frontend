import { Suspense } from "react";
import { AdminLoginPage } from "@/features/super-admin/components/login-page";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense>
      <AdminLoginPage />
    </Suspense>
  );
}
