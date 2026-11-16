import type { Metadata } from "next";
import { SlidesPage } from "@/features/account/slides-page";

export const metadata: Metadata = { title: "My Slides" };

export default function Slides() {
  return <SlidesPage />;
}
