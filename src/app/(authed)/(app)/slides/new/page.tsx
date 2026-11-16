import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPublicationPage } from "@/features/account/new-publication-page";

export const metadata: Metadata = { title: "New Slides" };

export default function NewSlides() {
  return <Suspense><NewPublicationPage kind="slides" /></Suspense>;
}
