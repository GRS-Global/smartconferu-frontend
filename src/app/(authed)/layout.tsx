import type { ReactNode } from "react";
import { ProfileProvider } from "@/features/profile/profile-context";
import { ColorBlindApplier } from "@/features/settings/components/color-blind-applier";

/** Everything behind sign-in shares one loaded profile (the completeness gate, the header, My Profile, Settings). */
export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <ColorBlindApplier />
      {children}
    </ProfileProvider>
  );
}
