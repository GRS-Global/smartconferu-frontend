import type { Metadata } from "next";
import { AuthBackdrop } from "@/components/layout/auth-backdrop";
import { SmartCfpSoon } from "@/features/cfp/components/smart-cfp-soon";

export const metadata: Metadata = { title: "Smart CFP — coming soon" };

/** Smart CFP (the public directory of Calls for Papers) is not built into this app yet: the menu and the sign-in page lead here. Open to everyone. */
export default function SmartCfpPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <SmartCfpSoon />
    </main>
  );
}
