import type { ReactNode } from "react";
import { SuperAdminGate } from "@/features/auth/components/super-admin-gate";
import { ProfileProvider } from "@/features/profile/profile-context";
import { ColorBlindApplier } from "@/features/settings/components/color-blind-applier";

/** Next's dev-only instant-navigation check can't prerender screens that wait for the signed-in user; opt them out (see node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md). */
export const instant = false;

/** Everything behind sign-in shares one loaded profile (the completeness gate, the header, My Profile, Settings). */
export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <ColorBlindApplier />
      <SuperAdminGate>{children}</SuperAdminGate>
    </ProfileProvider>
  );
}
