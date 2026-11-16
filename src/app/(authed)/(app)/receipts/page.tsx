import type { Metadata } from "next";
import { ReceiptsPage } from "@/features/account/receipts-page";

export const metadata: Metadata = { title: "My Receipts" };

export default function Receipts() {
  return <ReceiptsPage />;
}
