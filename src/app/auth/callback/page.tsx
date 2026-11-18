import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { OAuthCallback } from "@/features/auth/components/oauth-callback";

export const metadata: Metadata = { title: "Signing you in" };

export default function OAuthCallbackPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <OAuthCallback />
    </main>
  );
}
