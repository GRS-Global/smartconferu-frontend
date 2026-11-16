import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  // The page itself is the fixed-height flex column of the prototype's `.reg-page` (see globals.css).
  return (
    <main className="reg-page relative flex min-h-screen w-full flex-col items-center px-4 py-8">
      <AuthBackdrop />
      <RegisterForm />
    </main>
  );
}
