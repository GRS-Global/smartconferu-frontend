/* The full public address of a CFP page, e.g. "https://smartconferu.tech/cfp/ISBM2027".
   It is built from the site the console itself runs on — the web app's own address, which is what the API's APP_URL is set to (the API
   builds its email links from it) — so it is right on every server (http://localhost:3100 in development, the live domain in production)
   without a hard-coded domain. The console's screens render after their data loads in the browser, so `window` is there when this is called. */
export function cfpAddress(page: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/cfp/${encodeURIComponent(page)}`;
}
