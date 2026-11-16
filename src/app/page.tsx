import { redirect } from "next/navigation";

// Sign-in is not ported yet, so the app opens on the first ported screen.
export default function Home() {
  redirect("/dashboard");
}
