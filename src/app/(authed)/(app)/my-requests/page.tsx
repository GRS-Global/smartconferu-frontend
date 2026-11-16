import type { Metadata } from "next";
import { MyRequestsPage } from "@/features/conferences/components/my-requests-page";

export const metadata: Metadata = { title: "My Requests" };

export default function MyRequests() {
  return <MyRequestsPage />;
}
