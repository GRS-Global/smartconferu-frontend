import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile/components/profile-page";

export const metadata: Metadata = { title: "My Profile" };

export default async function Profile({ searchParams }: { searchParams: Promise<{ settings?: string }> }) {
  const { settings } = await searchParams;
  return <ProfilePage openSettings={settings === "open"} />;
}
