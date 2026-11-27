"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useProfile } from "@/features/profile/profile-context";

/** The user app's pages a Super Admin may still open: their own profile (the console's account menu links to it: "My profile"), and
 *  Complete Profile, where the profile page sends an account that still owes required details. */
const ADMIN_OPEN = ["/profile", "/complete-profile"];
const isOpenForAdmin = (path: string) => ADMIN_OPEN.some((p) => path === p || path.startsWith(`${p}/`));

/** A Super Admin account belongs in the admin console: the user app's other pages (dashboard, conferences, settings …) do not open for it, they send it to
 *  the console's dashboard instead (which asks for the admin sign-in when it needs one). Nothing of the page is shown while that happens. A read-only support
 *  view is a different person's session, so it is not affected. */
export function SuperAdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useProfile();
  const admin = state.status === "ready" && state.profile.isSuperAdmin === true && !isOpenForAdmin(pathname);
  useEffect(() => {
    if (admin) router.replace("/super-admin");
  }, [admin, router]);
  return admin ? null : <>{children}</>;
}
