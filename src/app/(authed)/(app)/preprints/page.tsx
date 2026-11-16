import type { Metadata } from "next";
import { PreprintsPage } from "@/features/account/preprints-page";

export const metadata: Metadata = { title: "My Preprints" };

export default function Preprints() {
  return <PreprintsPage />;
}
