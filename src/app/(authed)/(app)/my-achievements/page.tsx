import { Award } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/layout/coming-soon-page";

export const metadata: Metadata = { title: "My Achievements — coming soon" };

export default function MyAchievements() {
  return <ComingSoonPage title="My Achievements" section="My Account" icon={<Award size={22} aria-hidden="true" />} description="Your badges and milestones as an author and reviewer, in one place. We're still building it — it will be here soon." />;
}
