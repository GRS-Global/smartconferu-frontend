/* The public address of a CFP page as the console shows it, e.g. "smartconferu.tech/cfp/ISBM2027" (no https://).
   The host is the site the console itself runs on — the web app's own address, which is what the API's APP_URL is set to (the API builds
   its email links from it) — so it is right on every server (localhost:3100 in development, the live domain in production) without a
   hard-coded domain. The console's screens render after their data loads in the browser, so `window` is there when this is called. */
export function cfpAddress(page: string): string {
  const host = typeof window === "undefined" ? "" : window.location.host;
  return `${host}/cfp/${page}`;
}
