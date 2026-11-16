/* What an emailed Supabase link left in the address bar, read once per page load.

   This app's Supabase client uses the PKCE flow: the link comes back as `?code=…` and the client (created with
   detectSessionInUrl) exchanges it on load, using a code verifier it stored in this browser's cookies when the email was
   requested — so the link only works in the browser that asked for it — and then removes the code from the address bar.
   Links emailed by the Vite prototype use the older implicit flow (`#access_token=…`); this client refuses those
   ("Not a valid PKCE flow url"), so they are reported as such instead of failing silently.

   The pages that need to know whether a link arrived must read it BEFORE the client is created, because the client
   cleans the address bar. Calling readEmailLink() first (and keeping the first answer) makes that safe even when React
   runs an effect twice. */

export interface EmailLink {
  /** A PKCE `code` is present: the client will try to exchange it. */
  hasCode: boolean;
  /** Implicit-flow tokens are present (a link made by the prototype): this app can't use them. */
  hasImplicitTokens: boolean;
  /** Supabase put an error in the link (expired, already used, …), as a sentence to show. Empty when there is none. */
  error: string;
}

export const EXPIRED_LINK_MESSAGE = "This link has expired or was already used — please request a new one.";
export const OLD_LINK_MESSAGE = "This link came from an older sign-in page and can't be used here — please request a new one from this page.";

const NONE: EmailLink = { hasCode: false, hasImplicitTokens: false, error: "" };
let captured: { key: string; link: EmailLink } | null = null;

export function readEmailLink(): EmailLink {
  if (typeof window === "undefined") return NONE;
  const key = window.location.pathname;
  if (captured?.key === key) return captured.link;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (name: string) => query.get(name) ?? hash.get(name);
  const description = get("error_description");
  const failed = Boolean(description || get("error") || get("error_code"));
  const expired = /expired|invalid|used/i.test(`${get("error_code")} ${description}`);
  const link: EmailLink = {
    hasCode: Boolean(get("code")),
    hasImplicitTokens: Boolean(get("access_token")),
    error: !failed ? "" : expired ? EXPIRED_LINK_MESSAGE : (description || "This link didn't work — please try again.").replace(/\+/g, " "),
  };
  captured = { key, link };
  return link;
}
