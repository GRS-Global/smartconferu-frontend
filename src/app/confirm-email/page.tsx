import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { ConfirmEmailChange } from "@/features/auth/components/confirm-email-change";

export const metadata: Metadata = { title: "Confirm your new email" };

export default function ConfirmEmailPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <ConfirmEmailChange />
    </main>
  );
}
