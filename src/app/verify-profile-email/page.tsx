import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { ConfirmProfileEmail } from "@/features/auth/components/confirm-profile-email";

export const metadata: Metadata = { title: "Verify your email address" };

export default function VerifyProfileEmailPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <ConfirmProfileEmail />
    </main>
  );
}
