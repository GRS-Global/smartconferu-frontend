import type { Metadata } from "next";
import { PublishPage } from "@/features/account/publish-page";

export const metadata: Metadata = { title: "Publish with Us" };

export default function Publish() {
  return <PublishPage />;
}
