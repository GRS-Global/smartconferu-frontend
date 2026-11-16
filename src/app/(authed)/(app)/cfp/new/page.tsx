import type { Metadata } from "next";
import { CfpNewPage } from "@/features/cfp/components/cfp-new-page";

export const metadata: Metadata = { title: "Add a New Call for Papers" };

export default function NewCfp() {
  return <CfpNewPage />;
}
