import type { Metadata } from "next";
import { HelpPage } from "@/features/help/help-page";

export const metadata: Metadata = { title: "Help" };

export default function Help() {
  return <HelpPage />;
}
