import { redirect } from "next/navigation";

// Security & Settings is a popup over My Profile (as in the prototype): this address opens the profile with the popup showing.
export default function Settings() {
  redirect("/profile?settings=open");
}
