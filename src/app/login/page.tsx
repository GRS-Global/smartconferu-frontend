import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <Suspense fallback={<div className="relative z-10 h-[420px] w-full max-w-[480px] animate-pulse rounded-2xl bg-white/90" role="status" aria-label="Loading sign-in" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
