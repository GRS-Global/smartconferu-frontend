import { ProfileVerificationPage } from "@/features/super-admin/components/profile-verification-page";

export const metadata = { title: "Profile Verification" };

export default function Page() {
  return <ProfileVerificationPage />;
}

// Rendered only after the admin session is checked in the browser (features/super-admin/session.tsx).
export const instant = false;
