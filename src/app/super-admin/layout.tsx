import type { Metadata } from "next";
import "@/features/super-admin/super-admin.css";

export const metadata: Metadata = {
  title: { default: "Super Admin", template: "%s · Super Admin · Smartconferu" },
  robots: { index: false, follow: false },
};

/* The Super Admin console: its own sign-in and session (the Smartconferu API), separate from the
   user app's Supabase session. */
export default function SuperAdminLayout({ children }: LayoutProps<"/super-admin">) {
  return children;
}
