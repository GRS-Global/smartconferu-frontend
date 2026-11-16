import type { Metadata } from "next";
import { RequestDetailPage } from "@/features/conferences/components/request-detail-page";

export const metadata: Metadata = { title: "Conference Request" };

// Any id is valid (it is matched against the signed-in user's own requests on the client); one is listed so the route can be prerendered.
export function generateStaticParams() {
  return [{ id: "your-request" }];
}

export default async function RequestDetail({ params }: PageProps<"/my-requests/[id]">) {
  const { id } = await params;
  return <RequestDetailPage id={id} />;
}
