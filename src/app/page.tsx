import { redirect } from "next/navigation";

// The app opens on the dashboard; signed-out visitors are sent on to /login from there.
export const instant = false;

export default function Home() {
  redirect("/dashboard");
}
