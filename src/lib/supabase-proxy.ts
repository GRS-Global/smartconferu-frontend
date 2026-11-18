import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_API, DATA_SOURCE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { DEFAULT_AFTER_LOGIN, LOGIN_PATH, REGISTER_PATH, RESET_PASSWORD_PATH, loginUrl, safeNext } from "@/lib/auth-redirect";

/** Runs in src/proxy.ts on every page request: refreshes the Supabase session cookies and does the
 *  optimistic redirects (signed out → /login?next=…, signed in on /login → where they were going).
 *  It only checks the signed JWT (`getClaims`); data access is still enforced by Row Level Security. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Mock mode never talks to Supabase, so nothing is gated.
  if (DATA_SOURCE === "mock") return NextResponse.next({ request });
  // Own backend: its session cookie only travels to /api/v1/auth, so pages can't be gated here. The screens do it themselves
  // (ProfileProvider → SessionEnded → /login) and the backend refuses every call without a valid token.
  if (AUTH_API) return NextResponse.next({ request });

  const { pathname, search } = request.nextUrl;
  // Pages a signed-out visitor may open. Signed-in visitors are sent on from /login and /register; /reset-password stays
  // open to them, because the emailed link signs the person in (a recovery session) before the new password is set.
  const onLogin = pathname === LOGIN_PATH || pathname === REGISTER_PATH;
  // /verify/<certificate id> is the page a certificate's QR code opens: employers and universities with no account must be able to see it.
  const onPublic = onLogin || pathname === RESET_PASSWORD_PATH || pathname.startsWith("/verify/");

  // Without keys there is no session to check: only the public pages (which explain the problem) are reachable.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return onPublic ? NextResponse.next({ request }) : NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    // Carry any refreshed cookies onto the redirect so the session isn't lost.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!signedIn && !onPublic) {
    return redirectTo(new URL(loginUrl(`${pathname}${search}`), request.url));
  }
  if (signedIn && onLogin) {
    const next = request.nextUrl.searchParams.get("next");
    return redirectTo(new URL(next ? safeNext(next) : DEFAULT_AFTER_LOGIN, request.url));
  }
  return response;
}
