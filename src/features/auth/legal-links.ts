import { WEBSITE_URL } from "@/lib/config";
import { comingSoonHref } from "@/lib/navigation";

/** The static legal pages. With NEXT_PUBLIC_WEBSITE_URL set they are the website's public pages; otherwise Terms is this app's own page and
 *  the Privacy Policy (not built into this app yet) opens the "Coming soon" page. */
export const TERMS_URL = WEBSITE_URL ? `${WEBSITE_URL}/terms` : "/terms";
export const PRIVACY_URL = WEBSITE_URL ? `${WEBSITE_URL}/privacy` : comingSoonHref("privacy");
