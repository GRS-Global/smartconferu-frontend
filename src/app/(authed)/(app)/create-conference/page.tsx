import type { Metadata } from "next";
import { CreateConferencePage } from "@/features/conferences/components/create-conference-page";

export const metadata: Metadata = { title: "Create New Conference" };

export default function CreateConference() {
  return <CreateConferencePage />;
}
