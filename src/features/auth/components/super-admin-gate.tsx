"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useProfile } from "@/features/profile/profile-context";

/** A Super Admin account belongs in the admin console: none of the user app's pages (dashboard, conferences, profile, settings …) open for it, they send it to
 *  the console's dashboard instead (which asks for the admin sign-in when it needs one). Nothing of the page is shown while that happens. A read-only support
 *  view is a different person's session, so it is not affected. */
export function SuperAdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state } = useProfile();
  const admin = state.status === "ready" && state.profile.isSuperAdmin === true;
  useEffect(() => {
    if (admin) router.replace("/super-admin");
  }, [admin, router]);
  return admin ? null : <>{children}</>;
}
