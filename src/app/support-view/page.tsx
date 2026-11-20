import { SupportViewStart } from "@/components/support-view";

export const metadata = { title: "Support view" };

/** Opened by the admin console's "View as": takes the read-only token from the link and goes to the page asked for. */
export default function Page() {
  return <SupportViewStart />;
}
