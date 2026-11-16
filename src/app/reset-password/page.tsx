import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <ResetPasswordForm />
    </main>
  );
}
