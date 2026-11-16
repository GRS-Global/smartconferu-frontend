import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPublicationPage } from "@/features/account/new-publication-page";

export const metadata: Metadata = { title: "New Preprint" };

export default function NewPreprint() {
  return <Suspense><NewPublicationPage kind="preprint" /></Suspense>;
}
