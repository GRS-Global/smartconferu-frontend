import type { Metadata } from "next";
import { CfpListPage } from "@/features/cfp/components/cfp-list-page";

export const metadata: Metadata = { title: "Calls for Papers" };

export default function MyCfp() {
  return <CfpListPage />;
}
