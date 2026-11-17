import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-proxy";

export async function proxy(request: NextRequest) {
  // The Super Admin console signs in against the Smartconferu API, not Supabase: its pages check
  // their own session (features/super-admin/session.tsx).
  if (request.nextUrl.pathname === "/super-admin" || request.nextUrl.pathname.startsWith("/super-admin/")) {
    return NextResponse.next({ request });
  }
  return updateSession(request);
}

export const config = {
  // Pages only: skip Next internals and static files (anything with a file extension).
  matcher: ["/((?!_next/|api/|.*\\..*).*)"],
};
