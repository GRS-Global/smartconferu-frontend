import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { CompleteProfile } from "@/features/profile/components/complete-profile";

export const metadata: Metadata = { title: "Complete your profile" };

export default function CompleteProfilePage() {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center px-4 py-10">
      <AuthBackdrop />
      <Suspense fallback={<div role="status" aria-label="Loading" className="relative z-10 h-80 w-full max-w-[800px] animate-pulse rounded-2xl bg-white/90" />}>
        <CompleteProfile />
      </Suspense>
    </main>
  );
}
