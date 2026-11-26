import { WEBSITE_URL } from "@/lib/config";

/** The legal pages. Without NEXT_PUBLIC_WEBSITE_URL they are this app's own public pages (public/terms, public/privacy, served at
 *  /terms and /privacy through rewrites in next.config.ts); with it, the website's. */
export const TERMS_URL = WEBSITE_URL ? `${WEBSITE_URL}/terms` : "/terms";
export const PRIVACY_URL = WEBSITE_URL ? `${WEBSITE_URL}/privacy` : "/privacy";
